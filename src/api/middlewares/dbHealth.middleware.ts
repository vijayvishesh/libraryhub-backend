import { NextFunction, Request, Response } from 'express';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { Service } from 'typedi';
import { isDatabaseConnected, isDatabaseEnabled } from '../../database/config/ormconfig.default';

@Service()
@Middleware({ type: 'before' })
export class DbHealthMiddleware implements ExpressMiddlewareInterface {
  public use(req: Request, res: Response, next: NextFunction) {
    if (!isDatabaseEnabled()) {
      next();
      return;
    }

    if (!isDatabaseConnected()) {
      res.status(503).json({
        status: 503,
        data: null,
        error: 'Database connection unavailable. Please try again later.',
        message: 'Service temporarily unavailable',
      });
      return;
    }

    next();
  }
}
