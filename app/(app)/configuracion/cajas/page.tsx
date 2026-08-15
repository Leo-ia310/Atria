import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cajas, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrearCajaForm } from "@/components/caja/CrearCajaForm";
import { Receipt } from "lucide-react";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

export default async function CajasPage() {
  const user = await requireSession();
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);

  const [filas, sucs] = await Promise.all([
    db
      .select({
        id: cajas.id,
        codigo: cajas.codigo,
        nombre: cajas.nombre,
        activa: cajas.activa,
        sucursal: sucursales.nombre,
      })
      .from(cajas)
      .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
      .where(
        and(
          eq(cajas.empresaId, user.empresaId),
          sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
        ),
      ),
    db
      .select({ id: sucursales.id, nombre: sucursales.nombre })
      .from(sucursales)
      .where(
        and(
          eq(sucursales.empresaId, user.empresaId),
          eq(sucursales.activa, true),
          isNull(sucursales.eliminadoEn),
          sucursalIds ? inArray(sucursales.id, sucursalIds) : undefined,
        ),
      )
      .orderBy(sucursales.nombre),
  ]);

  const defaultSucursalId =
    scope.modo === "selected" && scope.sucursalIds.length === 1
      ? scope.sucursalIds[0]
      : sucs[0]?.id;
  const sucursalOptions = sucs.map((s) => ({ value: s.id, label: s.nombre }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cajas"
        subtitle={`${filas.length} cajas registradas${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
        actions={<BotonExportarExcel recurso="cajas" />}
      />

      <Card>
        <CardHeader title="Cajas registradas" />
        {filas.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Receipt}
              titulo="Sin cajas"
              descripcion="Crea una caja para poder abrir sesiones y registrar ventas en el POS."
            />
          </CardBody>
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {filas.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                    {c.codigo}
                  </span>
                  <span className="text-small font-medium">{c.nombre}</span>
                  {c.sucursal && (
                    <span className="text-[12px] text-[color:var(--color-text-muted)]">
                      - {c.sucursal}
                    </span>
                  )}
                </div>
                {c.activa ? (
                  <Badge variant="success">Activa</Badge>
                ) : (
                  <Badge variant="neutral">Inactiva</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div>
        <h2 className="text-label mb-2">Agregar caja</h2>
        <CrearCajaForm sucursales={sucursalOptions} defaultSucursalId={defaultSucursalId} />
      </div>
    </div>
  );
}
