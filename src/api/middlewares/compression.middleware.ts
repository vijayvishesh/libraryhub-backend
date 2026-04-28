import * as compression from 'compression';
import * as express from 'express';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { Service } from 'typedi';

const compressionHandler = compression({
  filter: (req, res) => {
    const acceptHeader = req.headers.accept;
    if (typeof acceptHeader === 'string' && acceptHeader.includes('text/html')) {
      return false;
    }

    return compression.filter(req, res);
  },
});

@Service()
@Middleware({ type: 'before' })
export class CompressionMiddleware implements ExpressMiddlewareInterface {
  public use(req: express.Request, res: express.Response, next: express.NextFunction) {
    return compressionHandler(req, res, next);
  }
}
