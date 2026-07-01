"use client";

import { useEffect } from "react";
import { conectarRealtime, desconectarRealtime, onRealtime } from "@/lib/realtime";
import { useToast } from "@/components/ui/Toast";
import { formatearMoneda } from "@/lib/utils";

export function RealtimeBoot() {
  const { mostrar } = useToast();
  useEffect(() => {
    conectarRealtime();
    const unsub = onRealtime((ev) => {
      if (ev.type === "dashboard.updated") {
        mostrar("info", `Nueva venta · ${formatearMoneda(ev.total)}`);
      }
    });
    return () => {
      unsub();
      desconectarRealtime();
    };
  }, [mostrar]);
  return null;
}
