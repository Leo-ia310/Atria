import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { secuenciasFiscales, tiposDocumento, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrearSecuenciaForm } from "@/components/configuracion/CrearSecuenciaForm";
import { Receipt } from "lucide-react";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { formatearFecha } from "@/lib/utils";

export default async function FacturacionPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const config = getPaisConfig(pais);

  const filas = await db
    .select({
      id: secuenciasFiscales.id,
      documento: tiposDocumento.nombre,
      prefijo: secuenciasFiscales.prefijo,
      siguienteNumero: secuenciasFiscales.siguienteNumero,
      rangoInicial: secuenciasFiscales.rangoInicial,
      rangoFinal: secuenciasFiscales.rangoFinal,
      autorizacion: secuenciasFiscales.autorizacion,
      fechaLimite: secuenciasFiscales.fechaLimite,
      activa: secuenciasFiscales.activa,
    })
    .from(secuenciasFiscales)
    .leftJoin(tiposDocumento, eq(tiposDocumento.id, secuenciasFiscales.tipoDocumentoId))
    .where(eq(secuenciasFiscales.empresaId, user.empresaId));

  return (
    <div>
      <PageHeader
        title="Facturación fiscal"
        subtitle={`Secuencias y autorización de impresión · ${config.nombre}`}
        actions={<CrearSecuenciaForm idFiscalNombre={config.idFiscalNombre} />}
      />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            titulo="Sin secuencias fiscales"
            descripcion="Crea una secuencia para numerar facturas y otros documentos según la autorización de tu país."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((s) => (
            <Card key={s.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{s.documento ?? "Documento"}</span>
                  {s.activa ? (
                    <Badge variant="success">Activa</Badge>
                  ) : (
                    <Badge variant="neutral">Inactiva</Badge>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-[12px] text-[color:var(--color-text-muted)]">
                  {s.prefijo && <div>Prefijo: {s.prefijo}</div>}
                  <div>Siguiente: {s.siguienteNumero}</div>
                  {(s.rangoInicial || s.rangoFinal) && (
                    <div>
                      Rango: {s.rangoInicial ?? "—"} – {s.rangoFinal ?? "—"}
                    </div>
                  )}
                  {s.autorizacion && <div>Autorización: {s.autorizacion}</div>}
                  {s.fechaLimite && <div>Vence: {formatearFecha(s.fechaLimite)}</div>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
