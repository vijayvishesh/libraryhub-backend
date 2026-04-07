import { MicroframeworkLoader, MicroframeworkSettings } from 'microframework-w3tec';
import { Logger } from '../lib/logger';
import { initSocketServer } from '../lib/socket/socketServer';

const log = new Logger(__filename);

export const socketLoader: MicroframeworkLoader = (settings: MicroframeworkSettings | undefined) => {
  if (!settings) {
    return;
  }

  const httpServer = settings.getData('http_server');

  if (!httpServer) {
    log.warn('Socket loader skipped: HTTP server not available.');
    return;
  }

  const socketServer = initSocketServer(httpServer);
  settings.setData('socket_server', socketServer);
};
