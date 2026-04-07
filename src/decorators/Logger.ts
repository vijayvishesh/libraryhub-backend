import { Container } from 'typedi';

import { Logger as WinstonLogger } from '../lib/logger';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Logger(scope: string): ParameterDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (object: any, propertyKey, index): void => {
    const logger = new WinstonLogger(scope);
    const propertyName = propertyKey ? propertyKey.toString() : '';
    Container.registerHandler({ object, propertyName, index, value: () => logger });
  };
}

export type { LoggerInterface } from '../lib/logger';
