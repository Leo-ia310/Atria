import Link from "next/link";
import { Store, Plus } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cajas, sesionesCaja, sucursales, usuarios } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AbrirSesionForm } from "@/components/caja/AbrirSesionForm";
import { CrearCajaForm } from "@/components/caja/CrearCajaForm";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

export default async function CajaPage() {
  const user = await requireSession();

  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const sucs = scope.sucursales.filter(
    (sucursal) => !sucursalIds || sucursalIds.includes(sucursal.id),
  );
  const defaultSucursalId =
    scope.modo === "selected" && scope.sucursalIds.length === 1
      ? scope.sucursalIds[0]
      : sucs[0]?.id;
  const sucursalOptions = sucs.map((s) => ({ value: s.id, label: s.nombre }));

  const cajasPromise = db
    .select({ id: cajas.id, nombre: cajas.nombre, codigo: cajas.codigo })
    .from(cajas)
    .where(
      and(
        eq(cajas.empresaId, user.empresaId),
        eq(cajas.activa, true),
        sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
      ),
    );

  const sesionPromise = db
    .select({
      id: sesionesCaja.id,
      cajaId: cajas.id,
      cajaNombre: cajas.nombre,
      sucursalNombre: sucursales.nombre,
      montoInicial: sesionesCaja.montoInicial,
      abiertaEn: sesionesCaja.abiertaEn,
    })
    .from(sesionesCaja)
    .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
    .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
    .where(
      and(
        eq(sesionesCaja.empresaId, user.empresaId),
        eq(sesionesCaja.estado, "abierta"),
        eq(cajas.empresaId, user.empresaId),
        sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
      ),
    )
    .limit(1);

  const historialPromise = db
    .select({
      id: sesionesCaja.id,
      cajaNombre: cajas.nombre,
      estado: sesionesCaja.estado,
      montoInicial: sesionesCaja.montoInicial,
      montoFinalReal: sesionesCaja.montoFinalReal,
      diferencia: sesionesCaja.diferencia,
      abiertaEn: sesionesCaja.abiertaEn,
      cerradaEn: sesionesCaja.cerradaEn,
      usuarioNombre: usuarios.nombre,
      sucursalNombre: sucursales.nombre,
    })
    .from(sesionesCaja)
    .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
    .innerJoin(usuarios, eq(usuarios.id, sesionesCaja.usuarioId))
    .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
    .where(
      and(
        eq(sesionesCaja.empresaId, user.empresaId),
        eq(cajas.empresaId, user.empresaId),
        eq(usuarios.empresaId, user.empresaId),
        sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(sesionesCaja.abiertaEn))
    .limit(20);

  const [cajasList, sesionRows, historial] = await Promise.all([
    cajasPromise,
    sesionPromise,
    historialPromise,
  ]);
  const sesionAbierta = sesionRows[0];

  const cajasDisponibles = cajasList
    .filter((c) => c.id !== sesionAbierta?.cajaId)
    .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sesion de caja"
        subtitle={`Control de apertura y cierre de caja${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
      />

      {sesionAbierta && (
        <div className="rounded-md border border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/8 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="success">Abierta</Badge>
                <span className="font-semibold">{sesionAbierta.cajaNombre}</span>
                {scope.visible && sesionAbierta.sucursalNombre && (
                  <span className="text-small text-[color:var(--color-text-muted)]">
                    - {sesionAbierta.sucursalNombre}
                  </span>
                )}
              </div>
              <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                Abierta el {new Date(sesionAbierta.abiertaEn).toLocaleString()} - Inicio:{" "}
                {formatearMoneda(parseFloat(sesionAbierta.montoInicial), pais)}
              </p>
            </div>
            <Link
              href={`/caja/${sesionAbierta.id}`}
              className="atria-btn atria-btn-primary atria-btn-sm"
            >
              Ver sesion
            </Link>
          </div>
        </div>
      )}

      {!sesionAbierta && cajasList.length > 0 && (
        <AbrirSesionForm cajas={cajasDisponibles} pais={pais} />
      )}

      {cajasList.length === 0 && (
        <div className="space-y-4">
          <EmptyState
            icon={Store}
            titulo="No hay cajas configuradas"
            descripcion="Crea una caja para poder abrir sesiones y registrar ventas."
          />
          <CrearCajaForm sucursales={sucursalOptions} defaultSucursalId={defaultSucursalId} />
        </div>
      )}

      {historial.length > 0 && (
        <Card>
          <CardHeader title="Historial de sesiones" />
          <div className="divide-y divide-[color:var(--color-border)]">
            {historial.map((s) => {
              const diferencia = s.diferencia ? parseFloat(s.diferencia) : null;
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.estado === "abierta" ? "success" : "neutral"}>
                        {s.estado === "abierta" ? "Abierta" : "Cerrada"}
                      </Badge>
                      <span className="text-small font-medium">{s.cajaNombre}</span>
                      {scope.visible && s.sucursalNombre && (
                        <span className="text-[12px] text-[color:var(--color-text-muted)]">
                          - {s.sucursalNombre}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                      {s.usuarioNombre} -{" "}
                      {formatearFecha(new Date(s.abiertaEn).toISOString().slice(0, 10), pais)}
                      {s.cerradaEn &&
                        ` -> ${formatearFecha(
                          new Date(s.cerradaEn).toISOString().slice(0, 10),
                          pais,
                        )}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    {diferencia !== null && (
                      <span
                        className={`text-small font-semibold ${
                          diferencia < 0
                            ? "text-[color:var(--color-error)]"
                            : diferencia > 0.0001
                              ? "text-[color:var(--color-success)]"
                              : "text-[color:var(--color-text-muted)]"
                        }`}
                      >
                        {diferencia >= 0 ? "+" : ""}
                        {formatearMoneda(diferencia, pais)}
                      </span>
                    )}
                    <Link
                      href={`/caja/${s.id}`}
                      className="text-[12px] text-[color:var(--color-secondary)] hover:underline"
                    >
                      Ver
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {cajasList.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1 text-[12px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] list-none">
            <Plus size={12} /> Crear otra caja
          </summary>
          <div className="mt-3">
            <CrearCajaForm sucursales={sucursalOptions} defaultSucursalId={defaultSucursalId} />
          </div>
        </details>
      )}
    </div>
  );
}
