import {
  CheckCircle2,
  CreditCard,
  Package,
  Store,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFecha } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RestaurantePlanButton } from "@/components/restaurante/RestaurantePlanButton";

export default async function RestaurantePlanPage() {
  const user = await requireSession();
  const access = await requireModulo(user, "restaurante-plan");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const plan = access.plan;
  const estado = access.suscripcionBloqueada
    ? "Pago pendiente"
    : access.suscripcionEstado === "trial"
      ? "Prueba gratis"
      : access.suscripcionEstado === "activa"
        ? "Activo"
        : access.suscripcionEstado
          ? labelEstado(access.suscripcionEstado)
          : "Sin suscripcion";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Plan y suscripcion"
        subtitle={`Cuenta de ${empresa?.nombreComercial || empresa?.razonSocial || "tu restaurante"}`}
        actions={
          <RestaurantePlanButton
            planNombre={plan.nombre}
            planActualId={plan.id}
            suscripcionEstado={access.suscripcionEstado}
            suscripcionFinISO={access.suscripcionFinPeriodo?.toISOString() ?? null}
            suscripcionBloqueada={access.suscripcionBloqueada}
          />
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader
            title={`Plan ${plan.nombre}`}
            subtitle="Resumen actual de facturacion y acceso"
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={access.suscripcionBloqueada ? "error" : "success"}>
                {estado}
              </Badge>
              {access.suscripcionFinPeriodo && (
                <Badge variant="info">
                  Vigente hasta {formatearFecha(access.suscripcionFinPeriodo)}
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <PlanLimit icon={Store} label="Sucursales incluidas" value={limite(plan.maxSucursales)} />
              <PlanLimit icon={UsersRound} label="Usuarios incluidos" value={limite(plan.maxUsuarios)} />
              <PlanLimit icon={Package} label="Productos incluidos" value={limite(plan.maxProductos)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Facturacion" subtitle="Estado visible para restaurante" />
          <CardBody className="space-y-3 text-small">
            <InfoRow label="Plan actual" value={plan.nombre} />
            <InfoRow label="Estado" value={estado} />
            <InfoRow
              label="Periodo"
              value={
                access.suscripcionFinPeriodo
                  ? formatearFecha(access.suscripcionFinPeriodo)
                  : "Sin fecha de corte"
              }
            />
            <InfoRow
              label="Sucursales extra"
              value={String(access.sucursalesExtra)}
            />
            <InfoRow label="Usuarios extra" value={String(access.usuariosExtra)} />
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Funciones activas"
          subtitle="Capacidades disponibles para operar el restaurante"
        />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Feature ok={plan.features.pos} label="POS restaurante" />
          <Feature ok={plan.features.inventario_basico || plan.features.inventario_avanzado} label="Inventario e insumos" />
          <Feature ok={plan.features.facturacion} label="Facturacion" />
          <Feature ok={plan.features.cuentas_por_cobrar} label="Cuentas por cobrar" />
          <Feature ok={plan.features.reportes_avanzados} label="Reportes avanzados" />
          <Feature ok={plan.features.soporte_chat} label="Soporte por chat" />
        </CardBody>
      </Card>
    </div>
  );
}

function PlanLimit({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
      <Icon size={16} className="text-[color:var(--color-secondary)]" />
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <div className="text-[12px] text-[color:var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function Feature({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
      <CheckCircle2
        size={15}
        className={ok ? "text-[color:var(--color-success)]" : "text-[color:var(--color-text-muted)]"}
      />
      <span className={ok ? "" : "text-[color:var(--color-text-muted)]"}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[color:var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function limite(valor: number | null): string {
  return valor === null ? "Ilimitado" : String(valor);
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    vencida: "Vencida",
    cancelada: "Cancelada",
    suspendida: "Suspendida",
  };
  return labels[estado] ?? estado;
}
