"use client";
import {webDocumentCommand} from './WebDocuments';
import { CommercialWorkspace } from "./CommercialWorkspace";
import type {
  CommercialCommand,
  CommercialKind,
  CommercialResult,
} from "../../lib/commercial-core";
const send = async (c: CommercialCommand): Promise<CommercialResult> => {
  const response = await fetch("/api/commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
    cache: "no-store",
  });
  if (response.status >= 500)
    throw new Error(
      "Sin confirmación del servidor. Reintenta el mismo intento.",
    );
  return response.json();
};
export function WebCommercial({
  kind,
  profileOnly=false,
  branches,
  contextId,
}: {
  profileOnly?:boolean;
  contextId: string;
  kind: CommercialKind;
  branches: Array<{ id: string; nombre: string }>;
}) {
  return (
    <CommercialWorkspace
      key={contextId+kind}
      profileOnly={profileOnly}
      contextId={contextId}
      kind={kind}
      branches={branches}
      send={send}
      documentSend={webDocumentCommand}
    />
  );
}
