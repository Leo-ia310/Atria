import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { Filter, PackageMinus, Search } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { productos, restauranteMermas, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Mermas | ARCA Restaurante",
  description: "Seguimiento de mermas, desperdicio y costo operativo conectado al inventario.",
};

export default async function RestauranteMermasPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-mermas");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: restauranteMermas.id,
        fecha: restauranteMermas.fecha,
        cantidad: restauranteMermas.cantidad,
        costoUnitario: restauranteMermas.costoUnitario,
        motivo: restauranteMermas.motivo,
        observacion: restauranteMermas.observacion,
        producto: productos.nombre,
        sucursal: sucursales.nombre,
      })
      .from(restauranteMermas)
      .innerJoin(productos, eq(productos.id, restauranteMermas.productoId))
      .innerJoin(sucursales, eq(sucursales.id, restauranteMermas.sucursalId))
      .where(eq(restauranteMermas.empresaId, user.empresaId))
      .orderBy(desc(restauranteMermas.fecha))
      .limit(100),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">Auditoria de inventario</p>
          <h1 className="mt-1 text-xl">Mermas</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Listado auditable de mermas y movimientos de inventario.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <input aria-label="Buscar mermas" placeholder="Buscar..." className="arca-input h-9 w-48 pl-9" />
          </div>
          <a href="#filtros-mermas" className="arca-btn arca-btn-secondary arca-btn-sm">
            <Filter size={14} /> Filtros
          </a>
          <Link href="/restaurante/inventario#registrar-merma" className="arca-btn arca-btn-primary arca-btn-sm">
            Registrar merma
          </Link>
        </div>
      </header>

      <details id="filtros-mermas" className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Filtros</summary>
        <div className="grid gap-3 border-t border-[color:var(--color-border)] p-4 sm:grid-cols-4">
          <input type="date" aria-label="Filtrar por fecha" className="arca-input" />
          <input aria-label="Filtrar por producto" placeholder="Producto" className="arca-input" />
          <input aria-label="Filtrar por sucursal" placeholder="Sucursal" className="arca-input" />
          <select aria-label="Filtrar por motivo" className="arca-input" defaultValue="">
            <option value="">Motivo</option>
            <option value="caducidad">Caducidad</option>
            <option value="preparacion">Preparacion</option>
            <option value="desperdicio">Desperdicio</option>
          </select>
        </div>
      </details>

      <Card>
        <CardHeader title="Ultimas mermas" />
        <CardBody>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-small text-[color:var(--color-text-muted)]">
              No hay mermas registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-small">
                <thead className="text-label">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Costo</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Sucursal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">{formatearFechaHora(row.fecha, pais, empresa?.zonaHoraria)}</td>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-2">
                          <PackageMinus size={14} className="text-[color:var(--color-warning)]" />
                          {row.producto}
                        </div>
                      </td>
                      <td className="px-3 py-2">{parseFloat(row.cantidad).toFixed(4)}</td>
                      <td className="px-3 py-2">{formatearMoneda(row.costoUnitario, pais)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="warning">{row.motivo}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.sucursal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
