import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HttpServer } from 'http';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';
import { env } from '../../env';

export const BROADCAST_ROOM = 'broadcast';
export const BROADCAST_EVENT = 'broadcast';
export const DCEO_BROADCAST_ROOM = 'dceo-broadcast';
export const DCEO_BROADCAST_EVENT = 'dceo-broadcast';
export const DCEO_OVERALL_BROADCAST_ROOM = 'dceo-overall-broadcast';
export const DCEO_OVERALL_BROADCAST_EVENT = 'dceo-overall-broadcast';
export const DCEO_DAILY_BROADCAST_ROOM = 'dceo-daily-broadcast';
export const DCEO_DAILY_BROADCAST_EVENT = 'dceo-daily-broadcast';
export const DSE_DAILY_BROADCAST_ROOM = 'dse-daily-broadcast';
export const DSE_DAILY_BROADCAST_EVENT = 'dse-daily-broadcast';

let io: Server | null = null;

const resolveCorsOrigins = (): string[] | string => {
  if (env.awsApiGateway.optionsOrigins && env.awsApiGateway.optionsOrigins.length > 0) {
    return env.awsApiGateway.optionsOrigins;
  }

  return `${env.frontend.schema}://${env.frontend.host}:${env.frontend.port}`;
};

const createRedisAdapter = () => {
  const authPart = env.redis.password ? `:${encodeURIComponent(env.redis.password)}@` : '';
  const redisUrl = `redis://${authPart}${env.redis.host}:${env.redis.port}/${env.redis.db}`;
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (error) => console.error('socket redis pub error', error));
  subClient.on('error', (error) => console.error('socket redis sub error', error));

  void pubClient.connect().catch((error) => console.error('socket redis pub connect failed', error));
  void subClient.connect().catch((error) => console.error('socket redis sub connect failed', error));

  return createAdapter(pubClient, subClient);
};

export const initSocketServer = (httpServer: HttpServer): Server => {
  if (io) {
    return io;
  }

  const isDev = env.node === 'development' || env.isDevelopment;
  const corsOrigin = isDev ? true : resolveCorsOrigins();
  const routePrefix = (env.app.routePrefix || '').replace(/\/$/, '');
  const socketPath = routePrefix ? `${routePrefix}/socket.io` : '/socket.io';

  io = new Server(httpServer, {
    path: socketPath,
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  if (env.redis.enabled) {
    io.adapter(createRedisAdapter());
  }

  // eslint-disable-next-line no-console
  console.log('socket server initialized', { corsOrigin });

  io.engine.on('connection_error', (error) => {
    console.error('socket connection_error', {
      code: error.code,
      message: error.message,
      context: error.context,
    });
  });

  io.engine.on('initial_headers', (headers, request) => {
    // eslint-disable-next-line no-console
    console.log('socket initial_headers', {
      origin: request.headers.origin,
      host: request.headers.host,
      url: request.url,
    });
  });

  io.on('connection', (socket: Socket) => {
    // eslint-disable-next-line no-console
    console.log('socket connected', socket.id, 'transport', socket.conn.transport.name);
    socket.conn.on('upgrade', (transport) => {
      // eslint-disable-next-line no-console
      console.log('socket upgraded', socket.id, transport.name);
    });
    socket.on('subscribe', (room?: string) => {
      socket.join(room || BROADCAST_ROOM);
    });

    socket.on('unsubscribe', (room?: string) => {
      socket.leave(room || BROADCAST_ROOM);
    });
  });

  return io;
};

export const getSocketServer = (): Server => {
  if (!io) {
    throw new Error('Socket server not initialized');
  }

  return io;
};

export const broadcastToSubscribers = (payload: unknown) => {
  const socketServer = getSocketServer();
  const room = socketServer.sockets.adapter.rooms.get(BROADCAST_ROOM);
  const subscribers = room ? room.size : 0;

  socketServer.to(BROADCAST_ROOM).emit(BROADCAST_EVENT, payload);

  return { delivered: true, subscribers };
};

export const broadcastToDceoSubscribers = (payload: unknown) => {
  const socketServer = getSocketServer();
  const room = socketServer.sockets.adapter.rooms.get(DCEO_BROADCAST_ROOM);
  const subscribers = room ? room.size : 0;

  socketServer.to(DCEO_BROADCAST_ROOM).emit(DCEO_BROADCAST_EVENT, payload);

  return { delivered: true, subscribers };
};

export const broadcastToDceoOverallSubscribers = (payload: unknown) => {
  const socketServer = getSocketServer();
  const room = socketServer.sockets.adapter.rooms.get(DCEO_OVERALL_BROADCAST_ROOM);
  const subscribers = room ? room.size : 0;

  socketServer.to(DCEO_OVERALL_BROADCAST_ROOM).emit(DCEO_OVERALL_BROADCAST_EVENT, payload);

  return { delivered: true, subscribers };
};

export const broadcastToDceoDailySubscribers = (payload: unknown, dealerCodes: string[], mspins: string[]) => {
  const socketServer = getSocketServer();
  const uniqueDealerCodes = [...new Set(dealerCodes.filter(Boolean))];
  const uniqueMspins = [...new Set(mspins.filter(Boolean))];

  let totalSubscribers = 0;
  for (const dealerCode of uniqueDealerCodes) {
    const roomName = `${DCEO_DAILY_BROADCAST_ROOM}:${dealerCode}`;
    const room = socketServer.sockets.adapter.rooms.get(roomName);
    const subscribers = room ? room.size : 0;
    totalSubscribers += subscribers;
    socketServer.to(roomName).emit(DCEO_DAILY_BROADCAST_EVENT, payload);
  }

  for (const mspin of uniqueMspins) {
    const roomName = `${DSE_DAILY_BROADCAST_ROOM}:${mspin}`;
    const room = socketServer.sockets.adapter.rooms.get(roomName);
    const subscribers = room ? room.size : 0;
    totalSubscribers += subscribers;
    socketServer.to(roomName).emit(DSE_DAILY_BROADCAST_EVENT, payload);
  }

  return { delivered: true, subscribers: totalSubscribers };
};
