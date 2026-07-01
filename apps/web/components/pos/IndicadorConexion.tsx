"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import {
  contarPendientes,
  intentarSync,
  onSyncChange,
  registrarSyncBackground,
} from "@/lib/pos-sync";

export function IndicadorConexion() {
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    registrarSyncBackground();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const refresh = async () => {
      const n = await contarPendientes().catch(() => 0);
      if (!cancelado) setPendientes(n);
    };
    void refresh();
    const unsub = onSyncChange(() => {
      void refresh();
    });
    const id = setInterval(refresh, 5000);
    return () => {
      cancelado = true;
      clearInterval(id);
      unsub();
    };
  }, []);

  async function forzar() {
    setSincronizando(true);
    try {
      await intentarSync();
    } finally {
      setSincronizando(false);
    }
  }

  if (online && pendientes === 0) {
    return (
      <span className="atria-badge atria-badge-success">
        <Wifi size={11} /> En línea
      </span>
    );
  }
  if (online && pendientes > 0) {
    return (
      <button
        type="button"
        onClick={forzar}
        disabled={sincronizando}
        className="atria-badge atria-badge-info"
      >
        <RefreshCw size={11} className={sincronizando ? "animate-spin" : ""} />
        Sincronizando · {pendientes} {pendientes === 1 ? "venta" : "ventas"}
      </button>
    );
  }
  if (!online && pendientes > 0) {
    return (
      <span className="atria-badge atria-badge-warning">
        <AlertTriangle size={11} /> Offline · {pendientes} guardadas
      </span>
    );
  }
  return (
    <span className="atria-badge atria-badge-warning">
      <WifiOff size={11} /> Modo offline
    </span>
  );
}
