import { NextApiResponseServerIo } from '@/types/server';
import { NextApiRequest } from 'next';
import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = '/api/socket/io';
    const httpServer: HttpServer = res.socket.server as any;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 [Socket.IO] Initializing server...');
      }

      const io = new SocketIOServer(httpServer, {
        path,
        addTrailingSlash: false,
        transports: ['polling', 'websocket'],
        cors: {
          origin:
            process.env.NODE_ENV === 'production'
              ? process.env.NEXT_PUBLIC_SITE_URL
              : ['http://localhost:3000'],
          methods: ['GET', 'POST'],
          credentials: true,
        },
        allowEIO3: true,
        serveClient: false,
        pingTimeout: 60000,
        pingInterval: 25000,
      });

      io.engine.on('connection_error', err => {
        console.error('🚨 [Socket.IO] Connection error:', {
          code: err.code,
          message: err.message,
          type: err.type || 'unknown',
        });
      });

      io.engine.on('upgrade_error', err => {
        console.log('⚠️ [Socket.IO] Upgrade failed (will retry):', err.message);
      });

      io.on('connection', socket => {
        console.log('✅ [Socket.IO] Client connected:', socket.id);

        socket.on('disconnect', reason => {
          console.log(
            '❌ [Socket.IO] Client disconnected:',
            socket.id,
            'Reason:',
            reason
          );
        });

        socket.on('error', error => {
          console.error('⚠️ [Socket.IO] Socket error:', error);
        });
      });

      res.socket.server.io = io;
      console.log('🚀 [Socket.IO] Server initialized successfully');
    } catch (error) {
      console.error('❌ [Socket.IO] Server initialization failed:', error);
      // Continue without Socket.IO rather than crash
    }
  } else {
    console.log('♻️ [Socket.IO] Server already initialized');
  }

  res.end();
};

export default ioHandler;
