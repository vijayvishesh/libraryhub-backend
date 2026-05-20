import { Response } from 'express';
import mongoose from 'mongoose';
import { Get, JsonController, Res } from 'routing-controllers';

@JsonController()
export class HealthController {
  @Get('/health')
  public health(@Res() res: Response): Response {
    const dbState = mongoose.connection.readyState;
    const dbOk = dbState === 1;
    const status = dbOk ? 'ok' : 'degraded';
    return res.status(dbOk ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'error',
      },
    });
  }

  @Get('/live')
  public live(@Res() res: Response): Response {
    return res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  }

  @Get('/ready')
  public ready(@Res() res: Response): Response {
    const dbState = mongoose.connection.readyState;
    const ready = dbState === 1;
    return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  }
}
