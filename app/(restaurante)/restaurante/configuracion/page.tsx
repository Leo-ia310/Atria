import Link from "next/link";
import type { Metadata } from "next";
import {
  Banknote,
  Building2,
  CalendarDays,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  CreditCard,
  Gift,
  LifeBuoy,
  MonitorSmartphone,
  Package,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Table2,
  Truck,
  UserRound,
  UserCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Configuracion Restaurante | ARCA",
  description: "Configuracion de empresa, cuenta y modulos operativos de ARCA Restaurante.",
};

type ConfigCard = {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
};

const CONFIG_RESTAURANTE: ConfigCard[] = [
  {
    href: "/restaurante/mesas",
    title: "Salon y mesas",
    text: "Areas, mesas, capacidades, estados y QR por mesa.",
    icon: Table2,
  },
  {
    href: "/restaurante/menu",
    title: "Carta QR",
    text: "Menus publicos, platillos, disponibilidad y QR general.",
    icon: QrCode,
  },
  {
    href: "/restaurante/recetas",
    title: "Recetas y estaciones",
    text: "Preparaciones, estaciones de cocina, insumos y costo por porcion.",
    icon: ChefHat,
  },
  {
    href: "/restaurante/inventario",
    title: "Insumos",
    text: "Clasificacion de productos, stock critico y control de cocina.",
    icon: Package,
  },
  {
    href: "/restaurante/existencias",
    title: "Existencias y kardex",
    text: "Stock por almacen, movimientos, conteos, transferencias y vencimientos.",
    icon: ClipboardList,
  },
  {
    href: "/restaurante/reservaciones",
    title: "Recepcion",
    text: "Reservas, lista de espera y atencion de comensales.",
    icon: CalendarDays,
  },
  {
    href: "/restaurante/promociones",
    title: "Promociones",
    text: "Ofertas de carta, vigencias y activaciones por canal.",
    icon: Gift,
  },
];

const CORE_RESTAURANTE: ConfigCard[] = [
  {
    href: "/restaurante/compras",
    title: "Compras",
    text: "Proveedores, ordenes, recepciones, compras sugeridas y CxP.",
    icon: Truck,
  },
  {
    href: "/restaurante/caja",
    title: "Caja y turnos",
    text: "Apertura, medios de pago, arqueos y diferencias auditadas.",
    icon: Store,
  },
  {
    href: "/restaurante/facturacion",
    title: "Facturacion",
    text: "Comprobantes internos, facturas, impuestos y documentos fiscales configurados.",
    icon: Receipt,
  },
  {
    href: "/restaurante/tesoreria",
    title: "Tesoreria",
    text: "Cuentas financieras, gastos, pagos y conciliacion.",
    icon: Banknote,
  },
  {
    href: "/restaurante/empleados",
    title: "Equipo",
    text: "Empleados, puestos, asistencia, horarios y nomina.",
    icon: UserCheck,
  },
  {
    href: "/restaurante/auditoria",
    title: "Auditoria",
    text: "Cambios sensibles, anulaciones, descuentos, pagos, mermas y cierres.",
    icon: ShieldCheck,
  },
];

const CUENTA_RESTAURANTE: ConfigCard[] = [
  {
    href: "/restaurante/empresa",
    title: "Empresa",
    text: "Datos generales, giro de negocio, politicas comerciales y vertical restaurante.",
    icon: Building2,
  },
  {
    href: "/restaurante/dispositivos",
    title: "Dispositivos",
    text: "Lector de barras, impresora, caja y equipos usados en salon o barra.",
    icon: MonitorSmartphone,
  },
  {
    href: "/restaurante/plan",
    title: "Plan actual",
    text: "Suscripcion, limites, periodo vigente y opciones de pago o mejora.",
    icon: CreditCard,
  },
  {
    href: "/restaurante/mi-cuenta",
    title: "Mi perfil",
    text: "Datos del usuario, correo, telefono y cambio de contrasena.",
    icon: UserRound,
  },
  {
    href: "/restaurante/soporte",
    title: "Soporte restaurante",
    text: "Ayuda enfocada en salon, cocina, QR, reservas, insumos y reportes.",
    icon: LifeBuoy,
  },
];

const ADMINISTRACION: ConfigCard[] = [
  {
    href: "/restaurante/comensales",
    title: "Comensales",
    text: "CRM restaurante, visitas, preferencias y fidelizacion.",
    icon: UsersRound,
  },
  {
    href: "/restaurante/reportes",
    title: "Reportes",
    text: "Indicadores para revisar configuracion operativa y rentabilidad.",
    icon: Settings,
  },
  {
    href: "/restaurante/asistencia",
    title: "Asistencia",
    text: "Entradas, salidas y horas trabajadas del personal.",
    icon: CalendarCheck,
  },
  {
    href: "/restaurante/nomina",
    title: "Nomina",
    text: "Planillas, deducciones, pagos y asiento contable.",
    icon: WalletCards,
  },
];

export default async function RestauranteConfiguracionPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-configuracion");

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">Gestion restaurante</p>
        <h1 className="mt-1 text-xl">Configuracion ARCA Restaurante</h1>
        <p className="mt-1 max-w-3xl text-small text-[color:var(--color-text-muted)]">
          Ajusta salon, cocina, carta QR, insumos, reservas y promociones desde
          el mismo entorno de restaurante.
        </p>
      </header>

      <section className="space-y-3">
        <SectionTitle title="Empresa y cuenta" subtitle="Administracion general dentro de ARCA Restaurante." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CUENTA_RESTAURANTE.map((item) => (
            <ConfigTile key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Operacion" subtitle="Configuracion diaria del servicio." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CONFIG_RESTAURANTE.map((item) => (
            <ConfigTile key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Empresa operativa" subtitle="Modulos core adaptados al restaurante." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CORE_RESTAURANTE.map((item) => (
            <ConfigTile key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Administracion restaurante" subtitle="Seguimiento de clientes y control gerencial." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMINISTRACION.map((item) => (
            <ConfigTile key={item.href} {...item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
        {subtitle}
      </p>
    </div>
  );
}

function ConfigTile({ href, title, text, icon: Icon }: ConfigCard) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-2)]">
        <CardHeader title={title} subtitle={text} />
        <CardBody>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)] group-hover:text-[color:var(--color-text-on-primary)]">
            <Icon size={18} />
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
