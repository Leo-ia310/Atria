"use client";

import { useEffect } from "react";

export function ServiceWorkerBoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencioso — el POS funciona aunque el SW no se pueda registrar.
    });
  }, []);
  return null;
}
