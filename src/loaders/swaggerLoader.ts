import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import * as basicAuth from 'express-basic-auth';
import { MicroframeworkLoader, MicroframeworkSettings } from 'microframework-w3tec';
import { getMetadataArgsStorage } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import * as swaggerUi from 'swagger-ui-express';
import { env } from '../env';

export const swaggerLoader: MicroframeworkLoader = (settings: MicroframeworkSettings | undefined) => {
  if (settings && env.swagger.enabled) {
    const expressApp = settings.getData('express_app');

    const schemas = validationMetadatasToSchemas({
      classTransformerMetadataStorage: defaultMetadataStorage,
      refPointerPrefix: '#/components/schemas/',
    });

    const swaggerFile = routingControllersToSpec(
      getMetadataArgsStorage(),
      {},
      {
        components: {
          schemas,
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    );

    // Add npm infos to the swagger doc
    swaggerFile.info = {
      title: env.app.name,
      description: '',
      version: '1.0.0',
    };

    const swaggerBaseUrl = env.swagger.baseUrl;
    const isValidBaseUrl =
      !!swaggerBaseUrl &&
      !swaggerBaseUrl.startsWith('://') &&
      !swaggerBaseUrl.startsWith('undefined') &&
      !swaggerBaseUrl.includes('://:');

    swaggerFile.servers = [
      {
        url: isValidBaseUrl ? swaggerBaseUrl : env.app.routePrefix || '/api',
      },
    ];

    expressApp.use(
      env.swagger.route,
      env.swagger.username
        ? basicAuth({
            users: {
              [`${env.swagger.username}`]: env.swagger.password,
            },
            challenge: true,
          })
        : (req, res, next) => next(),
      swaggerUi.serve,
      swaggerUi.setup(swaggerFile, {
        customCssUrl: '/swagger-custom.css',
      }),
    );
  }
};
