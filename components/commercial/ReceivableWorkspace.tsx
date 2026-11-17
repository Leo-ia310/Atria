"use client";
import "./documents.css";
import { useEffect, useState } from "react";
import {
  receivableCommandSchema,
  type ReceivableCommand,
  type ReceivableResult,
} from "../../lib/receivable-core";
import { useDurableCommand } from "./useDurableCommand";
import { DocumentPrintControls } from "./DocumentPrintControls";
import { inputMessage } from "../../lib/document-display";
import type { DocumentTransport, DocumentOutput } from "./DocumentDesigner";
export type ReceivableTransport = (
  c: ReceivableCommand,
) => Promise<ReceivableResult>;
type Props = {
  contextId: string;
  branches: Array<{ id: string; nombre: string }>;
  send: ReceivableTransport;
  documentSend: DocumentTransport;
  output?: DocumentOutput;
  saleId?: string;
  onWorkChange?: (active: boolean) => void;
};
type Success = Extract<ReceivableResult, { ok: true }>;
export function ReceivableWorkspace(p: Props) {
  const [branch, setBranch] = useState(p.branches[0]?.id ?? "");
  const ids = p.branches.map((b) => b.id).join(",");
  useEffect(() => {
    if (!p.branches.some((b) => b.id === branch))
      setBranch(p.branches[0]?.id ?? "");
  }, [ids, branch]);
  return (
    <section className="arca-document-editor">
      <label>
        Sucursal{" "}
        <select value={branch} onChange={(e) => setBranch(e.target.value)}>
          {p.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      {branch && (
        <Workspace
          key={`${p.contextId}:${branch}:${p.saleId ?? ""}`}
          {...p}
          branch={branch}
        />
      )}
    </section>
  );
}
function Workspace(p: Props & { branch: string }) {
  const [data, setData] = useState<Success | null>(null),
    [sale, setSale] = useState<Success["sale"]>(),
    [client, setClient] = useState(""),
    [statement, setStatement] = useState<Success["customer"]>();
  const [action, setAction] = useState<
      "advance" | "apply" | "refund" | "collect"
    >("advance"),
    [credit, setCredit] = useState(""),
    [debt, setDebt] = useState(""),
    [method, setMethod] = useState(""),
    [session, setSession] = useState(""),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [terminal, setTerminal] = useState(false),
    [authorization, setAuthorization] = useState("");
  const [lines, setLines] = useState<
      Array<{ lineId: string; cantidad: number; reingresar: boolean }>
    >([]),
    [cancel, setCancel] = useState(false),
    [document, setDocument] = useState<{
      id: string;
      kind: "nota_credito" | "recibo";
    } | null>(null);
  const durable = useDurableCommand(
    `arca:financial-attempt:${p.contextId}:${p.branch}:${p.saleId ?? ""}`,
    p.send,
  );
  const command = (extra: Partial<ReceivableCommand>) =>
    receivableCommandSchema.parse({
      requestId: crypto.randomUUID(),
      sucursalId: p.branch,
      ...extra,
    });
  const load = async () => {
    try {
      const r = await p.send(command({ action: "list" }));
      if (r.ok) setData(r);
      else if (!p.saleId) durable.setError(r.error);
      if (p.saleId) {
        const s = await p.send(command({ action: "sale", ventaId: p.saleId }));
        if (!s.ok) throw new Error(s.error);
        setSale(s.sale);
        setLines(
          s.sale?.lines.map((l) => ({
            lineId: l.id,
            cantidad: 0,
            reingresar: false,
          })) ?? [],
        );
      }
    } catch (e) {
      durable.setError(inputMessage(e));
    }
  };
  useEffect(() => {
    void load();
  }, [p.branch, p.saleId, p.send]);
  const permissions = data?.permissions ?? [],
    options = data?.options;
  const mutate = async (extra: Partial<ReceivableCommand>) => {
    try {
      const r = await durable.run(command(extra));
      if (r) {
        if (r.documentId)
          setDocument({
            id: extra.action === "creditNote" ? r.id! : r.documentId,
            kind: extra.action === "creditNote" ? "nota_credito" : "recibo",
          });
        setConfirmed(false);
        setAmount("");
        await load();
        if (client) await showCustomer(client);
      }
      return r;
    } catch (error) {
      durable.setError(inputMessage(error));
      return null;
    }
  };
  const showCustomer = async (id: string) => {
    setStatement(undefined);
    if (!id) return;
    try {
      const r = await p.send(command({ action: "customer", clienteId: id }));
      if (!r.ok) throw new Error(r.error);
      setStatement(r.customer);
    } catch (e) {
      durable.setError(inputMessage(e));
    }
  };
  const recover = async () => {
    const r = durable.retry
      ? await durable.run(durable.retry)
      : await durable.run(
          command({ action: "recover", attemptId: durable.pending! }),
        );
    if (r) {
      await load();
      if (client) await showCustomer(client);
    }
  };
  const disabled = durable.busy || !!durable.pending;
  const dirty =
    !!amount ||
    !!reason ||
    lines.some((l) => l.cantidad > 0) ||
    durable.busy ||
    !!durable.pending;
  useEffect(() => {
    p.onWorkChange?.(dirty);
    return () => p.onWorkChange?.(false);
  }, [dirty, p.onWorkChange]);
  const payment = (
    <>
      <label>
        Forma de pago{" "}
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setConfirmed(false);
          }}
        >
          <option value="">Seleccionar</option>
          {options?.methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Turno original de caja (obligatorio para efectivo){" "}
        <select value={session} onChange={(e) => setSession(e.target.value)}>
          <option value="">Seleccionar</option>
          {options?.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Referencia / evidencia{" "}
        <input
          maxLength={300}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        Confirmo que el movimiento real fue aprobado/recibido; una transferencia
        pendiente no cuenta como dinero disponible.
      </label>
      <label>
        <input
          type="checkbox"
          checked={terminal}
          onChange={(e) => setTerminal(e.target.checked)}
        />{" "}
        Datáfono independiente (solo tarjeta)
      </label>
      <label>
        Autorización del datáfono{" "}
        <input
          value={authorization}
          maxLength={120}
          onChange={(e) => setAuthorization(e.target.value)}
        />
      </label>
    </>
  );
  const settlement = {
    formaPagoId: method || undefined,
    sesionCajaId: session || undefined,
    referencia: reference,
    confirmed,
    terminalIndependent: terminal,
    terminalAuthorization: authorization || undefined,
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>
        {p.saleId
          ? "Anulación y notas de crédito internas"
          : "Anticipos, recibos y estados de cuenta"}
      </h2>
      <p>
        Operaciones nuevas disponibles con conexión. El POS y los cobros offline
        existentes conservan su funcionamiento. Cada intento se recupera antes
        de iniciar otro.
      </p>
      {data?.pendingAttempts?.map((a) => (
        <p key={a.requestId}>
          Confirmación pendiente: {a.action}{" "}
          <button
            disabled={durable.busy}
            onClick={() =>
              void mutate({ action: "recover", attemptId: a.requestId })
            }
          >
            Recuperar resultado guardado
          </button>
        </p>
      ))}
      {data?.cached && (
        <p>
          Datos descargados de la última consulta. Conéctate para consultar
          saldos actuales y registrar operaciones.
        </p>
      )}
      {durable.error && <p role="alert">{durable.error}</p>}
      {durable.pending && (
        <button disabled={durable.busy} onClick={() => void recover()}>
          Recuperar el mismo intento
        </button>
      )}
      <button disabled={disabled} onClick={() => void load()}>
        Actualizar datos
      </button>
      {p.saleId && sale ? (
        <>
          <p>
            {sale.numero} · {sale.cliente} ·{" "}
            {sale.moneda ?? "Moneda histórica sin verificar"} · Total{" "}
            {sale.total.toFixed(2)} · Acreditado {sale.credited.toFixed(2)}
            {sale.cancelled ? " · Anulada mediante compensación" : ""}
          </p>
          {sale.notes.map((n) => (
            <p key={n.id}>
              {n.fecha} · {n.numero} · {n.tipo} · {n.total.toFixed(2)}{" "}
              <button
                disabled={disabled}
                onClick={() => setDocument({ id: n.id, kind: "nota_credito" })}
              >
                Ver / reimprimir nota
              </button>
            </p>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate({
                action: "creditNote",
                ventaId: p.saleId,
                motivo: reason,
                cancel,
                lines: lines.filter((l) => l.cantidad > 0),
                ...settlement,
              });
            }}
            style={{ display: "grid", gap: 12 }}
          >
            <label>
              Motivo{" "}
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={cancel}
                onChange={(e) => {
                  setCancel(e.target.checked);
                  setLines(
                    sale.lines.map((l) => ({
                      lineId: l.id,
                      cantidad: e.target.checked ? l.available : 0,
                      reingresar: false,
                    })),
                  );
                }}
              />{" "}
              Anular todas las cantidades restantes, conservando originales
            </label>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Pendiente</th>
                  <th>Cantidad a acreditar</th>
                  <th>Reingreso físico</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l, i) => (
                  <tr key={l.id}>
                    <td>{l.nombre}</td>
                    <td>{l.available}</td>
                    <td>
                      <input
                        aria-label={`Cantidad ${l.nombre}`}
                        type="number"
                        min={0}
                        max={l.available}
                        step="0.0001"
                        value={lines[i]?.cantidad ?? 0}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, n) =>
                              i === n
                                ? { ...x, cantidad: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          disabled={!l.reingresable}
                          checked={lines[i]?.reingresar ?? false}
                          onChange={(e) =>
                            setLines(
                              lines.map((x, n) =>
                                i === n
                                  ? { ...x, reingresar: e.target.checked }
                                  : x,
                              ),
                            )
                          }
                        />
                        {l.reingresable
                          ? "Devuelto al almacén original"
                          : "Sin trazabilidad física suficiente"}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Primero reduce el saldo pendiente. El importe ya pagado queda como
              crédito del cliente; si eliges una forma de pago, exige un
              reembolso real confirmado. Una venta a consumidor final requiere
              reembolso.
            </p>
            {payment}
            <button
              disabled={
                disabled ||
                sale.cancelled ||
                !sale.moneda ||
                !permissions.includes("venta.nota_credito")
              }
              type="submit"
            >
              Registrar compensación
            </button>
          </form>
        </>
      ) : (
        !p.saleId && (
          <>
            {permissions.includes("cxc.configurar") && (
              <details>
                <summary>Configuración contable de anticipos</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = new FormData(e.currentTarget).get("account");
                    void mutate({
                      action: "configure",
                      cuentaPasivoId: String(value),
                    });
                  }}
                >
                  <label>
                    Cuenta de pasivo{" "}
                    <select
                      name="account"
                      defaultValue={options?.configured ?? ""}
                      required
                    >
                      <option value="">Seleccionar explícitamente</option>
                      {options?.liabilities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={disabled}>Guardar configuración</button>
                </form>
                <p>
                  El cambio aplica a créditos nuevos. Los créditos anteriores
                  conservan su cuenta original.
                </p>
              </details>
            )}
            <label>
              Cliente{" "}
              <select
                value={client}
                onChange={(e) => {
                  setClient(e.target.value);
                  setCredit("");
                  setDebt("");
                  void showCustomer(e.target.value);
                }}
              >
                <option value="">Seleccionar</option>
                {options?.clients.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate({
                  action,
                  clienteId: client,
                  id: credit || undefined,
                  cxcId: debt || undefined,
                  monto: Number(amount),
                  motivo: reason,
                  ...settlement,
                });
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <label>
                Operación{" "}
                <select
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value as typeof action);
                    setConfirmed(false);
                  }}
                >
                  <option value="advance">Recibir anticipo</option>
                  <option value="apply">Aplicar crédito a factura</option>
                  <option value="refund">Reembolsar crédito</option>
                  <option value="collect">Cobro en efectivo con recibo</option>
                </select>
              </label>
              {["apply", "refund"].includes(action) && (
                <label>
                  Crédito disponible{" "}
                  <select
                    required
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {data?.credits
                      ?.filter((r) => r.clienteId === client && r.saldo > 0)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.numero} · {r.moneda} {r.saldo.toFixed(2)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {["apply", "collect"].includes(action) && (
                <label>
                  Factura pendiente{" "}
                  <select
                    required
                    value={debt}
                    onChange={(e) => setDebt(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {options?.cxc
                      .filter((r) => r.clienteId === client)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.numero} · {r.saldo.toFixed(2)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Importe{" "}
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Motivo / observaciones{" "}
                <textarea
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {action !== "apply" && payment}
              <button
                disabled={
                  disabled ||
                  !client ||
                  !permissions.includes(
                    {
                      advance: "cxc.anticipar",
                      apply: "cxc.aplicar",
                      refund: "cxc.reembolsar",
                      collect: "cxc.cobrar",
                    }[action],
                  )
                }
              >
                Confirmar operación
              </button>
            </form>
            <h3>Créditos de clientes</h3>
            <p>
              {data?.credits?.length ?? 0} créditos descargados (hasta 500, los
              más recientes).
            </p>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th>Importe</th>
                  <th>Disponible</th>
                </tr>
              </thead>
              <tbody>
                {data?.credits
                  ?.filter((r) => !client || r.clienteId === client)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.cliente}</td>
                      <td>{r.numero}</td>
                      <td>{r.tipo}</td>
                      <td>{r.moneda}</td>
                      <td>{r.monto.toFixed(2)}</td>
                      <td>{r.saldo.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <details>
              <summary>
                Recibos y aplicaciones registrados (últimos 500)
              </summary>
              {data?.receipts
                ?.filter((r) => !client || r.clienteId === client)
                .map((r) => (
                  <p key={r.id}>
                    {r.fecha} · {r.tipo} · {r.numero}{" "}
                    <button
                      disabled={disabled}
                      onClick={() => setDocument({ id: r.id, kind: "recibo" })}
                    >
                      Ver / reimprimir recibo
                    </button>
                  </p>
                ))}
            </details>
            {statement && (
              <>
                <h3>Estado de cuenta · {statement.nombre}</h3>
                <p>
                  Saldo por cobrar: {statement.closing.toFixed(2)} (no descuenta
                  créditos sin aplicar).
                </p>
                {!!statement.unreconciled && (
                  <p role="alert">
                    El historial y el saldo difieren en{" "}
                    {statement.unreconciled.toFixed(2)}. Requiere conciliación;
                    no se modificaron datos históricos.
                  </p>
                )}
                <div>
                  {statement.aging.map((a) => (
                    <p key={a.bucket}>
                      {a.bucket}: {a.amount.toFixed(2)} · {a.count} documentos
                    </p>
                  ))}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Documento</th>
                      <th>Movimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.events.map((e) => (
                      <tr key={e.id}>
                        <td>{e.fecha.split("-").reverse().join("/")}</td>
                        <td>{e.tipo}</td>
                        <td>{e.numero}</td>
                        <td>{e.monto.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <DocumentPrintControls
                  contextId={p.contextId}
                  branch={p.branch}
                  sourceKind="estado_cuenta"
                  sourceId={client}
                  sourceVersion={1}
                  send={p.documentSend}
                  output={p.output}
                />
              </>
            )}
          </>
        )
      )}
      {document && (
        <DocumentPrintControls
          key={document.id}
          contextId={p.contextId}
          branch={p.branch}
          sourceKind={document.kind}
          sourceId={document.id}
          sourceVersion={1}
          send={p.documentSend}
          output={p.output}
        />
      )}
    </div>
  );
}
