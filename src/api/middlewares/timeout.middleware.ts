import { NextFunction, Request, Response } from 'express';

export function timeoutMiddleware(ms = 30_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ responseCode: 408, message: 'REQUEST_TIMEOUT' });
      }
    }, ms);
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    next();
  };
}
