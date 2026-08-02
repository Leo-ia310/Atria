"use client";

import { useEffect, useRef } from "react";

type BarcodeScannerOptions = {
  enabled?: boolean;
  minLength?: number;
  maxInterKeyDelayMs?: number;
  resetDelayMs?: number;
  onScan: (codigo: string) => void;
};

function limpiarCodigo(valor: string): string {
  return valor.replace(/[\r\n\t]/g, "").trim();
}

export function useBarcodeScanner({
  enabled = true,
  minLength = 4,
  maxInterKeyDelayMs = 55,
  resetDelayMs = 250,
  onScan,
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function resetBuffer() {
      bufferRef.current = "";
      lastAtRef.current = 0;
      clearTimer();
    }

    function commit(event: KeyboardEvent) {
      const codigo = limpiarCodigo(bufferRef.current);
      resetBuffer();
      if (codigo.length < minLength) return;
      event.preventDefault();
      onScanRef.current(codigo);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;

      if (event.key === "Enter" || event.key === "Tab") {
        if (bufferRef.current) commit(event);
        return;
      }

      if (event.key.length !== 1) {
        if (event.key === "Escape") resetBuffer();
        return;
      }

      const now = window.performance.now();
      const previous = lastAtRef.current;
      if (previous && now - previous > maxInterKeyDelayMs) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastAtRef.current = now;
      clearTimer();
      timerRef.current = window.setTimeout(resetBuffer, resetDelayMs);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearTimer();
    };
  }, [enabled, maxInterKeyDelayMs, minLength, resetDelayMs]);
}
