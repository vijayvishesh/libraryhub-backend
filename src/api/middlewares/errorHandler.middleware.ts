import * as express from 'express';
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';
import { Service } from 'typedi';
import { ErrorData } from '../controllers/responses/common.reponse';
// import { isDatabaseConnected } from '../../database/config/ormconfig.default';
import { Logger, LoggerInterface } from '../../decorators/Logger';
import { env } from '../../env';

type ValidationErrorShape = {
  property?: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorShape[];
};

@Service()
@Middleware({ type: 'after' })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
  public isProduction = env.isProduction;
  constructor(@Logger(__filename) private log: LoggerInterface) {}

  public error(error: HttpError, req: express.Request, res: express.Response): void {
    this.log.error('Error caught by middleware', {
      errorName: error.name,
      errorMessage: error.message,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // if (!isDatabaseConnected()) {
    //   this.log.error('Database connection unavailable during request', {
    //     error: error.message,
    //     stack: error.stack,
    //     url: req.url,
    //     method: req.method,
    //     timestamp: new Date().toISOString(),
    //   });

    //   res.status(503).json({
    //     status: 503,
    //     data: null,
    //     error: 'Database connection unavailable. Please try again later.',
    //   });
    //   return;
    // }

    if (
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('MongoNetworkError') ||
      error.message.includes('MongoServerSelectionError') ||
      error.message.includes('MongooseServerSelectionError') ||
      error.message.includes('buffermaxentriesexceeded') ||
      error.message.includes('topology')
    ) {
      this.log.error('Database connection error detected', {
        errorType: 'DATABASE_CONNECTION_ERROR',
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
      });

      res.status(503).json({
        success: false,
        code: 'DATABASE_CONNECTION_LOST',
        message: 'Database connection lost. Please try again later.',
        details: [],
      });
      return;
    }

    const responseCode = error.httpCode || 500;
    const validationErrors = this.formatValidationErrors(error[`errors`]);
    const hasValidationErrors = validationErrors.length > 0;

    res.status(responseCode).json({
      success: false,
      code: this.resolveErrorCode(error.name, error.message),
      message: this.getClientMessage(error.name, error.message, hasValidationErrors),
      details: validationErrors,
    });

    if (this.isProduction) {
      this.log.error(error.name, error.message);
    } else {
      this.log.error(error.name, error.stack);
    }
  }

  private getClientMessage(
    errorName: string,
    errorMessage: string,
    hasValidationErrors: boolean,
  ): string {
    if (hasValidationErrors || errorName === 'BadRequestError') {
      return 'Validation failed. Please check the request fields.';
    }

    if (!errorMessage) {
      return 'Something went wrong. Please try again.';
    }

    if (this.isErrorCode(errorMessage)) {
      return this.humanizeErrorCode(errorMessage);
    }

    return errorMessage;
  }

  private isErrorCode(value: string): boolean {
    return /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(value);
  }

  private resolveErrorCode(errorName: string, errorMessage: string): string {
    if (this.isErrorCode(errorMessage)) {
      return errorMessage;
    }

    if (this.isErrorCode(errorName)) {
      return errorName;
    }

    return 'INTERNAL_SERVER_ERROR';
  }

  private humanizeErrorCode(errorCode: string): string {
    return errorCode
      .split('_')
      .map(word => {
        if (word === 'OTP' || word === 'JWT' || word === 'ID') {
          return word;
        }

        return word.charAt(0) + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  private formatValidationErrors(validationErrors: unknown): ErrorData[] {
    if (!Array.isArray(validationErrors)) {
      return [];
    }

    const output: ErrorData[] = [];
    const walk = (errors: ValidationErrorShape[], parentPath = ''): void => {
      for (const validationError of errors) {
        const property = validationError.property || 'field';
        const fieldPath = parentPath ? `${parentPath}.${property}` : property;

        if (validationError.constraints) {
          for (const message of Object.values(validationError.constraints)) {
            output.push(new ErrorData(fieldPath, message));
          }
        }

        if (validationError.children && validationError.children.length > 0) {
          walk(validationError.children, fieldPath);
        }
      }
    };

    walk(validationErrors as ValidationErrorShape[]);
    return output;
  }
}
