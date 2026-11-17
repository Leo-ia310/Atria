"use client";
import {
  inputMessage,
  documentFileName,
  documentEventDate,
  documentEventLabel,
} from "../../lib/document-display";
import { useEffect, useState } from "react";
import {
  documentCommandSchema,
  type DocumentCommand,
  type TemplateDto,
  type DocumentIssue,
} from "../../lib/document-design";
import {
  renderCommercialPdf,
  type CommercialPdf,
} from "../../lib/commercial-pdf";
import { browserDocumentOutput } from "../../lib/document-output";
import { useDurableCommand } from "./useDurableCommand";
import type { DocumentTransport, DocumentOutput } from "./DocumentDesigner";
export function DocumentPrintControls({
  contextId,
  branch,
  sourceKind,
  sourceId,
  sourceVersion,
  send,
  output,
}: {
  contextId: string;
  branch: string;
  sourceKind: NonNullable<DocumentCommand["sourceKind"]>;
  sourceId: string;
  sourceVersion: number;
  send: DocumentTransport;
  output?: DocumentOutput;
}) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]),
    [permissions, setPermissions] = useState<string[]>([]),
    [selection, setSelection] = useState(""),
    [version, setVersion] = useState(0),
    [copy, setCopy] = useState<"original" | "duplicado">("original");
  const [issued, setIssued] = useState<DocumentIssue | null>(null),
    [preview, setPreview] = useState<CommercialPdf | null>(null);
  const durable = useDurableCommand(
    `arca:document-attempt:${contextId}:${branch}`,
    send,
  );
  const command = (extra: Partial<DocumentCommand>) =>
    documentCommandSchema.parse({
      requestId: crypto.randomUUID(),
      sucursalId: branch,
      ...extra,
    });
  useEffect(() => {
    let current = true;
    void Promise.resolve()
      .then(() => send(command({ action: "templates" })))
      .then((r) => {
        if (current && r.ok) {
          setTemplates(r.templates ?? []);
          setPermissions(r.permissions ?? []);
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [branch, contextId, send]);
  useEffect(() => {
    setIssued(null);
    setPreview(null);
  }, [sourceId, sourceVersion, selection, version, copy, branch]);
  const fromIssue = async (issue: DocumentIssue) => {
    setIssued(issue);
    const pdf = await renderCommercialPdf(
      issue.snapshot,
      issue.design.format,
      issue.design,
      issue.ejemplar,
    );
    setPreview(pdf);
    return pdf;
  };
  const emit = async (print: boolean, download: boolean) => {
    try {
      let doc = issued;
      if (!doc) {
        const r = await durable.run(
          command({
            action: "issue",
            sourceKind,
            sourceId,
            sourceVersion,
            templateId: selection || undefined,
            templateVersion: selection ? version : undefined,
            ejemplar: copy,
          }),
        );
        if (!r?.issue) return;
        doc = r.issue;
      }
      const pdf = preview ?? (await fromIssue(doc));
      if (print) {
        const r = await durable.run(command({ action: "print", id: doc.id }));
        if (!r) return;
        if (r.issue) setIssued(r.issue);
      }
      if (print || download)
        await (output ?? browserDocumentOutput)(
          pdf,
          documentFileName(sourceKind, doc.numero, doc.version, doc.ejemplar),
          print,
        );
    } catch (e) {
      durable.setError(inputMessage(e, "No se pudo emitir el documento."));
    }
  };
  const recover = async () => {
    try {
      const r = durable.retry
        ? await durable.run(durable.retry)
        : await durable.run(
            command({ action: "recover", attemptId: durable.pending! }),
          );
      if (r?.issue) await fromIssue(r.issue);
    } catch (e) {
      durable.setError(inputMessage(e, "No se pudo recuperar."));
    }
  };
  if (!permissions.includes("documento.ver")) return null;
  return (
    <fieldset
      style={{ border: "1px solid #8b7ca455", padding: 12, borderRadius: 8 }}
    >
      <legend>Diseño versionado y copias internas</legend>
      <label>
        Plantilla{" "}
        <select
          value={selection}
          disabled={durable.busy}
          onChange={(e) => {
            setSelection(e.target.value);
            setVersion(
              templates.find((t) => t.id === e.target.value)?.version ?? 0,
            );
          }}
        >
          <option value="">Diseño básico protegido</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {selection && (
        <label>
          Versión{" "}
          <select
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
          >
            {templates
              .find((t) => t.id === selection)
              ?.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Ejemplar{" "}
        <select
          value={copy}
          onChange={(e) => setCopy(e.target.value as typeof copy)}
        >
          <option value="original">Original</option>
          <option value="duplicado">Duplicado</option>
        </select>
      </label>
      {durable.error && <p role="alert">{durable.error}</p>}
      {durable.pending && (
        <button disabled={durable.busy} onClick={() => void recover()}>
          Recuperar intento de documento
        </button>
      )}
      <div>
        {["Vista previa", "Descargar PDF", "Imprimir"].map((text, i) => (
          <button
            key={text}
            disabled={
              durable.busy ||
              !!durable.pending ||
              !permissions.includes("documento.emitir") ||
              (i > 0 && !permissions.includes("documento.imprimir"))
            }
            onClick={() => void emit(i === 2, i === 1)}
          >
            {text}
          </button>
        ))}
      </div>
      {issued && (
        <p>
          {issued.numero} · {issued.ejemplar} · revisión {issued.sourceVersion}.
          La reimpresión conserva su snapshot y no consume otro número.
        </p>
      )}
      {issued && (
        <details>
          <summary>Historial del documento</summary>
          {issued.events.map((e, i) => (
            <p key={i}>
              {documentEventDate(e.fecha)} · {e.usuario} ·{" "}
              {documentEventLabel(e.accion)}
            </p>
          ))}
        </details>
      )}
      {preview?.pages.map((page, i) => (
        <img
          key={i}
          src={page}
          alt={`Documento interno, página ${i + 1}`}
          style={{ width: 450, maxWidth: "100%" }}
        />
      ))}
    </fieldset>
  );
}
