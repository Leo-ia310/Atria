import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, facturas, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { reciboDesdeSnapshot } from "@/lib/facturas";
import { Recibo } from "@/components/pos/Recibo";
import { AutoPrintFacturas } from "@/components/facturas/AutoPrintFacturas";

type FiltrosFactura = {
  numero?: string;
  desde?: string;
  hasta?: string;
  vendedor?: string;
  forma?: string;
  tipo?: string;
  origen?: string;
  q?: string;
  estado?: string;
};

export default async function ImprimirFacturasPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosFactura>;
}) {
  const [sp, user] = await Promise.all([searchParams, requireSession()]);
  await requireModulo(user, sp.origen === "ventas" ? "ventas" : "facturas");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const sucursalIds = selectedSucursalIds(scope);
  let filas: { id: string; snapshot: unknown }[];
  if (sp.origen === "ventas") {
    const condicionesVenta = [eq(ventas.empresaId, user.empresaId)];
    if (sucursalIds) condicionesVenta.push(inArray(ventas.sucursalId, sucursalIds));
    if (sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde)) {
      condicionesVenta.push(sql`${ventas.fecha}::date >= ${sp.desde}`);
    }
    if (sp.hasta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta)) {
      condicionesVenta.push(sql`${ventas.fecha}::date <= ${sp.hasta}`);
    }
    if (sp.tipo === "contado") condicionesVenta.push(eq(ventas.esCredito, false));
    if (sp.tipo === "credito") condicionesVenta.push(eq(ventas.esCredito, true));
    if (sp.estado === "completada" || sp.estado === "anulada" || sp.estado === "pendiente") {
      condicionesVenta.push(eq(ventas.estado, sp.estado));
    }
    if (sp.q) {
      const busqueda = or(ilike(ventas.numero, `%${sp.q}%`), ilike(clientes.nombre, `%${sp.q}%`));
      if (busqueda) condicionesVenta.push(busqueda);
    }
    filas = await db
      .select({ id: facturas.id, snapshot: facturas.snapshot })
      .from(ventas)
      .innerJoin(facturas, eq(facturas.ventaId, ventas.id))
      .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
      .where(and(...condicionesVenta))
      .orderBy(desc(ventas.fecha))
      .limit(300);
  } else {
    const condicionesFactura = [eq(facturas.empresaId, user.empresaId)];
    if (sp.numero) condicionesFactura.push(ilike(facturas.numero, `%${sp.numero}%`));
    if (sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde)) {
      condicionesFactura.push(sql`${facturas.fecha}::date >= ${sp.desde}`);
    }
    if (sp.hasta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta)) {
      condicionesFactura.push(sql`${facturas.fecha}::date <= ${sp.hasta}`);
    }
    if (sp.vendedor) condicionesFactura.push(eq(facturas.vendedorId, sp.vendedor));
    if (sp.forma) condicionesFactura.push(ilike(facturas.formasPago, `%${sp.forma}%`));
    if (sp.tipo === "contado") condicionesFactura.push(eq(facturas.esCredito, false));
    if (sp.tipo === "credito") condicionesFactura.push(eq(facturas.esCredito, true));
    if (sucursalIds) condicionesFactura.push(inArray(ventas.sucursalId, sucursalIds));
    filas = await db
      .select({ id: facturas.id, snapshot: facturas.snapshot })
      .from(facturas)
      .leftJoin(ventas, eq(ventas.id, facturas.ventaId))
      .where(and(...condicionesFactura))
      .orderBy(desc(facturas.fecha))
      .limit(500);
  }

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const config = getPaisConfig(pais);
  const empresaRecibo = {
    nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
    idFiscalNombre: config.idFiscalNombre,
    identificacionFiscal: empresa?.identificacionFiscal ?? "",
    direccion: empresa?.direccion ?? null,
    telefono: empresa?.telefono ?? null,
  };

  return (
    <main className="min-h-screen bg-white">
      <AutoPrintFacturas total={filas.length} />
      {filas.length === 0 ? (
        <div className="p-8 text-center text-[color:var(--color-text-muted)]">
          No hay facturas para los filtros seleccionados.
        </div>
      ) : (
        <div className="recibos-lote-imprimible mx-auto w-[360px] py-5 print:w-full print:py-0">
          {filas.map((fila) => {
            const recibo = reciboDesdeSnapshot({
              snapshot: fila.snapshot as Record<string, unknown>,
              pais,
              empresa: empresaRecibo,
              impuestoNombre: config.impuestoNombre,
            });
            return (
              <div key={fila.id} className="recibo-lote-pagina mb-5 print:mb-0">
                <Recibo data={recibo} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
