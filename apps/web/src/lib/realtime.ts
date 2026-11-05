'use client';
import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, session } from './api';

let socket: Socket | null = null;
let socketToken: string | null = null;

function getSocket(): Socket | null {
  const token = session.token;
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(API_URL.replace(/\/api\/?$/, ''), { auth: { token }, transports: ['websocket'], reconnectionDelay: 3000 });
  return socket;
}

/** Subscreve um evento em tempo real; com `farmId` entra na sala da propriedade. */
export function useRealtime<T = unknown>(event: string, handler: (payload: T) => void, farmId?: string | null) {
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    const join = () => farmId && s.emit('farm:join', farmId);
    join();
    s.on('connect', join);
    return () => {
      s.off(event, fn);
      s.off('connect', join);
      if (farmId) s.emit('farm:leave', farmId);
    };
  }, [event, farmId]);
}
