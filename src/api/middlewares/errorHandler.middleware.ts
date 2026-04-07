import * as express from 'express';
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';

import { Service } from 'typedi';
// import { isDatabaseConnected } from '../../database/config/ormconfig.default';
import { Logger, LoggerInterface } from '../../decorators/Logger';
import { env } from '../../env';
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
        status: 503,
        data: null,
        error: 'Database connection lost. Please try again later.',
      });
      return;
    }

    res.status(error.httpCode || 500);
    res.json({
      name: error.name,
      message: error.message,
      errors: error[`errors`] || [],
    });

    if (this.isProduction) {
      this.log.error(error.name, error.message);
    } else {
      this.log.error(error.name, error.stack);
    }
  }
}
