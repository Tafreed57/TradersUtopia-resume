'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { io as ClientIO, Socket } from 'socket.io-client';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔌 [Socket] Initializing client connection...');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    // ✅ CONSERVATIVE: Start with polling, delay WebSocket upgrade
    const isProduction = process.env.NODE_ENV === 'production';

    const client = new (ClientIO as any)(siteUrl, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      // ✅ FIX: In development, prefer polling to avoid upgrade issues
      transports: isProduction ? ['polling', 'websocket'] : ['polling'],
      timeout: 15000, // Longer timeout for stability
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      // ✅ DEVELOPMENT: Disable auto-upgrade in dev mode
      upgrade: isProduction,
      // ✅ CONSERVATIVE: Longer intervals
      rememberUpgrade: false,
    });

    // ✅ ENHANCED: Better connection success handling
    client.on('connect', () => {
      console.log('✅ [Socket] Connected successfully:', client.id);
      console.log('🔗 [Socket] Transport:', client.io.engine.transport.name);
      setIsConnected(true);
      setConnectionError(null);
    });

    // ✅ DETAILED: Better disconnection tracking
    client.on('disconnect', (reason: string) => {
      console.log('❌ [Socket] Disconnected:', reason);
      setIsConnected(false);

      // Don't treat transport close as an error in development
      if (reason === 'transport close' && !isProduction) {
        console.log('ℹ️ [Socket] Transport close in development (expected)');
      }
    });

    // ✅ GRACEFUL: Better error handling
    client.on('connect_error', (error: any) => {
      console.warn('⚠️ [Socket] Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // ✅ DEBUG: Track transport upgrades
    client.io.engine.on('upgrade', () => {
      console.log(
        '🔄 [Socket] Transport upgraded to:',
        client.io.engine.transport.name
      );
    });

    // ✅ DEBUG: Track upgrade errors
    client.io.engine.on('upgradeError', (error: any) => {
      console.log(
        '⚠️ [Socket] Upgrade error (will continue with polling):',
        error.message
      );
    });

    // ✅ TIMEOUT: Graceful timeout handling
    const timeoutId = setTimeout(() => {
      if (!client.connected) {
        console.warn(
          '⏰ [Socket] Connection timeout, app will continue without real-time features'
        );
        setConnectionError(
          'Connection timeout - app will work without real-time features'
        );
      }
    }, 8000); // Longer timeout

    setSocket(client);

    return () => {
      clearTimeout(timeoutId);
      console.log('🧹 [Socket] Cleaning up connection');
      if (client.connected) {
        client.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};
