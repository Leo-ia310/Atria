import { notFound } from "next/navigation";
import Link from "next/link";
import { and, count, eq, isNull, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { sesionesCaja, cajas, usuarios, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ArqueoForm } from "@/components/caja/ArqueoForm";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { dinero } from "@/lib/contabilidad/helpers";

function formatDt(ts: Date | string) {
  return new Date(ts).toLocaleString("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SesionDetallePage({
  params,
}: {
  params: Promise<{ sesionId: string }>;
}) {
  const [{ sesionId }, user] = await Promise.all([params, requireSession()]);

  const sesionPromise = db
    .select({
      id: sesionesCaja.id,
      estado: sesionesCaja.estado,
      cajaNombre: cajas.nombre,
      cajaId: sesionesCaja.cajaId,
      usuarioNombre: usuarios.nombre,
      montoInicial: sesionesCaja.montoInicial,
      montoFinalEsperado: sesionesCaja.montoFinalEsperado,
      montoFinalReal: sesionesCaja.montoFinalReal,
      diferencia: sesionesCaja.diferencia,
      abiertaEn: sesionesCaja.abiertaEn,
      cerradaEn: sesionesCaja.cerradaEn,
      notas: sesionesCaja.notas,
    })
    .from(sesionesCaja)
    .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
    .innerJoin(usuarios, eq(usuarios.id, sesionesCaja.usuarioId))
    .where(
      and(eq(sesionesCaja.id, sesionId), eq(sesionesCaja.empresaId, user.empresaId)),
    )
    .limit(1);

  const statsPromise = db
    .select({
      totalVentas: count(ventas.id),
      totalContado: sum(ventas.total),
    })
    .from(ventas)
    .where(
      and(
        eq(ventas.empresaId, user.empresaId),
        eq(ventas.sesionCajaId, sesionId),
        eq(ventas.esCredito, false),
        isNull(ventas.anuladoEn),
      ),
    );

  const [empresa, sesionRows, statsRows] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    sesionPromise,
    statsPromise,
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sesion = sesionRows[0];
  const stats = statsRows[0];

  if (!sesion) notFound();

  const montoInicial = dinero(sesion.montoInicial);
  const totalVentasContado = dinero(stats?.totalContado ?? 0);
  const montoEsperado =
    sesion.estado === "cerrada" && sesion.montoFinalEsperado
      ? dinero(sesion.montoFinalEsperado)
      : dinero(montoInicial + totalVentasContado);

  const diferencia = sesion.diferencia ? dinero(sesion.diferencia) : null;
  const montoReal = sesion.montoFinalReal ? dinero(sesion.montoFinalReal) : null;

  const estaAbierta = sesion.estado === "abierta";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={sesion.cajaNombre}
        subtitle={`Sesión ${estaAbierta ? "en curso" : "cerrada"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={estaAbierta ? "success" : "neutral"}>
              {estaAbierta ? "Abierta" : "Cerrada"}
            </Badge>
            <Link href="/caja" className="arca-btn arca-btn-secondary arca-btn-sm">
              ← Volver
            </Link>
          </div>
        }
      />

      {/* Resumen */}
      <Card>
        <CardHeader title="Resumen de sesión" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato label="Cajero" valor={sesion.usuarioNombre} />
            <Dato label="Apertura" valor={formatDt(sesion.abiertaEn)} />
            {sesion.cerradaEn && <Dato label="Cierre" valor={formatDt(sesion.cerradaEn)} />}
            <Dato label="Monto inicial" valor={formatearMoneda(montoInicial, pais)} />
            <Dato
              label="Ventas contado"
              valor={`${stats?.totalVentas ?? 0} · ${formatearMoneda(totalVentasContado, pais)}`}
            />
            <Dato
              label={estaAbierta ? "Monto esperado" : "Esperado al cierre"}
              valor={formatearMoneda(montoEsperado, pais)}
            />
          </div>
          {sesion.notas && (
            <p className="mt-4 text-small text-[color:var(--color-text-muted)]">
              {sesion.notas}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Resultado del arqueo (sesión cerrada) */}
      {!estaAbierta && montoReal !== null && diferencia !== null && (
        <Card>
          <CardHeader title="Resultado del arqueo" />
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <Dato label="Esperado" valor={formatearMoneda(montoEsperado, pais)} />
              <Dato label="Contado" valor={formatearMoneda(montoReal, pais)} />
              <Dato
                label="Diferencia"
                valor={`${diferencia >= 0 ? "+" : ""}${formatearMoneda(diferencia, pais)}`}
                className={
                  diferencia < -0.0001
                    ? "text-[color:var(--color-error)] font-bold"
                    : diferencia > 0.0001
                      ? "text-[color:var(--color-success)] font-bold"
                      : "text-[color:var(--color-text-muted)]"
                }
              />
            </div>
            {Math.abs(diferencia) <= 0.0001 && (
              <p className="mt-3 text-small text-[color:var(--color-success)]">
                Caja cuadrada. Sin diferencia.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Formulario de cierre */}
      {estaAbierta && (
        <ArqueoForm sesionId={sesionId} montoEsperado={montoEsperado} pais={pais} />
      )}
    </div>
  );
}

function Dato({
  label,
  valor,
  className,
}: {
  label: string;
  valor: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-label mb-0.5">{label}</div>
      <div className={`text-small font-medium ${className ?? ""}`}>{valor}</div>
    </div>
  );
}
