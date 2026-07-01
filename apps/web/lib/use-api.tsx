"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient, ApiError, ApiDisabledError } from "./api-client";

export type UseApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  apiDisabled: boolean;
  refetch: () => Promise<void>;
};

/**
 * Hook básico para GET de la API. Maneja loading/error/ApiDisabledError.
 *
 * Uso:
 *   const { data, loading, error } = useApi<Producto[]>("/inventory/products");
 */
export function useApi<T>(
  path: string | null,
  deps: ReadonlyArray<unknown> = [],
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [apiDisabled, setApiDisabled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ejecutar = useCallback(async () => {
    if (path === null) {
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setApiDisabled(false);
    try {
      const res = await apiClient.get<T>(path, { signal: ac.signal });
      if (!ac.signal.aborted) {
        setData(res);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      if (err instanceof ApiDisabledError) {
        setApiDisabled(true);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Error desconocido");
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void ejecutar();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error, apiDisabled, refetch: ejecutar };
}

/**
 * Wrapper para mostrar el estado API_DISABLED de forma consistente en cada página.
 */
export function ApiAviso({
  apiDisabled,
  error,
}: {
  apiDisabled: boolean;
  error: string | null;
}) {
  if (apiDisabled) {
    return (
      <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-small">
        <strong>API deshabilitada.</strong> Estás viendo el frontend sin backend.
        Activa <code className="mx-1 rounded bg-white/40 px-1.5 py-0.5">API_ENABLED=true</code>
        en <code>apps/api/.env</code> y reinicia.
      </div>
    );
  }
  if (error) {
    return (
      <div className="mb-4 rounded-md bg-[color:var(--color-error-bg)] px-4 py-3 text-small text-[color:var(--color-error)]">
        {error}
      </div>
    );
  }
  return null;
}
