import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas, menusVirtuales, pedidosCocina } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { palabraConfirmacionAleatoria } from "@/lib/restaurante/confirmacion";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmpresaTipoForm } from "@/components/configuracion/EmpresaTipoForm";
import { PoliticasNegocioForm } from "@/components/configuracion/PoliticasNegocioForm";
import { ConfiguracionNegocioForm } from "@/components/configuracion/ConfiguracionNegocioForm";
import { getPoliticasNegocio } from "@/lib/politicas-negocio";
import { getConfiguracionNegocio } from "@/lib/configuracion-negocio";

export default async function EmpresaConfiguracionPage() {
  const user = await requireSession();
  await requireModulo(user, "configuracion");

  const [[empresa], [menus], [pedidos], politicas, configNegocio] = await Promise.all([
    db
      .select({
        razonSocial: empresas.razonSocial,
        nombreComercial: empresas.nombreComercial,
        identificacionFiscal: empresas.identificacionFiscal,
        tipoEmpresa: empresas.tipoEmpresa,
        pais: empresas.pais,
        moneda: empresas.moneda,
      })
      .from(empresas)
      .where(eq(empresas.id, user.empresaId))
      .limit(1),
    db
      .select({ n: count() })
      .from(menusVirtuales)
      .where(eq(menusVirtuales.empresaId, user.empresaId)),
    db
      .select({ n: count() })
      .from(pedidosCocina)
      .where(eq(pedidosCocina.empresaId, user.empresaId)),
    getPoliticasNegocio(user.empresaId),
    getConfiguracionNegocio(user.empresaId),
  ]);
  const datosRestaurante = {
    menus: menus?.n ?? 0,
    pedidos: pedidos?.n ?? 0,
    total: (menus?.n ?? 0) + (pedidos?.n ?? 0),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Empresa"
        subtitle="Datos generales y giro del negocio"
      />

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                {empresa?.nombreComercial || empresa?.razonSocial || "Empresa"}
              </div>
              <div className="mt-1 text-small text-[color:var(--color-text-muted)]">
                {empresa?.razonSocial}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {empresa?.identificacionFiscal && (
                  <Badge variant="neutral">{empresa.identificacionFiscal}</Badge>
                )}
                {empresa?.pais && <Badge variant="info">{empresa.pais}</Badge>}
                {empresa?.moneda && <Badge variant="success">{empresa.moneda}</Badge>}
              </div>
            </div>
            <Badge variant={empresa?.tipoEmpresa === "restaurante" ? "warning" : "neutral"}>
              {labelTipo(empresa?.tipoEmpresa ?? "general")}
            </Badge>
          </div>
        </CardBody>
      </Card>

      <ConfiguracionNegocioForm defaults={configNegocio} />

      <PoliticasNegocioForm defaults={politicas} />

      <EmpresaTipoForm
        tipoInicial={empresa?.tipoEmpresa ?? "general"}
        datosRestaurante={datosRestaurante}
        palabraConfirmacion={palabraConfirmacionAleatoria()}
      />
    </div>
  );
}

function labelTipo(tipo: string): string {
  const labels: Record<string, string> = {
    general: "Comercio general",
    restaurante: "Restaurante",
    retail: "Retail",
    servicios: "Servicios",
  };
  return labels[tipo] ?? tipo;
}
