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
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";

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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Bitacora reciente"
          subtitle="Se muestra usuario, modulo, entidad y momento. Los detalles completos quedan en la tabla de auditoria."
          empty="No hay eventos de auditoria registrados."
          items={filas.map((row) => ({
            id: row.id,
            title: row.accion,
            subtitle: `${row.tabla}${row.registroId ? ` / ${row.registroId}` : ""}`,
            meta: `${row.usuario ?? "Sistema"} / ${formatearFechaHora(row.creadoEn, pais, empresa?.zonaHoraria)}`,
            badge: row.tieneAntes || row.tieneDespues ? "Snapshot" : "Evento",
            tone: criticaIds.has(row.id) ? "warning" : "neutral",
          }))}
        />
        <RestaurantModuleGrid
          title="Prioridad de revision"
          subtitle="Accesos internos para investigar cambios sensibles."
          actions={[
            { href: "/restaurante/caja", label: "Cierres de caja" },
            { href: "/restaurante/mermas", label: "Mermas y ajustes" },
            { href: "/restaurante/compras", label: "Compras y pagos" },
            { href: "/restaurante/ordenes", label: "Anulaciones de orden" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
