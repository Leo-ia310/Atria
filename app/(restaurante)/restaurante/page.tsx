import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock,
  Gift,
  LifeBuoy,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Table2,
  TrendingDown,
  TrendingUp,
  Utensils,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { cargarDashboardRestaurante } from "@/lib/restaurante/queries";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestauranteDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string; acceso?: string; cuenta?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, requireSession()]);
  await requireModulo(user, "restaurante-dashboard");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const zonaHoraria = empresa?.zonaHoraria ?? "America/Managua";
  const data = await cargarDashboardRestaurante({
    empresaId: user.empresaId,
    sucursalIds: selectedSucursalIds(scope),
    zonaHoraria,
  });
  const deltaVentas = data.ventasHoy - data.ventasAyer;
  const mesasDisponibles = data.mesas.disponible ?? 0;
  const mesasOcupadas = data.mesas.ocupada ?? 0;
  const mesasPorLimpiar = data.mesas.por_limpiar ?? 0;
  const totalMesas = Object.values(data.mesas).reduce((total, n) => total + n, 0);
  const accesosPorSeccion: Array<{
    title: string;
    subtitle: string;
    items: ModuleTileProps[];
  }> = [
    {
      title: "Atencion",
      subtitle: "Venta, salon y seguimiento del cliente.",
      items: [
        {
          href: "/restaurante/pos",
          title: "POS restaurante",
          subtitle: "Cobro rapido para mesas, barra y pedidos para llevar",
          icon: ShoppingCart,
          metricLabel: "Ventas de hoy",
          metricValue: formatearMoneda(data.ventasHoy, pais),
        },
        {
          href: "/restaurante/mesas",
          title: "Salon",
          subtitle: "Mesas, areas, capacidades y estados",
          icon: Table2,
          metricLabel: "Mesas ocupadas",
          metricValue: `${mesasOcupadas}/${totalMesas}`,
        },
        {
          href: "/restaurante/ordenes",
          title: "Ordenes",
          subtitle: "Cuentas abiertas, comandas enviadas y cierre",
          icon: ClipboardList,
          metricLabel: "Ordenes abiertas",
          metricValue: String(data.ordenesAbiertas),
        },
        {
          href: "/restaurante/comensales",
          title: "Comensales",
          subtitle: "CRM, preferencias, historial y fidelizacion",
          icon: UsersRound,
          metricLabel: "Atendidos hoy",
          metricValue: String(data.comensalesAtendidos),
        },
      ],
    },
    {
      title: "Cocina",
      subtitle: "Preparacion, carta QR, recetas e inventario.",
      items: [
        {
          href: "/restaurante/kds",
          title: "KDS",
          subtitle: "Pantalla de cocina por estacion y prioridad",
          icon: ChefHat,
          metricLabel: "Pedidos en cocina",
          metricValue: String(data.pedidosCocina),
        },
        {
          href: "/restaurante/menu",
          title: "Carta QR",
          subtitle: "Menu publico, platillos, QR y disponibilidad",
          icon: Utensils,
          metricLabel: "Platillos destacados",
          metricValue: String(data.topPlatillos.length),
        },
        {
          href: "/restaurante/recetas",
          title: "Recetas",
          subtitle: "Preparaciones, porciones, costos y margenes",
          icon: Receipt,
          metricLabel: "Food cost estimado",
          metricValue: `${data.foodCostPct.toFixed(2)}%`,
        },
        {
          href: "/restaurante/inventario",
          title: "Insumos",
          subtitle: "Stock minimo, vencimientos y compras sugeridas",
          icon: Package,
          metricLabel: "Alertas de stock",
          metricValue: String(data.insumosBajos.length),
        },
        {
          href: "/restaurante/mermas",
          title: "Mermas",
          subtitle: "Caducidad, preparacion, accidentes y cortesia",
          icon: Package,
          metricLabel: "Registros hoy",
          metricValue: String(data.mermasHoy),
        },
      ],
    },
    {
      title: "Reservas",
      subtitle: "Recepcion, agenda y promociones.",
      items: [
        {
          href: "/restaurante/reservaciones",
          title: "Reservas",
          subtitle: "Agenda, lista de espera y ocasiones especiales",
          icon: CalendarDays,
          metricLabel: "Reservas proximas",
          metricValue: String(data.reservacionesProximas),
        },
        {
          href: "/restaurante/promociones",
          title: "Promociones",
          subtitle: "Ofertas por horario, segmento o platillo",
          icon: Gift,
          metricLabel: "Promos activas",
          metricValue: String(data.promocionesActivas),
        },
      ],
    },
    {
      title: "Gestion",
      subtitle: "Indicadores, configuracion y ayuda.",
      items: [
        {
          href: "/restaurante/reportes",
          title: "Reportes",
          subtitle: "Ventas, margen, ranking y food cost",
          icon: BarChart3,
          metricLabel: "Margen bruto",
          metricValue: formatearMoneda(data.margenBruto, pais),
        },
        {
          href: "/restaurante/configuracion",
          title: "Configuracion",
          subtitle: "Empresa, dispositivos, plan y ajustes del restaurante",
          icon: Settings,
          metricLabel: "Entorno",
          metricValue: "Restaurante",
        },
        {
          href: "/restaurante/soporte",
          title: "Soporte",
          subtitle: "Ayuda enfocada en salon, cocina, QR y reservas",
          icon: LifeBuoy,
          metricLabel: "Canal",
          metricValue: "ARCA",
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">{scope.visible ? scope.etiqueta : "Todas las sucursales"}</p>
          <h1 className="mt-1 text-xl">Operaciones del restaurante</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Ventas, mesas, cocina e inventario del turno actual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/restaurante/pos" className="arca-btn arca-btn-primary arca-btn-sm">
            Abrir POS
          </Link>
          <Link href="/restaurante/kds" className="arca-btn arca-btn-secondary arca-btn-sm">
            Ver KDS
          </Link>
        </div>
      </header>

      {params.bienvenida === "1" && (
        <div className="rounded-md border border-[color:var(--color-tertiary)]/50 bg-[color:var(--color-tertiary-light)]/25 px-4 py-3 text-small text-[color:var(--color-text-primary)]">
          ARCA Restaurante esta activo para tu empresa. El nucleo de caja, ventas,
          inventario, compras y contabilidad sigue siendo el mismo.
        </div>
      )}

      {params.acceso === "denegado" && (
        <div className="rounded-md border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning-bg)] px-4 py-3 text-small text-[color:var(--color-warning)]">
          Ese modulo no esta disponible para tu usuario. Te mantuvimos dentro de ARCA Restaurante.
        </div>
      )}

      <SectionHeader
        eyebrow="Resumen"
        title="Turno de hoy"
        subtitle="Indicadores principales del restaurante en tiempo real."
      />
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          value={formatearMoneda(data.ventasHoy, pais)}
          hint={
            deltaVentas >= 0
              ? `+${formatearMoneda(deltaVentas, pais)} vs ayer`
              : `${formatearMoneda(deltaVentas, pais)} vs ayer`
          }
          icon={deltaVentas >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="Ordenes del dia"
          value={String(data.ordenesHoy)}
          hint={`${data.ordenesAbiertas} abiertas ahora`}
          icon={Receipt}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatearMoneda(data.ticketPromedio, pais)}
          hint={`${data.comensalesAtendidos} comensales atendidos`}
          icon={UsersRound}
        />
        <KpiCard
          label="Food Cost estimado"
          value={`${data.foodCostPct.toFixed(2)}%`}
          hint={`Margen bruto ${formatearMoneda(data.margenBruto, pais)}`}
          icon={Package}
        />
      </section>

      <SectionHeader
        eyebrow="Operacion"
        title="Salon, cocina y recepcion"
        subtitle="Cada area abre una vista propia del vertical restaurante."
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Mesas" subtitle="Estado operativo del salon" />
          <CardBody className="space-y-3">
            <MesaEstado label="Ocupadas" value={mesasOcupadas} tone="warning" />
            <MesaEstado label="Disponibles" value={mesasDisponibles} tone="success" />
            <MesaEstado label="Por limpiar" value={mesasPorLimpiar} tone="error" />
            <MesaEstado label="Cuenta solicitada" value={data.mesas.cuenta_solicitada ?? 0} tone="info" />
            <Link href="/restaurante/mesas" className="arca-btn arca-btn-secondary arca-btn-sm w-full">
              <Table2 size={14} /> Administrar mesas
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cocina" subtitle="Carga viva del KDS" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi icon={ChefHat} label="En cocina" value={data.pedidosCocina} />
              <MiniKpi
                icon={Clock}
                label="Prep prom."
                value={`${Math.round(data.tiempoPromedioPreparacionMin)} min`}
              />
            </div>
            <Link href="/restaurante/kds" className="arca-btn arca-btn-primary arca-btn-sm w-full">
              Abrir cocina
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recepcion" subtitle="Reservas y lista de espera" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi icon={CalendarDays} label="Reservas" value={data.reservacionesProximas} />
              <MiniKpi icon={UsersRound} label="Espera" value={data.listaEspera} />
            </div>
            <Link href="/restaurante/reservaciones" className="arca-btn arca-btn-secondary arca-btn-sm w-full">
              Ver recepcion
            </Link>
          </CardBody>
        </Card>
      </section>

      <SectionHeader
        eyebrow="Modulos"
        title="Accesos por area"
        subtitle="Todos estos accesos se quedan dentro de /restaurante."
      />
      <div className="space-y-5">
        {accesosPorSeccion.map((grupo) => (
          <section key={grupo.title} className="space-y-3">
            <SectionTitle title={grupo.title} subtitle={grupo.subtitle} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grupo.items.map((item) => (
                <ModuleTile key={item.href} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <SectionHeader
        eyebrow="Control"
        title="Rendimiento e insumos"
        subtitle="Ranking de venta y alertas para compras o preparacion."
      />
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Platillos mas vendidos" subtitle="Ultimos 30 dias" />
          <CardBody>
            {data.topPlatillos.length === 0 ? (
              <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                Aun no hay suficientes ordenes para ranking.
              </p>
            ) : (
              <div className="space-y-3">
                {data.topPlatillos.map((item) => (
                  <div key={item.nombre} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-small font-medium">{item.nombre}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {item.unidades.toFixed(0)} unidades
                      </div>
                    </div>
                    <span className="font-semibold">{formatearMoneda(item.ingresos, pais)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alertas de insumos" subtitle="Bajo minimo o por vencer" />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-2 text-label">Proximos a agotarse</div>
              {data.insumosBajos.length === 0 ? (
                <p className="text-small text-[color:var(--color-text-muted)]">Sin alertas de stock.</p>
              ) : (
                <div className="space-y-2">
                  {data.insumosBajos.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                      <span className="truncate">{item.nombre}</span>
                      <Badge variant="warning">
                        {item.stock.toFixed(2)} / min {item.minimo.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-2 text-label">Proximos a vencer</div>
              {data.insumosVencen.length === 0 ? (
                <p className="text-small text-[color:var(--color-text-muted)]">Sin vencimientos cercanos.</p>
              ) : (
                <div className="space-y-2">
                  {data.insumosVencen.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                      <span className="truncate">{item.nombre}</span>
                      <Badge variant="error">{item.fecha}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="pt-2">
      <p className="text-label">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
        {subtitle}
      </p>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
        {subtitle}
      </p>
    </div>
  );
}

type ModuleTileProps = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  metricLabel: string;
  metricValue: string;
};

function ModuleTile({
  href,
  title,
  subtitle,
  icon: Icon,
  metricLabel,
  metricValue,
}: ModuleTileProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[116px] flex-col justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-2)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{title}</h3>
          <p className="mt-1 line-clamp-2 text-small text-[color:var(--color-text-muted)]">
            {subtitle}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)] group-hover:text-[color:var(--color-text-on-primary)]">
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 text-small">
        <span className="text-[color:var(--color-text-muted)]">{metricLabel}</span>
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {metricValue}
        </span>
      </div>
    </Link>
  );
}

function MesaEstado({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "error" | "info";
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-[color:var(--color-surface-2)] px-3 py-2">
      <span className="text-small text-[color:var(--color-text-secondary)]">{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ChefHat;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
      <Icon size={16} className="text-[color:var(--color-secondary)]" />
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <div className="text-[12px] text-[color:var(--color-text-muted)]">{label}</div>
    </div>
  );
}
