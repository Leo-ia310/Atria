"use client";
import "./documents.css";
import { useEffect, useState } from "react";
import {
  procurementSchema,
  type ProcurementCommand,
  type ProcurementResult,
  type RFQInput,
  type OfferInput,
  type PurchaseConfig,
} from "../../lib/procurement-core";
import { useDurableCommand } from "./useDurableCommand";
export type ProcurementTransport = (
  command: ProcurementCommand,
) => Promise<ProcurementResult>;
type Success = Extract<ProcurementResult, { ok: true }>;
type Props = {
  contextId: string;
  branches: Array<{ id: string; nombre: string }>;
  send: ProcurementTransport;
  onWorkChange?: (active: boolean) => void;
};
const date = () => new Date().toISOString().slice(0, 10),
  fmt = (n: unknown) =>
    Number(n ?? 0).toLocaleString("es-NI", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
export function ProcurementWorkspace(p: Props) {
  const [branch, B] = useState(p.branches[0]?.id ?? "");
  useEffect(() => {
    if (!p.branches.some((b) => b.id === branch)) B(p.branches[0]?.id ?? "");
  }, [p.branches, branch]);
  return (
    <section className="arca-document-editor">
      <h1>Abastecimiento y cuentas por pagar</h1>
      <label>
        Sucursal{" "}
        <select value={branch} onChange={(e) => B(e.target.value)}>
          {p.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      {branch && (
        <Workspace key={p.contextId + branch} {...p} branch={branch} />
      )}
    </section>
  );
}
function Workspace(p: Props & { branch: string }) {
  const [data, D] = useState<Success>(),
    [detail, S] = useState<Success["detail"]>(),
    [kind, K] = useState<"rfq" | "order">("rfq"),
    [tab, T] = useState("rfqs"),
    [search, Q] = useState(""),
    [status, ST] = useState(""),
    [dirty, Dirty] = useState(false),
    [message, M] = useState("");
  const durable = useDurableCommand(
      "arca:procurement:" + p.contextId + ":" + p.branch,
      p.send,
    ),
    command = (x: Partial<ProcurementCommand>) =>
      procurementSchema.parse({
        requestId: crypto.randomUUID(),
        sucursalId: p.branch,
        ...x,
      });
  const load = async () => {
    try {
      const r = await p.send(command({ action: "list" }));
      if (!r.ok) throw new Error(r.error);
      D(r);
    } catch (e) {
      durable.setError(
        e instanceof Error ? e.message : "No se pudieron cargar los datos.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    p.onWorkChange?.(dirty || durable.busy || Boolean(durable.pending));
    return () => p.onWorkChange?.(false);
  }, [dirty, durable.busy, durable.pending]);
  const perms = data?.permissions ?? [],
    can = (key: string) => perms.includes(key),
    opts = data?.options;
  const open = async (type: "rfq" | "order", id: string) => {
    try {
      const r = await p.send(command({ action: type, id }));
      if (!r.ok) throw new Error(r.error);
      K(type);
      S(r.detail);
      Dirty(false);
    } catch (e) {
      durable.setError(String(e));
    }
  };
  const run = async (x: Partial<ProcurementCommand>) => {
    try {
      const r = await durable.run(command(x));
      if (r) {
        M(r.reason ?? "Operación confirmada.");
        Dirty(false);
        await load();
        if (detail) await open(kind, detail.header.id);
      }
      return r;
    } catch (e) {
      durable.setError(String(e));
      return null;
    }
  };
  const [rfq, R] = useState<RFQInput>({
      titulo: "",
      vigenteHasta: date(),
      condiciones: "",
      proveedorIds: [],
      items: [],
    }),
    [product, P] = useState(""),
    [qty, N] = useState(1);
  const [vendor, V] = useState(""),
    [offer, O] = useState<OfferInput>(),
    [offerId, OI] = useState<string>(),
    [offerVersion, OV] = useState<number>(),
    [reason, RE] = useState(""),
    [evidence, E] = useState(""),
    [medium, ME] = useState<"correo" | "whatsapp" | "personal" | "otro">(
      "personal",
    );
  const [warehouse, W] = useState(""),
    [fecha, F] = useState(date()),
    [due, DU] = useState(date()),
    [number, NU] = useState(""),
    [series, SE] = useState(""),
    [declared, DE] = useState(0),
    [lines, L] = useState<NonNullable<ProcurementCommand["lines"]>>([]),
    [receipt, RC] = useState(""),
    [mode, MO] = useState<"receive" | "invoice" | "return">("receive");
  const [supplierDocumentType, SDT] = useState<"factura" | "recibo" | "otro">(
    "factura",
  );
  const [supplier, SP] = useState(""),
    [statement, SS] = useState<Success["statement"]>(),
    [debt, DB] = useState(""),
    [amount, A] = useState(0),
    [financial, FI] = useState(""),
    [session, CS] = useState(""),
    [confirmed, CF] = useState(false),
    [terminal, TE] = useState(false),
    [authorization, AU] = useState("");
  const [cfg, C] = useState<PurchaseConfig>();
  useEffect(() => {
    if (opts?.config) C(opts.config);
  }, [opts?.config]);
  const startOffer = (
    existing?: NonNullable<NonNullable<Success["detail"]>["offers"]>[number],
  ) => {
    if (!detail) return;
    const source = detail.snapshot.items as Array<{
      id: string;
      cantidad: number;
    }>;
    V(existing?.proveedorId ?? "");
    OI(existing?.id);
    OV(existing?.revision);
    O(
      existing
        ? (Object.fromEntries(
            [
              "moneda",
              "tipoCambio",
              "fechaCambio",
              "fuenteCambio",
              "vigenteHasta",
              "plazoDias",
              "garantia",
              "condiciones",
              "referencia",
              "flete",
              "tasaFlete",
            ]
              .map((k) => [k, existing.snapshot[k]])
              .concat([
                [
                  "items",
                  (existing.snapshot.items as OfferInput["items"]).map((l) => ({
                    rfqLineId: l.rfqLineId,
                    cantidad: l.cantidad,
                    precioUnitario: l.precioUnitario,
                    descuento: l.descuento,
                    tasa: l.tasa,
                  })),
                ],
              ]),
          ) as OfferInput)
        : {
            moneda: opts?.currency ?? "NIO",
            tipoCambio: 1,
            fechaCambio: date(),
            fuenteCambio: "",
            vigenteHasta: date(),
            plazoDias: 0,
            garantia: "",
            condiciones: "",
            referencia: "",
            flete: 0,
            tasaFlete: 0,
            items: source.map((l) => ({
              rfqLineId: l.id,
              cantidad: l.cantidad,
              precioUnitario: 0,
              descuento: 0,
              tasa: 0,
            })),
          },
    );
  };
  const startPhysical = (
    m: typeof mode,
    r?: NonNullable<NonNullable<Success["detail"]>["receipts"]>[number],
  ) => {
    MO(m);
    RC(r?.id ?? "");
    L(
      r
        ? r.items.map((l) => ({ lineId: l.id, cantidad: 0, motivo: "" }))
        : (detail?.lines ?? []).map((l) => ({
            lineId: l.id,
            aceptada: 0,
            rechazada: 0,
            cantidad: 0,
            motivo: "",
          })),
    );
  };
  const options = (rows: Array<{ id: string; nombre: string }> | undefined) => (
    <>
      <option value="">Selecciona</option>
      {rows?.map((r) => (
        <option key={r.id} value={r.id}>
          {r.nombre}
        </option>
      ))}
    </>
  );
  const updateLine = (i: number, k: string, v: unknown) => {
    Dirty(true);
    L(lines.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  };
  const queryStatement = async () => {
    try {
      const r = await p.send(
        command({ action: "statement", proveedorId: supplier }),
      );
      if (!r.ok) throw new Error(r.error);
      SS(r.statement);
    } catch (e) {
      durable.setError(String(e));
    }
  };
  return (
    <>
      <p>
        Las solicitudes, ofertas y OC no afectan existencias ni deuda. Las
        recepciones y facturas se confirman por separado.
      </p>
      {data?.cached && (
        <p role="status">
          Consulta descargada sin conexión. Las confirmaciones requieren
          internet.
        </p>
      )}
      <nav>
        {[
          "rfqs",
          "orders",
          "receipts",
          "invoices",
          "returns",
          "cxp",
          "config",
        ].map((t) => (
          <button
            key={t}
            onClick={() => {
              T(t);
              S(undefined);
            }}
          >
            {
              {
                rfqs: "Solicitudes",
                orders: "Órdenes de compra",
                receipts: "Recepciones",
                invoices: "Facturas de proveedores",
                returns: "Devoluciones",
                cxp: "CxP y aging",
                config: "Configuración",
              }[t]
            }
          </button>
        ))}
        <button onClick={() => void load()}>Actualizar</button>
      </nav>
      {durable.error && <p role="alert">{durable.error}</p>}
      {message && <p role="status">{message}</p>}
      {durable.pending && (
        <button
          disabled={durable.busy}
          onClick={() =>
            void run({ action: "recover", attemptId: durable.pending! })
          }
        >
          Recuperar intento sin confirmar
        </button>
      )}
      {durable.retry && (
        <button
          disabled={durable.busy}
          onClick={() => void durable.run(durable.retry!)}
        >
          Reintentar mismo contenido
        </button>
      )}
      {data?.pendingAttempts?.map((a) => (
        <button
          key={a.requestId}
          onClick={() =>
            void run({ action: "recover", attemptId: a.requestId })
          }
        >
          Recuperar {a.action}
        </button>
      ))}
      {!detail &&
        ["rfqs", "orders", "receipts", "invoices", "returns"].includes(tab) && (
          <>
            <label>
              Buscar{" "}
              <input value={search} onChange={(e) => Q(e.target.value)} />
            </label>
            <label>
              Estado{" "}
              <input value={status} onChange={(e) => ST(e.target.value)} />
            </label>
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Contabilización</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data?.[
                    tab as
                      "rfqs" | "orders" | "receipts" | "invoices" | "returns"
                  ] ?? []
                )
                  .filter(
                    (r) =>
                      (r.numero + " " + r.nombre)
                        .toLowerCase()
                        .includes(search.toLowerCase()) &&
                      r.estado.includes(status),
                  )
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        {["rfqs", "orders"].includes(tab) ? (
                          <button
                            onClick={() =>
                              void open(tab === "rfqs" ? "rfq" : "order", r.id)
                            }
                          >
                            {r.numero}
                          </button>
                        ) : (
                          r.numero
                        )}
                      </td>
                      <td>{r.nombre}</td>
                      <td>{r.fecha}</td>
                      <td>{r.estado}</td>
                      <td>{r.total === undefined ? "—" : fmt(r.total)}</td>
                      <td>
                        {r.accountingStatus} {r.reason}
                        {r.accountingStatus === "pendiente" &&
                          can("cxp.configurar") && (
                            <button
                              onClick={() =>
                                void run({
                                  action:
                                    tab === "returns"
                                      ? "postReturn"
                                      : "postReceipt",
                                  id: r.id,
                                  motivo: reason,
                                  fecha,
                                })
                              }
                            >
                              Conciliar contabilización
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {["receipts", "returns"].includes(tab) && (
              <>
                <label>
                  Motivo de conciliación{" "}
                  <input value={reason} onChange={(e) => RE(e.target.value)} />
                </label>
                <label>
                  Fecha contable{" "}
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => F(e.target.value)}
                  />
                </label>
              </>
            )}
          </>
        )}
      {tab === "rfqs" && !detail && can("rfq.crear") && (
        <fieldset disabled={durable.busy || Boolean(durable.pending)}>
          <legend>Nueva solicitud</legend>
          <label>
            Título{" "}
            <input
              value={rfq.titulo}
              onChange={(e) => {
                R({ ...rfq, titulo: e.target.value });
                Dirty(true);
              }}
            />
          </label>
          <label>
            Vigencia{" "}
            <input
              type="date"
              value={rfq.vigenteHasta}
              onChange={(e) => R({ ...rfq, vigenteHasta: e.target.value })}
            />
          </label>
          <label>
            Condiciones{" "}
            <textarea
              value={rfq.condiciones}
              onChange={(e) => R({ ...rfq, condiciones: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Proveedores invitados</legend>
            {opts?.suppliers
              .filter((s) => s.active !== false)
              .map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={rfq.proveedorIds.includes(s.id)}
                    onChange={(e) =>
                      R({
                        ...rfq,
                        proveedorIds: e.target.checked
                          ? [...rfq.proveedorIds, s.id]
                          : rfq.proveedorIds.filter((id) => id !== s.id),
                      })
                    }
                  />
                  {s.nombre}
                </label>
              ))}
          </fieldset>
          <select value={product} onChange={(e) => P(e.target.value)}>
            {options(opts?.products)}
          </select>
          <label>
            Cantidad{" "}
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={qty}
              onChange={(e) => N(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() => {
              if (product && qty > 0) {
                R({
                  ...rfq,
                  items: [
                    ...rfq.items,
                    { productoId: product, cantidad: qty, descripcion: "" },
                  ],
                });
                Dirty(true);
              }
            }}
          >
            Agregar producto
          </button>
          {rfq.items.map((l, i) => (
            <p key={i}>
              {opts?.products.find((p) => p.id === l.productoId)?.nombre} ·{" "}
              {l.cantidad}{" "}
              <button
                onClick={() =>
                  R({ ...rfq, items: rfq.items.filter((_, n) => n !== i) })
                }
              >
                Quitar
              </button>
            </p>
          ))}
          <button
            onClick={() =>
              void run({ action: "createRFQ", rfq }).then((r) => {
                if (r?.id) void open("rfq", r.id);
              })
            }
          >
            Crear RFQ
          </button>
        </fieldset>
      )}
      {detail && (
        <>
          <button onClick={() => S(undefined)}>Volver al listado</button>
          <h2>{detail.header.numero}</h2>
          <p>
            {detail.header.estado} · versión {detail.header.version}
          </p>
          <label>
            Justificación / motivo{" "}
            <textarea value={reason} onChange={(e) => RE(e.target.value)} />
          </label>
          <label>
            Referencia / evidencia del original{" "}
            <input value={evidence} onChange={(e) => E(e.target.value)} />
          </label>
          {kind === "rfq" && (
            <>
              <h3>{String(detail.snapshot.titulo ?? "")}</h3>
              <p>
                Vigencia: {String(detail.snapshot.vigenteHasta ?? "")} ·{" "}
                {String(detail.snapshot.condiciones ?? "")}
              </p>
              {can("rfq.enviar") && (
                <>
                  <label>
                    Medio de entrega{" "}
                    <select
                      value={medium}
                      onChange={(e) => ME(e.target.value as typeof medium)}
                    >
                      <option value="personal">Personal</option>
                      <option value="correo">Correo</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="otro">Otro</option>
                    </select>
                  </label>
                  <button
                    onClick={() =>
                      void run({
                        action: "sendRFQ",
                        id: detail.header.id,
                        proveedorIds: detail.snapshot.proveedorIds as string[],
                        medio: medium,
                        evidencia: evidence,
                      })
                    }
                  >
                    Registrar entrega/intento a los proveedores invitados
                  </button>
                  <p>
                    Registra evidencia de una gestión realizada. ARCA no envía
                    mensajes automáticamente.
                  </p>
                </>
              )}
              <h3>Comparador de ofertas</h3>
              <p>
                Selección:{" "}
                {String(
                  detail.snapshot.selectionReason ??
                    "Sin proveedor seleccionado",
                )}{" "}
                ·{" "}
                {detail.snapshot.approved
                  ? "Aprobada"
                  : "Pendiente de aprobación"}
              </p>
              <table>
                <thead>
                  <tr>
                    {[
                      "Proveedor / versión",
                      "Moneda / cambio",
                      "Precio base",
                      "Descuento",
                      "Impuesto",
                      "Flete",
                      "Total funcional",
                      "Entrega",
                      "Garantía",
                      "Estado",
                      "Acciones",
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.offers?.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.proveedor} · v{o.revision}
                      </td>
                      <td>
                        {String(o.snapshot.moneda)} /{" "}
                        {String(o.snapshot.tipoCambio)}
                        <br />
                        {String(o.snapshot.fechaCambio)}{" "}
                        {String(o.snapshot.fuenteCambio)}
                      </td>
                      <td>
                        {(
                          o.snapshot.items as Array<{
                            rfqLineId: string;
                            precioUnitario: number;
                          }>
                        ).map((l) => (
                          <div key={l.rfqLineId}>
                            {String(
                              (
                                detail.snapshot.items as Array<{
                                  id: string;
                                  nombre: string;
                                }>
                              ).find((x) => x.id === l.rfqLineId)?.nombre,
                            )}
                            : {fmt(l.precioUnitario)}
                          </div>
                        ))}
                        Subtotal: {fmt(o.snapshot.originalBase)}
                      </td>
                      <td>
                        {fmt(
                          (
                            o.snapshot.items as Array<{ descuento: number }>
                          ).reduce((a, l) => a + l.descuento, 0),
                        )}
                      </td>
                      <td>{fmt(o.snapshot.originalTax)}</td>
                      <td>{fmt(o.snapshot.flete)}</td>
                      <td>
                        {fmt(o.snapshot.total)}{" "}
                        {String(o.snapshot.functionalCurrency)}
                      </td>
                      <td>{String(o.snapshot.plazoDias)} días</td>
                      <td>{String(o.snapshot.garantia)}</td>
                      <td>{o.estado}</td>
                      <td>
                        {can("oferta_proveedor.editar") && (
                          <button onClick={() => startOffer(o)}>
                            Nueva versión
                          </button>
                        )}
                        {(
                          [
                            "select",
                            "approveOffer",
                            "rejectOffer",
                            "createPO",
                          ] as const
                        ).map(
                          (action) =>
                            can(
                              {
                                select: "oferta_proveedor.comparar",
                                approveOffer: "oferta_proveedor.aprobar",
                                rejectOffer: "oferta_proveedor.rechazar",
                                createPO: "orden_compra.crear",
                              }[action],
                            ) && (
                              <button
                                key={action}
                                disabled={
                                  durable.busy || Boolean(durable.pending)
                                }
                                onClick={() =>
                                  void run({
                                    action,
                                    rfqId: detail.header.id,
                                    offerId: o.id,
                                    revision: o.revision,
                                    expectedVersion: detail.header.version,
                                    motivo: reason,
                                  }).then((r) => {
                                    if (action === "createPO" && r?.id)
                                      void open("order", r.id);
                                  })
                                }
                              >
                                {
                                  {
                                    select: "Seleccionar",
                                    approveOffer: "Aprobar",
                                    rejectOffer: "Rechazar",
                                    createPO: "Crear OC",
                                  }[action]
                                }
                              </button>
                            ),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {can("oferta_proveedor.registrar") && (
                <button onClick={() => startOffer()}>Registrar oferta</button>
              )}
              {offer && (
                <fieldset disabled={durable.busy || Boolean(durable.pending)}>
                  <legend>
                    {offerId
                      ? "Nueva revisión inmutable"
                      : "Oferta del proveedor"}
                  </legend>
                  <label>
                    Proveedor{" "}
                    <select
                      value={vendor}
                      disabled={Boolean(offerId)}
                      onChange={(e) => V(e.target.value)}
                    >
                      {options(
                        opts?.suppliers.filter((s) =>
                          (detail.snapshot.proveedorIds as string[]).includes(
                            s.id,
                          ),
                        ),
                      )}
                    </select>
                  </label>
                  {(
                    [
                      "moneda",
                      "fuenteCambio",
                      "garantia",
                      "condiciones",
                      "referencia",
                    ] as const
                  ).map((k) => (
                    <label key={k}>
                      {
                        {
                          moneda: "Moneda ISO",
                          fuenteCambio: "Fuente del cambio",
                          garantia: "Garantía",
                          condiciones: "Condiciones",
                          referencia: "Referencia de oferta",
                        }[k]
                      }{" "}
                      <input
                        value={offer[k]}
                        onChange={(e) => {
                          O({ ...offer, [k]: e.target.value });
                          Dirty(true);
                        }}
                      />
                    </label>
                  ))}
                  {(
                    ["tipoCambio", "plazoDias", "flete", "tasaFlete"] as const
                  ).map((k) => (
                    <label key={k}>
                      {
                        {
                          tipoCambio: "Tipo de cambio a moneda funcional",
                          plazoDias: "Días de entrega",
                          flete: "Flete",
                          tasaFlete: "Tasa de impuesto del flete (0–1)",
                        }[k]
                      }{" "}
                      <input
                        type="number"
                        step="any"
                        value={offer[k]}
                        onChange={(e) =>
                          O({ ...offer, [k]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  {(["fechaCambio", "vigenteHasta"] as const).map((k) => (
                    <label key={k}>
                      {k === "fechaCambio" ? "Fecha del cambio" : "Vigencia"}{" "}
                      <input
                        type="date"
                        value={offer[k]}
                        onChange={(e) => O({ ...offer, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                  {offer.items.map((l, i) => (
                    <fieldset key={l.rfqLineId}>
                      <legend>
                        {String(
                          (
                            detail.snapshot.items as Array<{
                              id: string;
                              nombre: string;
                            }>
                          ).find((x) => x.id === l.rfqLineId)?.nombre,
                        )}{" "}
                        · {l.cantidad}
                      </legend>
                      {(["precioUnitario", "descuento", "tasa"] as const).map(
                        (k) => (
                          <label key={k}>
                            {
                              {
                                precioUnitario: "Precio unitario",
                                descuento: "Descuento total de línea",
                                tasa: "Tasa de impuesto (0–1)",
                              }[k]
                            }{" "}
                            <input
                              type="number"
                              step="any"
                              value={l[k]}
                              onChange={(e) =>
                                O({
                                  ...offer,
                                  items: offer.items.map((x, n) =>
                                    n === i
                                      ? { ...x, [k]: Number(e.target.value) }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        ),
                      )}
                    </fieldset>
                  ))}
                  <button
                    onClick={() =>
                      void run({
                        action: "offer",
                        rfqId: detail.header.id,
                        id: offerId,
                        expectedVersion: offerVersion,
                        proveedorId: vendor,
                        offer,
                      }).then((r) => {
                        if (r) O(undefined);
                      })
                    }
                  >
                    Guardar revisión
                  </button>
                </fieldset>
              )}
            </>
          )}
          {kind === "order" && (
            <>
              <p>
                Proveedor: {String(detail.snapshot.proveedor)} · Total:{" "}
                {fmt(detail.snapshot.total)}{" "}
                {String(detail.snapshot.functionalCurrency)}
              </p>
              {can("orden_compra.aprobar") &&
                detail.header.estado === "pendiente_aprobacion" && (
                  <button
                    onClick={() =>
                      void run({
                        action: "approvePO",
                        orderId: detail.header.id,
                        expectedVersion: detail.header.version,
                      })
                    }
                  >
                    Aprobar orden de compra
                  </button>
                )}
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ordenado</th>
                    <th>Aceptado</th>
                    <th>Facturado</th>
                    <th>Pendiente</th>
                    <th>Devuelto</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines?.map((l) => (
                    <tr key={l.id}>
                      <td>{l.nombre}</td>
                      <td>{l.ordered}</td>
                      <td>{l.accepted}</td>
                      <td>{l.invoiced}</td>
                      <td>{l.available}</td>
                      <td>{l.returned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {can("recepcion.crear") && (
                <button onClick={() => startPhysical("receive")}>
                  Confirmar recepción
                </button>
              )}
              {can("cxp.configurar") && (
                <button onClick={() => startPhysical("invoice")}>
                  Registrar factura/documento
                </button>
              )}
              {detail.receipts?.map((r) => (
                <p key={r.id}>
                  {r.numero} · {r.accountingStatus}{" "}
                  {can("recepcion.devolver") && (
                    <button onClick={() => startPhysical("return", r)}>
                      Devolver mercancía
                    </button>
                  )}
                </p>
              ))}
              {lines.length > 0 && (
                <fieldset disabled={durable.busy || Boolean(durable.pending)}>
                  <legend>
                    {
                      {
                        receive: "Recepción física",
                        invoice: "Factura del proveedor: obligación única",
                        return:
                          "Devolución física: no reduce deuda automáticamente",
                      }[mode]
                    }
                  </legend>
                  <label>
                    Almacén{" "}
                    <select
                      value={warehouse}
                      onChange={(e) => W(e.target.value)}
                    >
                      {options(opts?.warehouses)}
                    </select>
                  </label>
                  <label>
                    Fecha{" "}
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => F(e.target.value)}
                    />
                  </label>
                  {mode === "invoice" && (
                    <>
                      <label>
                        Tipo de documento{" "}
                        <select
                          value={supplierDocumentType}
                          onChange={(e) =>
                            SDT(e.target.value as typeof supplierDocumentType)
                          }
                        >
                          <option value="factura">Factura del proveedor</option>
                          <option value="recibo">Recibo</option>
                          <option value="otro">Otro documento</option>
                        </select>
                      </label>
                      <label>
                        Número original{" "}
                        <input
                          value={number}
                          onChange={(e) => NU(e.target.value)}
                        />
                      </label>
                      <label>
                        Serie{" "}
                        <input
                          value={series}
                          onChange={(e) => SE(e.target.value)}
                        />
                      </label>
                      <label>
                        Vencimiento{" "}
                        <input
                          type="date"
                          value={due}
                          onChange={(e) => DU(e.target.value)}
                        />
                      </label>
                      <label>
                        Total declarado en moneda funcional{" "}
                        <input
                          type="number"
                          step="0.01"
                          value={declared}
                          onChange={(e) => DE(Number(e.target.value))}
                        />
                      </label>
                    </>
                  )}
                  {lines.map((l, i) => (
                    <fieldset key={l.lineId}>
                      <legend>
                        {detail.lines?.find((x) => x.id === l.lineId)?.nombre ??
                          detail.receipts
                            ?.flatMap((r) => r.items)
                            .find((x) => x.id === l.lineId)?.nombre}
                      </legend>
                      {(mode === "receive"
                        ? ["aceptada", "rechazada"]
                        : ["cantidad"]
                      ).map((k) => (
                        <label key={k}>
                          {k}{" "}
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={l[k as "cantidad"] ?? 0}
                            onChange={(e) =>
                              updateLine(i, k, Number(e.target.value))
                            }
                          />
                        </label>
                      ))}
                      {mode === "receive" && (
                        <label>
                          Motivo de rechazo{" "}
                          <input
                            value={l.motivo}
                            onChange={(e) =>
                              updateLine(i, "motivo", e.target.value)
                            }
                          />
                        </label>
                      )}
                    </fieldset>
                  ))}
                  <button
                    onClick={() =>
                      void run({
                        action: mode,
                        orderId: detail.header.id,
                        id: mode === "return" ? receipt : undefined,
                        almacenId: warehouse,
                        fecha,
                        fechaVencimiento: mode === "invoice" ? due : undefined,
                        numero: mode === "invoice" ? number : undefined,
                        tipoDocumento: supplierDocumentType,
                        serie: series,
                        importeDeclarado:
                          mode === "invoice" ? declared : undefined,
                        evidencia: evidence,
                        motivo: reason,
                        lines: lines.filter((l) =>
                          mode === "receive"
                            ? (l.aceptada ?? 0) + (l.rechazada ?? 0) > 0
                            : (l.cantidad ?? 0) > 0,
                        ),
                      }).then((r) => {
                        if (r) L([]);
                      })
                    }
                  >
                    Confirmar{" "}
                    {mode === "invoice"
                      ? "documento y deuda"
                      : "movimiento físico"}
                  </button>
                </fieldset>
              )}
            </>
          )}
          <h3>Historial de auditoría</h3>
          <ol>
            {detail.history.map((e, i) => (
              <li key={i}>
                {e.fecha} · {e.usuario} · {e.accion}
                {e.accion === "oferta_revision" && (
                  <details>
                    <summary>Ver snapshot de revisión</summary>
                    {(() => {
                      const value = e.datos as {
                          snapshot?: Record<string, unknown>;
                        },
                        snap = value.snapshot;
                      if (!snap) return null;
                      return (
                        <div>
                          <p>
                            Moneda: {String(snap.moneda)} · Cambio:{" "}
                            {String(snap.tipoCambio)} · Vigencia:{" "}
                            {String(snap.vigenteHasta)}
                          </p>
                          <p>
                            Entrega: {String(snap.plazoDias)} días · Garantía:{" "}
                            {String(snap.garantia)}
                          </p>
                          <p>
                            Condiciones: {String(snap.condiciones)} ·
                            Referencia: {String(snap.referencia)}
                          </p>
                          <p>
                            Subtotal: {fmt(snap.originalBase)} · Impuesto:{" "}
                            {fmt(snap.originalTax)} · Total: {fmt(snap.total)}{" "}
                            {String(snap.functionalCurrency)}
                          </p>
                        </div>
                      );
                    })()}
                  </details>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {tab === "config" && can("cxp.configurar") && (
        <fieldset disabled={durable.busy || Boolean(durable.pending)}>
          <legend>Tratamiento explícito por empresa</legend>
          <label>
            Recepción sin factura{" "}
            <select
              value={cfg?.policy ?? ""}
              onChange={(e) =>
                C({
                  grniAccountId: null,
                  transitAccountId: null,
                  claimAccountId: null,
                  varianceAccountId: null,
                  ...cfg,
                  policy: e.target.value as PurchaseConfig["policy"],
                })
              }
            >
              <option value="">Sin configurar</option>
              <option value="sin_reconocimiento_hasta_factura">
                Sin reconocimiento hasta factura
              </option>
              <option value="mercancia_recibida_no_facturada">
                Mercancía recibida no facturada
              </option>
            </select>
          </label>
          {cfg &&
            (
              [
                "grniAccountId",
                "transitAccountId",
                "claimAccountId",
                "varianceAccountId",
              ] as const
            ).map((k) => (
              <label key={k}>
                {
                  {
                    grniAccountId: "Pasivo de mercancía recibida no facturada",
                    transitAccountId: "Activo de mercancía en tránsito",
                    claimAccountId: "Activo de reclamaciones al proveedor",
                    varianceAccountId:
                      "Cuenta de diferencias de costo/redondeo",
                  }[k]
                }{" "}
                <select
                  value={cfg[k] ?? ""}
                  onChange={(e) => C({ ...cfg, [k]: e.target.value || null })}
                >
                  {options(opts?.accounts)}
                </select>
              </label>
            ))}
          <p>
            Las cuentas no se inventan. Si falta configuración para una
            recepción comercial, su contabilización queda pendiente.
          </p>
          <button
            disabled={!cfg?.policy}
            onClick={() => void run({ action: "configure", config: cfg })}
          >
            Guardar configuración
          </button>
        </fieldset>
      )}
      {tab === "cxp" && can("cxp.ver") && (
        <>
          <label>
            Proveedor{" "}
            <select value={supplier} onChange={(e) => SP(e.target.value)}>
              {options(opts?.suppliers)}
            </select>
          </label>
          <button onClick={() => void queryStatement()}>
            Consultar estado de cuenta
          </button>
          {statement && (
            <>
              <h2>{statement.proveedor}</h2>
              <p>
                Saldo: {fmt(statement.saldo)} {statement.currency} ·
                Reclamaciones por devoluciones: {fmt(statement.pendingClaims)}{" "}
                (no compensadas automáticamente)
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Antigüedad</th>
                    <th>Documentos</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.aging.map((a) => (
                    <tr key={a.bucket}>
                      <td>{a.bucket}</td>
                      <td>{a.count}</td>
                      <td>{fmt(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th>Total</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.documents.map((d) => (
                    <tr key={d.id}>
                      <td>{d.numero}</td>
                      <td>{d.fecha}</td>
                      <td>{d.vencimiento}</td>
                      <td>{fmt(d.monto)}</td>
                      <td>
                        {fmt(d.saldo)}{" "}
                        {can("cxp.pagar") && d.saldo > 0 && (
                          <button
                            onClick={() => {
                              DB(d.id);
                              A(d.saldo);
                              CF(false);
                            }}
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Pagos registrados</h3>
              {statement.payments.map((a) => (
                <p key={a.id}>
                  {a.fecha} · {fmt(a.monto)} · {a.referencia}
                </p>
              ))}
            </>
          )}
          {debt && can("cxp.pagar") && (
            <fieldset disabled={durable.busy || Boolean(durable.pending)}>
              <legend>Registrar pago real confirmado</legend>
              <label>
                Importe{" "}
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    A(Number(e.target.value));
                    Dirty(true);
                  }}
                />
              </label>
              <label>
                Cuenta financiera{" "}
                <select value={financial} onChange={(e) => FI(e.target.value)}>
                  {options(opts?.financial)}
                </select>
              </label>
              {opts?.financial.find((f) => f.id === financial)?.tipo ===
              "caja" ? (
                <label>
                  Turno{" "}
                  <select value={session} onChange={(e) => CS(e.target.value)}>
                    {options(opts?.sessions)}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Datáfono independiente{" "}
                    <input
                      type="checkbox"
                      checked={terminal}
                      onChange={(e) => TE(e.target.checked)}
                    />
                  </label>
                  {terminal && (
                    <label>
                      Autorización{" "}
                      <input
                        value={authorization}
                        onChange={(e) => AU(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <label>
                Fecha{" "}
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => F(e.target.value)}
                />
              </label>
              <label>
                Referencia de confirmación{" "}
                <input value={evidence} onChange={(e) => E(e.target.value)} />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => CF(e.target.checked)}
                />
                Confirmo que el pago fue aprobado realmente
              </label>
              <button
                onClick={() =>
                  void run({
                    action: "pay",
                    cxpId: debt,
                    monto: amount,
                    cuentaFinancieraId: financial,
                    sesionCajaId: session || undefined,
                    paymentSource:
                      opts?.financial.find((f) => f.id === financial)?.tipo ===
                      "caja"
                        ? "cash"
                        : terminal
                          ? "external_terminal_manual"
                          : "bank_transfer_confirmed_manual",
                    confirmado: confirmed,
                    terminalIndependiente: terminal,
                    autorizacion: authorization,
                    evidencia: evidence,
                    fecha,
                  }).then((r) => {
                    if (r) {
                      DB("");
                      void queryStatement();
                    }
                  })
                }
              >
                Confirmar pago
              </button>
            </fieldset>
          )}
        </>
      )}
    </>
  );
}
