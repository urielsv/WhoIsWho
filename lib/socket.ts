import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getDefaultSocketUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

function resolveSocketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? getDefaultSocketUrl();
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function useSocket() {
  // Get socket immediately since it's a singleton
  const socket = getSocket();
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Update state if already connected
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return socket;
}

