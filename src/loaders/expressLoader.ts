import * as cookieParser from 'cookie-parser';
import { Application } from 'express';
import * as http from 'http';
import { MicroframeworkLoader, MicroframeworkSettings } from 'microframework-w3tec';
import { useExpressServer } from 'routing-controllers';
import { authorizationChecker, currentUserChecker } from '../api/middlewares/auth.middleware';
import { env } from '../env';

export const expressLoader: MicroframeworkLoader = (
  settings: MicroframeworkSettings | undefined,
) => {
  try {
    if (settings) {
      const expressApp: Application = require('express')();

      expressApp.use(cookieParser());

      useExpressServer(expressApp, {
        cors: {
          origin:
            env.awsApiGateway.optionsOrigins && env.awsApiGateway.optionsOrigins.length > 0
              ? env.awsApiGateway.optionsOrigins
              : [`http://${env.frontend.host}:${env.frontend.port}`],

          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: env.awsApiGateway.optionsHeaders || ['Content-Type', 'Authorization'],
          credentials: true,
        },
        classTransformer: true,
        validation: true,
        routePrefix: env.app.routePrefix,
        defaultErrorHandler: false,
        authorizationChecker,
        currentUserChecker,
        controllers: env.app.dirs.controllers,
        middlewares: env.app.dirs.middlewares,
      });
      if (!env.isTest) {
        const httpServer = http.createServer(expressApp);
        httpServer.listen(env.app.port);
        settings.setData('http_server', httpServer);
        settings.setData('express_server', httpServer);
      }

      settings.setData('express_app', expressApp);
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error; // Re-throw to track in logs
  }
};
