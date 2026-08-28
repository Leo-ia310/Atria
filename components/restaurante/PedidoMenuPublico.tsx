"use client";

import { useMemo, useReducer, useState, useTransition, type ReactNode } from "react";
import { Check, Minus, Plus, Send } from "lucide-react";
import { crearPedidoMenuPublico } from "@/lib/actions/menu-publico";

type ItemPedidoMenu = {
  id: string;
  nombre: string;
  precio: string;
  agotado: boolean;
};

type PedidoFormState = {
  clienteNombre: string;
  clienteTelefono: string;
  clienteDireccion: string;
  notas: string;
  mensaje: string | null;
  error: string | null;
};

const PEDIDO_FORM_INICIAL: PedidoFormState = {
  clienteNombre: "",
  clienteTelefono: "",
  clienteDireccion: "",
  notas: "",
  mensaje: null,
  error: null,
};

type PedidoFormAction =
  | { type: "patch"; patch: Partial<PedidoFormState> }
  | { type: "resetAfterSuccess"; mensaje: string };

function pedidoFormReducer(
  state: PedidoFormState,
  action: PedidoFormAction,
): PedidoFormState {
  if (action.type === "resetAfterSuccess") {
    return { ...PEDIDO_FORM_INICIAL, mensaje: action.mensaje };
  }
  return { ...state, ...action.patch };
}

export function PedidoMenuPublico({
  slug,
  mesaNumero,
  items,
  colorPrimario,
}: {
  slug: string;
  mesaNumero: string | null;
  items: ItemPedidoMenu[];
  colorPrimario: string;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [form, dispatchForm] = useReducer(pedidoFormReducer, PEDIDO_FORM_INICIAL);
  const { clienteNombre, clienteTelefono, clienteDireccion, notas, mensaje, error } = form;
  const [pending, startTransition] = useTransition();

  const seleccionados = useMemo(
    () => {
      const itemsSeleccionados: { platilloId: string; cantidad: number }[] = [];
      for (const [platilloId, cantidad] of Object.entries(cantidades)) {
        if (cantidad > 0) itemsSeleccionados.push({ platilloId, cantidad });
      }
      return itemsSeleccionados;
    },
    [cantidades],
  );

  function cambiarCantidad(id: string, delta: number) {
    setCantidades((actual) => {
      const item = items.find((i) => i.id === id);
      if (!item || item.agotado) return actual;
      const siguiente = Math.max(0, Math.min(50, (actual[id] ?? 0) + delta));
      return { ...actual, [id]: siguiente };
    });
  }

  function enviarPedido() {
    dispatchForm({ type: "patch", patch: { mensaje: null, error: null } });
    startTransition(async () => {
      const res = await crearPedidoMenuPublico({
        slug,
        mesaNumero,
        clienteNombre,
        clienteTelefono,
        clienteDireccion,
        notas,
        items: seleccionados,
      });
      if (!res.ok) {
        dispatchForm({ type: "patch", patch: { error: res.error } });
        return;
      }
      setCantidades({});
      dispatchForm({
        type: "resetAfterSuccess",
        mensaje: `Pedido ${res.numero} enviado a cocina.`,
      });
    });
  }

  return (
    <section className="px-5 pb-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl rounded-md border border-black/10 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Pedir desde el menu</h2>
            <p className="mt-1 text-sm text-slate-600">
              {mesaNumero
                ? `Mesa ${mesaNumero}: selecciona platillos y el pedido aparecera en cocina.`
                : "Selecciona platillos y el pedido aparecera en cocina."}
            </p>
          </div>
          <div className="rounded px-2 py-1 text-[12px] font-semibold text-white" style={{ background: colorPrimario }}>
            {mesaNumero
              ? `Mesa ${mesaNumero} - ${seleccionados.length} seleccionados`
              : `${seleccionados.length} seleccionados`}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-950">{item.nombre}</div>
                <div className="text-[12px] text-slate-500">
                  {item.agotado ? "Agotado" : item.precio}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(item.id, -1)}
                  disabled={item.agotado || pending || !cantidades[item.id]}
                  className="flex h-8 w-8 items-center justify-center rounded border border-black/10 text-slate-700 disabled:opacity-30"
                  aria-label={`Quitar ${item.nombre}`}
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-semibold">
                  {cantidades[item.id] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(item.id, 1)}
                  disabled={item.agotado || pending}
                  className="flex h-8 w-8 items-center justify-center rounded text-white disabled:opacity-30"
                  style={{ background: colorPrimario }}
                  aria-label={`Agregar ${item.nombre}`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PublicField label="Nombre">
              <input
                value={clienteNombre}
                onChange={(e) =>
                  dispatchForm({ type: "patch", patch: { clienteNombre: e.target.value } })
                }
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Telefono / WhatsApp">
            <input
              value={clienteTelefono}
              onChange={(e) =>
                dispatchForm({ type: "patch", patch: { clienteTelefono: e.target.value } })
              }
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label={mesaNumero ? "Indicacion de mesa" : "Direccion o mesa"} className="md:col-span-2">
            <input
              value={clienteDireccion}
              onChange={(e) =>
                dispatchForm({ type: "patch", patch: { clienteDireccion: e.target.value } })
              }
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Notas del pedido" className="md:col-span-2">
            <textarea
              value={notas}
              onChange={(e) =>
                dispatchForm({ type: "patch", patch: { notas: e.target.value } })
              }
              className="min-h-20 rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Check size={15} /> {mensaje}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={enviarPedido}
            disabled={
              pending ||
              seleccionados.length === 0 ||
              (!mesaNumero &&
                (clienteNombre.trim().length < 2 || clienteTelefono.trim().length < 6))
            }
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: colorPrimario }}
          >
            <Send size={15} /> {pending ? "Enviando..." : "Enviar pedido"}
          </button>
        </div>
      </div>
    </section>
  );
}

function PublicField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
