import Link from "next/link";
import {
  Building2,
  BriefcaseBusiness,
  Users,
  Percent,
  CreditCard,
  Receipt,
  Lock,
  Wallet,
  MonitorCog,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";

const MODULOS = [
  { href: "/configuracion/empresa", icon: BriefcaseBusiness, titulo: "Empresa", descripcion: "Giro del negocio y datos generales" },
  { href: "/configuracion/sucursales", icon: Building2, titulo: "Sucursales", descripcion: "Puntos de operación de tu negocio" },
  { href: "/configuracion/usuarios", icon: Users, titulo: "Usuarios", descripcion: "Equipo con acceso al sistema" },
  { href: "/configuracion/roles", icon: Lock, titulo: "Roles y permisos", descripcion: "Qué puede hacer cada rol" },
  { href: "/configuracion/cajas", icon: Receipt, titulo: "Cajas", descripcion: "Cajas físicas por sucursal" },
  { href: "/configuracion/impuestos", icon: Percent, titulo: "Impuestos", descripcion: "Tasas aplicables por país" },
  { href: "/configuracion/formas-pago", icon: CreditCard, titulo: "Formas de pago", descripcion: "Métodos aceptados en el POS" },
  { href: "/configuracion/dispositivos", icon: MonitorCog, titulo: "Dispositivos", descripcion: "Lector, impresora y caja" },
  { href: "/configuracion/cuentas-financieras", icon: Wallet, titulo: "Cuentas financieras", descripcion: "Caja, bancos y tarjetas" },
  { href: "/configuracion/facturacion", icon: Receipt, titulo: "Facturación fiscal", descripcion: "Secuencias y CAI / autorización" },
];

export default function ConfiguracionPage() {
  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajusta el sistema a tu operación" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULOS.map((m) => (
          <Link key={m.href} href={m.href} className="group">
            <Card className="h-full transition hover:border-[color:var(--color-tertiary)] hover:shadow-md">
              <CardBody>
                <div className="mb-3 inline-flex rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-tertiary)]/20">
                  <m.icon size={18} />
                </div>
                <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                  {m.titulo}
                </div>
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {m.descripcion}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
