import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { History, ShieldCheck } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { auditoria, usuarios } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFechaHora } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { FilterDialog } from "@/components/restaurante/FilterDialog";

export const metadata: Metadata = {
  title: "Auditoria Restaurante | ARCA",
  description: "Auditoria visible para cambios criticos del restaurante y del core empresarial.",
};

const ACCIONES_CRITICAS = [
  "anul",
  "cancel",
  "descuento",
  "devol",
  "merma",
  "cierre",
  "pago",
  "compra",
  "ajuste",
  "permiso",
];

export default async function RestauranteAuditoriaPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-configuracion");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const filas = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: auditoria.id,
        accion: auditoria.accion,
        tabla: auditoria.tabla,
        registroId: auditoria.registroId,
        creadoEn: auditoria.creadoEn,
        usuario: usuarios.nombre,
        tieneAntes: auditoria.datosAntes,
        tieneDespues: auditoria.datosDespues,
      })
      .from(auditoria)
      .leftJoin(
        usuarios,
        and(eq(usuarios.id, auditoria.usuarioId), eq(usuarios.empresaId, user.empresaId)),
      )
      .where(eq(auditoria.empresaId, user.empresaId))
      .orderBy(desc(auditoria.creadoEn))
      .limit(160),
  );

  const criticas = filas.filter((row) => {
    const texto = `${row.accion} ${row.tabla}`.toLowerCase();
    return ACCIONES_CRITICAS.some((palabra) => texto.includes(palabra));
  });
  const criticaIds = new Set(criticas.map((row) => row.id));
  const conSnapshot = filas.filter((row) => Boolean(row.tieneAntes || row.tieneDespues)).length;

  return (
    <RestaurantCoreModulePage
      eyebrow="Seguridad y trazabilidad"
      title="Auditoria restaurante"
      subtitle="Registro visible de cambios criticos sin reemplazar el historial transaccional append-only."
      actions={[
        { href: "/restaurante/configuracion", label: "Configuracion", icon: ShieldCheck },
        { href: "/restaurante/reportes", label: "Reportes", icon: History },
      ]}
      kpis={[
        { label: "Eventos recientes", value: String(filas.length), icon: History },
        { label: "Criticos", value: String(criticas.length), hint: "Anulaciones, pagos, ajustes" },
        { label: "Con snapshot", value: String(conSnapshot), hint: "Antes/despues" },
        { label: "Usuarios", value: String(new Set(filas.map((row) => row.usuario ?? "sistema")).size) },
      ]}
    >
      <section className="grid gap-4">
        <div className="flex justify-end">
          <FilterDialog title="Filtros de auditoria">
            <div className="grid gap-3 sm:grid-cols-2">
              <input aria-label="Filtrar por usuario" placeholder="Usuario" className="arca-input h-10" />
              <input aria-label="Filtrar por modulo" placeholder="Modulo" className="arca-input h-10" />
              <select aria-label="Filtrar por criticidad" className="arca-input h-10" defaultValue="">
                <option value="">Criticidad</option>
                <option value="criticos">Solo criticos</option>
                <option value="snapshots">Con snapshot</option>
              </select>
              <input type="date" aria-label="Filtrar por fecha" className="arca-input h-10" />
            </div>
          </FilterDialog>
        </div>
        <RestaurantModuleList
          title="Bitacora reciente"
          subtitle="Se muestra usuario, accion, modulo, entidad y momento. Los IDs tecnicos quedan para Ver detalles."
          empty="No hay eventos de auditoria registrados."
          items={filas.map((row) => {
            const evento = traducirEvento(row.accion, row.tabla);
            return {
              id: row.id,
              title: `${row.usuario ?? "Sistema"} - ${evento.accion}`,
              subtitle: `${evento.entidad}${resumenAuditoria(row.tieneAntes, row.tieneDespues)}`,
              meta: `${evento.modulo} / ${formatearFechaHora(row.creadoEn, pais, empresa?.zonaHoraria)}`,
              badge: "Ver detalles",
              tone: criticaIds.has(row.id) ? "warning" : "neutral",
            };
          })}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}

function traducirEvento(accion: string, tabla: string | null) {
  const acciones: Record<string, { accion: string; modulo: string }> = {
    "restaurante.kds.estado": { accion: "Cambio de estado en cocina", modulo: "KDS" },
    "restaurante.comanda.enviar": { accion: "Envio comanda a cocina", modulo: "KDS" },
    "restaurante.mesa.estado": { accion: "Cambio estado de mesa", modulo: "Mesas" },
    "restaurante.mesa.layout": { accion: "Movio mesa en plano", modulo: "Mesas" },
    "restaurante.orden.crear": { accion: "Abrio orden", modulo: "POS" },
    "restaurante.orden.cobrar": { accion: "Cobro orden", modulo: "Caja" },
    "restaurante.orden.solicitar_cuenta": { accion: "Solicito cuenta", modulo: "POS" },
    "restaurante.orden.mover_mesa": { accion: "Cambio mesa de orden", modulo: "Mesas" },
    "restaurante.merma.crear": { accion: "Registro merma", modulo: "Inventario" },
  };
  const entidades: Record<string, string> = {
    restaurante_comandas: "Comanda",
    restaurante_ordenes: "Orden",
    restaurante_mesas: "Mesa",
    restaurante_areas: "Area",
    restaurante_mermas: "Merma",
    compras: "Compra",
    cuentas_por_pagar: "Cuenta por pagar",
    sesiones_caja: "Turno de caja",
  };
  const traducida = acciones[accion] ?? {
    accion: humanizar(accion),
    modulo: tabla?.startsWith("restaurante_") ? "Restaurante" : "ARCA Core",
  };
  return {
    ...traducida,
    entidad: tabla ? entidades[tabla] ?? humanizar(tabla) : "Registro",
  };
}

function resumenAuditoria(antes: unknown, despues: unknown): string {
  const datos = (despues ?? antes) as Record<string, unknown> | null;
  if (!datos || typeof datos !== "object") return "";
  if ("estado" in datos) return ` / Estado: ${humanizar(String(datos.estado))}`;
  if ("total" in datos) return ` / Total: ${String(datos.total)}`;
  if ("mesaDestinoId" in datos) return " / Mesa reasignada";
  return "";
}

function humanizar(valor: string): string {
  return valor
    .replace(/^restaurante[._]/, "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}
