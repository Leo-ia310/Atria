"use client";
import {inputMessage,documentEventDate,documentEventLabel} from '../../lib/document-display';
import './documents.css';
import {DocumentPrintControls} from './DocumentPrintControls';
import type {DocumentTransport} from './DocumentDesigner';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  commercialCommandSchema,
  commercialAmounts,
  commercialStates,
  type CommercialCommand,
  type CommercialDocument,
  type CommercialDraft,
  type CommercialKind,
  type CommercialResult,
} from "../../lib/commercial-core";
import {
  renderCommercialPdf,
  type CommercialPdf,
} from "../../lib/commercial-pdf";

type Props = {
  documentSend?:DocumentTransport;
  contextId?: string;
  kind: CommercialKind;
  branches: Array<{ id: string; nombre: string }>;
  send: (c: CommercialCommand) => Promise<CommercialResult>;
  output?: (pdf: CommercialPdf, name: string, print: boolean) => Promise<void>;
};
const editable = (s: CommercialDocument["snapshot"]): CommercialDraft => ({
  sucursalId: s.sucursalId,
  clienteId: s.clienteId,
  fecha: s.fecha,
  vigenteHasta: s.vigenteHasta,
  moneda: s.moneda,
  condicionesPago: s.condicionesPago,
  condicionesComerciales: s.condicionesComerciales,
  observaciones: s.observaciones,
  items: s.items.map(
    ({ productoId, cantidad, precioUnitario, descuento, tasa }) => ({
      productoId,
      cantidad,
      precioUnitario,
      descuento,
      tasa,
    }),
  ),
});
const labels: Record<string, string> = {
  cantidad: "Cantidad",
  precioUnitario: "Precio unitario",
  descuento: "Descuento de la línea",
  tasa: "Tasa estimada (0.15 = 15%)",
  condicionesPago: "Condiciones de pago",
  condicionesComerciales: "Condiciones comerciales",
  observaciones: "Observaciones",
  items: "Productos / servicios e importes",
  amounts: "Totales",
  issuer: "Datos del emisor",
  vendedor: "Preparado por",
  documental: "Datos documentales",
  fecha: "Fecha",
  vigenteHasta: "Vigencia",
  moneda: "Moneda",
  cliente: "Cliente",
  clienteId: "Cliente",
  sucursalId: "Sucursal",
};
const blank = (branch: string): CommercialDraft => ({
  sucursalId: branch,
  clienteId: null,
  fecha: new Date().toLocaleDateString("sv-SE"),
  vigenteHasta: null,
  moneda: "NIO",
  condicionesPago: "",
  condicionesComerciales: "",
  observaciones: "",
  items: [],
});
export function CommercialWorkspace({
  kind,
  branches,
  send,
  output,
  documentSend,
  contextId = "isolated-test",
}: Props) {
  const [branch, setBranch] = useState(branches[0]?.id ?? ""),
    [documents, setDocuments] = useState<CommercialDocument[]>([]),
    [selected, setSelected] = useState<CommercialDocument | null>(null);
  const branchKey=branches.map(b=>b.id).join(',');
  useEffect(()=>{if(!branches.some(b=>b.id===branch))setBranch(branches[0]?.id??'');},[branchKey,branch]);
  const [options, setOptions] =
      useState<Extract<CommercialResult, { ok: true }>["options"]>(),
    [draft, setDraft] = useState<CommercialDraft | null>(null),
    [editing, setEditing] = useState(false);
  const [draftVersion, setDraftVersion] = useState<number | undefined>(),
    [editAction, setEditAction] = useState<"edit" | "revise">("edit");
  const [cached, setCached] = useState(false),
    [pendingNonce, setPendingNonce] = useState<string | null>(null);
  const pendingKey = `arca:commercial-attempt:${contextId}:${kind}:${branch}`;
  useEffect(() => {
    setPendingNonce(localStorage.getItem(pendingKey));
  }, [pendingKey]);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState<CommercialCommand | null>(null);
  const [format, setFormat] = useState<"carta" | "media-carta">("carta"),
    [pdf, setPdf] = useState<CommercialPdf | null>(null),
    [revision, setRevision] = useState<number | null>(null);
  const [transition, setTransition] = useState(""),
    [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState("");
  const [cashSession,setCashSession]=useState("");
  const [warehouse, setWarehouse] = useState(""),
    [method, setMethod] = useState(""),
    [credit, setCredit] = useState(false),
    [days, setDays] = useState(30);
  const [profile, setProfile] = useState("configuracion_pendiente"),
    [ruc, setRuc] = useState("");
  const inFlight = useRef(false),
    scope = useRef(0);
  const can = (p: string) =>
    !cached &&
    !pendingNonce &&
    (options?.permissions.includes(`${kind}.${p}`) ?? false);
  const command = useCallback(
    (data: Partial<CommercialCommand>) =>
      commercialCommandSchema.parse({
        requestId: crypto.randomUUID(),
        kind,
        sucursalId: branch,
        ...data,
      }),
    [kind, branch],
  );
  const refresh = useCallback(async () => {
    const generation = ++scope.current;
    if (!branch) return;
    try {
      const [list, opts] = await Promise.all([
        send(
          command({
            action: "list",
            query,
            filter: filter
              ? (filter as CommercialCommand["filter"])
              : undefined,
            offset,
          }),
        ),
        send(command({ action: "options" })),
      ]);
      if (scope.current !== generation) return;
      if (!list.ok) throw new Error(list.error);
      setCached(!!list.cached);
      setDocuments(list.documents ?? []);
      setSelected(
        (current) =>
          list.documents?.find((d) => d.id === current?.id) ?? current,
      );
      if (opts.ok && opts.options) {
        setOptions(opts.options);
        setProfile(opts.options.profile.perfil);
        setRuc(opts.options.profile.ruc ?? "");
        setWarehouse((v) => v || opts.options!.warehouses[0]?.id || "");
        setCashSession(v=>(opts.options!.sessions??[]).some(s=>s.id===v)?v:opts.options!.sessions?.[0]?.id??"");
        setMethod(
          (v) =>
            v ||
            opts.options!.methods.find((m) =>
              /^(EFE|efectivo|cash)$/i.test(m.codigo),
            )?.id ||
            "",
        );
      }
    } catch (e) {
      if (scope.current === generation)
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, [branch, command, send, query, filter, offset]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setSelected(null);
    setDocuments([]);
    setOptions(undefined);
    setDraft(null);
    setPdf(null);
    setRevision(null);
    setRetry(null);
    setWarehouse("");setCashSession("");
    setMethod("");
  }, [branch, kind]);
  const perform = async (c: CommercialCommand) => {
    if (inFlight.current) return null;
    if (
      pendingNonce &&
      c.requestId !== pendingNonce &&
      c.action !== "recover"
    ) {
      setError("Recupera el intento pendiente antes de iniciar otro.");
      return null;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (c.action !== "recover") {
        localStorage.setItem(pendingKey, c.requestId);
        setPendingNonce(c.requestId);
      }
      const result = await send(c);
      if (!result.ok) {
        setError(result.error);
        setRetry(null);
        if (c.action !== "recover") {
          localStorage.removeItem(pendingKey);
          setPendingNonce(null);
        }
        return null;
      }
      localStorage.removeItem(pendingKey);
      setPendingNonce(null);
      if (result.discarded)
        setError(
          "El intento no estaba confirmado y quedó descartado sin efectos. Puedes volver a trabajar.",
        );
      setRetry(null);
      if (result.document && result.document.kind === kind) {
        setSelected(result.document);
        setRevision(null);
        setPdf(null);
      }
      await refresh();
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sin confirmación; reintenta la misma operación.",
      );
      setRetry(c);
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const run = async (c: CommercialCommand) => {
    if (!navigator.locks) {
      setError(
        "Abre ARCA en un contexto seguro para proteger los intentos comerciales.",
      );
      return null;
    }
    return navigator.locks.request(
      pendingKey + ":lock",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          setError(
            "Hay un intento activo en otra ventana. Espera su confirmación.",
          );
          return null;
        }
        const pending = localStorage.getItem(pendingKey);
        if (pending && pending !== c.requestId && c.action !== "recover") {
          setPendingNonce(pending);
          setError("Recupera el intento pendiente antes de iniciar otro.");
          return null;
        }
        return perform(c);
      },
    );
  };
  const mutate = async (
    action: CommercialCommand["action"],
    extra: Partial<CommercialCommand> = {},
  ) => {
    try {
      return await run(
        command({
          action,
          id: selected?.id,
          expectedVersion: selected?.version,
          ...extra,
        }),
      );
    } catch (e) {
      setError(inputMessage(e,"Revisa el formulario."));
      return null;
    }
  };
  const totals = (() => {
    try {
      return draft ? commercialAmounts(draft).amounts : null;
    } catch {
      return null;
    }
  })();
  const render = async (print: boolean, download: boolean) => {
    if (!selected) return;
    setError("");
    try {
      const current = revision
        ? {
            ...selected,
            version: revision,
            snapshot: selected.revisions.find((r) => r.version === revision)!
              .snapshot,
          }
        : selected;
      const generated = await renderCommercialPdf(current, format);
      // Audit the selected revision, including old immutable snapshots, without a state transition.
      const result = await mutate(print ? "print" : "pdf", {
        documentVersion: current.version,
        reason: revision ? `Reimpresión de revisión ${revision}` : "",
      });
      if (!result) return;
      setPdf(generated);
      if (output && (print || download))
        await output(
          generated,
          `${current.kind}-${current.numero}-r${current.version}.pdf`,
          print,
        );
      else if (download) {
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(generated.bytes)], {
            type: "application/pdf",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${current.kind}-${current.numero}-r${current.version}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else if (print) {
        const frame = document.createElement("iframe");
        frame.style.display = "none";
        document.body.append(frame);
        const doc = frame.contentDocument;
        if (!doc) throw new Error("No se pudo abrir el área de impresión.");
        const style = doc.createElement("style");
        style.textContent = `@page{size:${format === "carta" ? "letter" : "8.5in 5.5in"};margin:0}body{margin:0}img{width:100%;display:block;break-after:page}img:last-child{break-after:auto}`;
        doc.head.append(style);
        await Promise.all(
          generated.pages.map(async (page) => {
            const image = doc.createElement("img");
            image.src = page;
            doc.body.append(image);
            await image.decode();
          }),
        );
        frame.contentWindow?.print();
        setTimeout(() => frame.remove(), 120000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    }
  };
  const style: React.CSSProperties = {
    padding: 12,
    border: "1px solid #8b7ca455",
    borderRadius: 8,
    background: "var(--bg-card, transparent)",
    color: "inherit",
  };
  return (
    <section
      className="arca-document-editor"
      aria-label={kind === "cotizacion" ? "Cotizaciones" : "Proformas"}
      style={{ display: "grid", gap: 16 }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>
        {kind === "cotizacion" ? "Cotizaciones" : "Proformas"}
      </h1>
      <p>
        Ofertas comerciales. No generan ventas, inventario, caja ni
        contabilidad. Aceptación y conversión requieren conexión.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label>
          Sucursal{" "}
          <select
            aria-label="Sucursal comercial"
            disabled={busy}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={style}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>
        <input
          aria-label="Buscar documentos"
          placeholder="Número o cliente"
          value={query}
          onChange={(e) => {
            setOffset(0);
            setQuery(e.target.value);
          }}
          style={style}
        />
        <select
          aria-label="Estado"
          value={filter}
          onChange={(e) => {
            setOffset(0);
            setFilter(e.target.value);
          }}
          style={style}
        >
          <option value="">Todos los estados</option>
          {commercialStates.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button disabled={busy} onClick={() => void refresh()} style={style}>
          Actualizar
        </button>
        <button
          disabled={busy || !can("crear")}
          className="arca-btn arca-btn-primary"
          style={style}
          onClick={() => {
            setDraft(blank(branch));
            setEditing(false);
            setSelected(null);
          }}
        >
          Crear {kind}
        </button>
      </div>
      {cached && (
        <p role="status">
          Consulta de datos descargados. Pueden estar desactualizados; editar,
          aceptar y convertir requiere conexión.
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "#ef6464" }}>
          {error}
        </p>
      )}
      {retry && (
        <button style={style} disabled={busy} onClick={() => void run(retry)}>
          Recuperar / reintentar el mismo intento
        </button>
      )}
      {pendingNonce && !retry && (
        <button
          style={style}
          disabled={busy}
          onClick={() =>
            void run(command({ action: "recover", attemptId: pendingNonce }))
          }
        >
          Recuperar intento pendiente de confirmación
        </button>
      )}
      {busy && <p role="status">Guardando…</p>}
      <table>
        <thead>
          <tr>
            {["Número", "Cliente", "Versión", "Estado", "Total", ""].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {!busy && !error && documents.length === 0 && (
            <tr><td colSpan={6} className="arca-commercial-empty">
              {kind === "cotizacion" ? "No hay cotizaciones para esta búsqueda." : "No hay proformas para esta búsqueda."}
            </td></tr>
          )}
          {documents.map((d) => (
            <tr key={d.id}>
              <td>{d.numero}</td>
              <td>{d.snapshot.cliente?.nombre || "Genérica"}</td>
              <td>{d.version}</td>
              <td>{d.estado}</td>
              <td>
                {d.snapshot.moneda} {d.snapshot.amounts.total.toFixed(2)}
              </td>
              <td>
                <button
                  style={style}
                  onClick={() => {
                    setSelected(d);
                    setDraft(null);
                    setPdf(null);
                    setRevision(null);
                  }}
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button
          disabled={!offset || busy}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Anterior
        </button>{" "}
        <button
          disabled={documents.length < 50 || busy}
          onClick={() => setOffset(offset + 50)}
        >
          Siguiente
        </button>
      </div>
      {draft && (
        <form
          style={{ display: "grid", gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              const r = await mutate(editing ? editAction : "create", {
                draft,
                expectedVersion: editing ? draftVersion : undefined,
              });
              if (r) setDraft(null);
            })();
          }}
        >
          <h2>{editing ? "Guardar nueva revisión" : "Nuevo documento"}</h2>
          <p>
            La proforma derivada y su cotización comparten revisión y estado.
          </p>
          <label>
            Cliente opcional{" "}
            <select
              value={draft.clienteId ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, clienteId: e.target.value || null })
              }
              style={style}
            >
              <option value="">Genérica / sin cliente</option>
              {options?.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha{" "}
            <input
              required
              type="date"
              value={draft.fecha}
              onChange={(e) => setDraft({ ...draft, fecha: e.target.value })}
            />
          </label>
          <label>
            Vigencia{" "}
            <input
              type="date"
              value={draft.vigenteHasta ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, vigenteHasta: e.target.value || null })
              }
            />
          </label>
          <label>
            Moneda{" "}
            <select
              value={draft.moneda}
              onChange={(e) =>
                setDraft({ ...draft, moneda: e.target.value as "NIO" | "USD" })
              }
            >
              <option>NIO</option>
              <option>USD</option>
            </select>
          </label>
          <select
            aria-label="Agregar producto o servicio"
            value=""
            style={style}
            onChange={(e) => {
              const p = options?.products.find((p) => p.id === e.target.value);
              if (p)
                setDraft({
                  ...draft,
                  items: [
                    ...draft.items,
                    {
                      productoId: p.id,
                      cantidad: 1,
                      precioUnitario: Number(p.precio),
                      descuento: 0,
                      tasa: p.tasa,
                    },
                  ],
                });
            }}
          >
            <option value="">Agregar producto / servicio</option>
            {options?.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {draft.items.map((line, index) => (
            <div
              key={index}
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              <span>
                {options?.products.find((p) => p.id === line.productoId)
                  ?.nombre || line.productoId}
              </span>
              {(
                ["cantidad", "precioUnitario", "descuento", "tasa"] as const
              ).map((field) => (
                <label key={field}>
                  {labels[field]}
                  <input
                    aria-label={`${field} ${index + 1}`}
                    style={{ ...style, width: 110 }}
                    type="number"
                    step="0.0001"
                    min="0"
                    value={line[field]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((l, i) =>
                          i === index
                            ? { ...l, [field]: Number(e.target.value) }
                            : l,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    items: draft.items.filter((_, i) => i !== index),
                  })
                }
              >
                Quitar
              </button>
            </div>
          ))}
          {(
            [
              "condicionesPago",
              "condicionesComerciales",
              "observaciones",
            ] as const
          ).map((field) => (
            <label key={field}>
              {labels[field]}
              <textarea
                style={{ ...style, width: "100%" }}
                value={draft[field]}
                onChange={(e) =>
                  setDraft({ ...draft, [field]: e.target.value })
                }
              />
            </label>
          ))}
          <strong>
            Total: {totals?.total.toFixed(2) ?? "Revisa importes"}
          </strong>
          <button
            style={style}
            disabled={busy || !draft.items.length || !!retry}
          >
            Guardar borrador
          </button>
          <button type="button" onClick={() => setDraft(null)}>
            Cancelar edición
          </button>
        </form>
      )}
      {selected && !draft && (
        <article style={{ ...style, display: "grid", gap: 12 }}>
          <h2>
            {selected.numero} · revisión {selected.version} · {selected.estado}
          </h2>
          <p>
            {selected.snapshot.cliente?.nombre || "Sin cliente"} ·{" "}
            {selected.snapshot.moneda}{" "}
            {selected.snapshot.amounts.total.toFixed(2)}
          </p>
          {selected.snapshot.items.map((l, i) => (
            <p key={i}>
              {l.nombre} · {l.cantidad} × {l.precioUnitario} · descuento{" "}
              {l.descuento} · impuesto {l.impuesto} · total {l.total}
            </p>
          ))}
          <p>{selected.snapshot.condicionesPago}</p>
          <p>{selected.snapshot.condicionesComerciales}</p>
          <p>{selected.snapshot.observaciones}</p>
          <div>
            <button
              style={style}
              disabled={
                busy || !can("editar") || selected.estado === "convertida"
              }
              onClick={() => {
                setDraft(editable(selected.snapshot));
                setDraftVersion(selected.version);
                setEditAction(
                  selected.estado === "borrador" ? "edit" : "revise",
                );
                setEditing(true);
              }}
            >
              {selected.estado === "borrador"
                ? "Editar borrador"
                : "Nueva revisión"}
            </button>{" "}
            <button
              style={style}
              disabled={busy || !can("duplicar")}
              onClick={() => void mutate("duplicate")}
            >
              Duplicar como oferta nueva
            </button>{" "}
            {kind === "cotizacion" && (
              <button
                style={style}
                disabled={
                  busy || !options?.permissions.includes("proforma.crear")
                }
                onClick={() =>
                  void mutate("derive").then((r) => {
                    if (r)
                      setError(
                        "Proforma creada. Abre Proformas para consultarla.",
                      );
                  })
                }
              >
                Crear proforma derivada
              </button>
            )}
          </div>
          <fieldset>
            <legend>Registrar estado</legend>
            <select
              aria-label="Nuevo estado"
              value={transition}
              onChange={(e) => setTransition(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {["enviada", "aceptada", "rechazada", "vencida"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>{" "}
            <input
              aria-label="Motivo"
              placeholder="Motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />{" "}
            <input
              aria-label="Evidencia de entrega"
              placeholder="Evidencia de entrega"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            <button
              disabled={busy || !transition}
              onClick={() =>
                void mutate("state", {
                  state: transition as CommercialCommand["state"],
                  reason,
                  evidence,
                })
              }
            >
              Registrar
            </button>
          </fieldset>
          <fieldset>
            <legend>Conversión online completa</legend>
            <label>Turno original de caja <select value={cashSession} onChange={e=>setCashSession(e.target.value)}><option value="">Seleccionar turno abierto</option>{options?.sessions?.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
              <label>
              Almacén{" "}
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {options?.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              <input
                type="checkbox"
                checked={credit}
                onChange={(e) => setCredit(e.target.checked)}
              />
              Crédito
            </label>
            {credit ? (
              <label>
                Días{" "}
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
            ) : (
              <label>
                Forma de pago{" "}
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="">Seleccionar efectivo</option>
                  {options?.methods
                    .filter((m) => /^(EFE|efectivo|cash)$/i.test(m.codigo))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button
              style={style}
              disabled={
                busy ||
                !!retry ||
                !can("convertir") ||
                !warehouse ||!cashSession ||
                (!credit && !method) ||
                !["aceptada", "convertida"].includes(selected.estado)
              }
              onClick={() =>
                void mutate("convert", {
                  settlement: {
                    almacenId: warehouse,
                    sesionCajaId:cashSession,
                    esCredito: credit,
                    diasCredito: credit ? days : 0,
                    pagos: credit
                      ? []
                      : [
                          {
                            formaPagoId: method,
                            monto: selected.snapshot.amounts.total,
                          },
                        ],
                  },
                })
              }
            >
              {selected.ventaId ? "Recuperar venta" : "Convertir a venta"}
            </button>
            {selected.ventaId && <p>Venta: {selected.ventaId}</p>}
          </fieldset>
          <div>
            <select
              aria-label="Formato PDF"
              value={format}
              onChange={(e) => {
                setPdf(null);
                setFormat(e.target.value as typeof format);
              }}
            >
              <option value="carta">Carta</option>
              <option value="media-carta">Media carta</option>
            </select>{" "}
            <select
              aria-label="Revisión PDF"
              value={revision ?? selected.version}
              onChange={(e) => {
                setRevision(Number(e.target.value));
                setPdf(null);
              }}
            >
              {selected.revisions.map((r) => (
                <option key={r.version} value={r.version}>
                  Revisión {r.version}
                </option>
              ))}
            </select>{" "}
            {["Vista previa", "Descargar PDF", "Imprimir"].map((label, i) => (
              <button
                key={label}
                style={style}
                disabled={busy || !can("imprimir")}
                onClick={() => void render(i === 2, i === 1)}
              >
                {label}
              </button>
            ))}
          </div>
          {pdf?.pages.map((p, i) => (
            <img
              key={i}
              src={p}
              alt={`Vista previa página ${i + 1}`}
              style={{ width: 500, maxWidth: "100%", border: "1px solid #ccc" }}
            />
          ))}
          {documentSend&&<DocumentPrintControls key={`${contextId}:${selected.id}:${revision??selected.version}`} contextId={contextId} branch={selected.snapshot.sucursalId} sourceKind={kind} sourceId={selected.id} sourceVersion={revision??selected.version} send={documentSend} output={output}/>}
          <h3>Historial inmutable</h3>
          {selected.events.map((ev, i) => (
            <p key={i}>
              {documentEventDate(ev.fecha)} · {ev.usuario} · {documentEventLabel(ev.accion)} · revisión {ev.version}
              {ev.changed?.length
                ? " · cambios: " +
                  ev.changed.map((field) => labels[field] || field).join(", ")
                : ""}
              {ev.motivo ? " · " + ev.motivo : ""}
              {ev.deviceId ? " · equipo " + ev.deviceId : ""}
            </p>
          ))}
        </article>
      )}
      {options?.permissions.includes("documental.configurar") && (
        <fieldset>
          <legend>Perfil documental (emisión fiscal deshabilitada)</legend>
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {["no_registrado", "configuracion_pendiente", "registrado"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
          <input
            aria-label="RUC opcional"
            placeholder="RUC; solo obligatorio si registrado"
            value={ruc}
            onChange={(e) => setRuc(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={() =>
              void run(
                command({
                  action: "profile",
                  profile: {
                    perfil: profile as "registrado",
                    ruc: ruc || null,
                  },
                }),
              )
            }
          >
            Guardar perfil
          </button>
          <p>
            Cambiar el perfil no modifica documentos anteriores ni habilita
            documentos fiscales.
          </p>
        </fieldset>
      )}
    </section>
  );
}
