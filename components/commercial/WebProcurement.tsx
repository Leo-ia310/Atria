"use client";
import type { ProcurementResult } from "../../lib/procurement-core";
import {
  ProcurementWorkspace,
  type ProcurementTransport,
} from "./ProcurementWorkspace";
export const webProcurementCommand: ProcurementTransport = async (command) => {
  const response = await fetch("/api/procurement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("Sin confirmación. Recupera el mismo intento.");
  const result: ProcurementResult = await response.json();
  if (!result.ok && result.requiresRecovery) throw new Error(result.error);
  return result;
};
export function WebProcurement(p: {
  contextId: string;
  branches: Array<{ id: string; nombre: string }>;
}) {
  return <ProcurementWorkspace {...p} send={webProcurementCommand} />;
}
