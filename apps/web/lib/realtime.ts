/**
 * Cliente Socket.IO para conectarse a RealtimeGateway del API.
 *
 * Auth: el navegador envía la cookie `atria_access` automáticamente cuando
 * `withCredentials: true`. El gateway extrae el token de la cookie.
 *
 * Eventos escuchados:
 * - `dashboard.updated` — emitido cuando ocurre una venta completada
 */

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export type RealtimeEvent =
  | { type: "dashboard.updated"; organizationId: string; saleId: string; total: number }
  | { type: "connection.changed"; connected: boolean };

const listeners = new Set<(ev: RealtimeEvent) => void>();

function emit(ev: RealtimeEvent) {
  for (const cb of listeners) cb(ev);
}

export function getRealtimeSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Realtime client solo funciona en cliente");
  }
  if (socket) return socket;

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  // socket.io vive en la raíz, no bajo /api/v1
  const origin = new URL(base).origin;

  socket = io(origin, {
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    emit({ type: "connection.changed", connected: true });
    socket?.emit("dashboard:join");
  });
  socket.on("disconnect", () => {
    emit({ type: "connection.changed", connected: false });
  });
  socket.on("connect_error", () => {
    emit({ type: "connection.changed", connected: false });
  });
  socket.on("dashboard.updated", (payload: { organizationId: string; saleId: string; total: number }) => {
    emit({ type: "dashboard.updated", ...payload });
  });

  return socket;
}

export function conectarRealtime() {
  const s = getRealtimeSocket();
  if (!s.connected) s.connect();
}

export function desconectarRealtime() {
  if (socket?.connected) socket.disconnect();
}

export function onRealtime(cb: (ev: RealtimeEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
