"use client";

import { useEffect, useState } from "react";

type RechartsModule = typeof import("recharts");

let rechartsPromise: Promise<RechartsModule> | null = null;

function cargarRecharts() {
  rechartsPromise ??= import("recharts");
  return rechartsPromise;
}

export function useRecharts() {
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let activo = true;
    void cargarRecharts().then((modulo) => {
      if (activo) setRecharts(modulo);
    });
    return () => {
      activo = false;
    };
  }, []);

  return recharts;
}
