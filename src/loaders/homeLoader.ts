import * as express from 'express';
import { MicroframeworkLoader, MicroframeworkSettings } from 'microframework-w3tec';
import { getDatabaseStatus } from '../database/config/ormconfig.default';

import { env } from '../env';

export const homeLoader: MicroframeworkLoader = (settings: MicroframeworkSettings | undefined) => {
  if (settings) {
    const expressApp = settings.getData('express_app');
    const buildApiResponse = <T>(responseCode: number, data: T) => ({
      responseCode,
      data,
    });

    expressApp.get(env.app.routePrefix, (_req: express.Request, res: express.Response) =>
      res.status(200).json(
        buildApiResponse(200, {
          message: 'App is working',
        }),
      ),
    );

    const buildHealthPayload = () => ({
      status: 'ok',
      message: `${env.app.name} is healthy`,
      service: env.app.name,
      database: getDatabaseStatus(),
      timestamp: new Date().toISOString(),
    });

    expressApp.get('/health', (_req: express.Request, res: express.Response) =>
      res.status(200).json(buildApiResponse(200, buildHealthPayload())),
    );

    if (env.app.routePrefix && env.app.routePrefix !== '/') {
      expressApp.get(`${env.app.routePrefix}/health`, (_req: express.Request, res: express.Response) =>
        res.status(200).json(buildApiResponse(200, buildHealthPayload())),
      );
    }
  }
};
