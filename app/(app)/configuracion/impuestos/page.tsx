import { desc, eq, sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  codigosProductoFiscal,
  impuestos,
  jurisdiccionesFiscales,
  perfilesFiscales,
  reglasImpuestoFiscal,
  snapshotsImpuestoFiscal,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CrearImpuestoForm } from "@/components/configuracion/CrearImpuestoForm";
import { TASA_SEGURIDAD_SOCIAL } from "@/lib/rrhh";
import type { PaisCodigo } from "@/lib/paises";

type Fila = {
  id: string;
  codigo: string;
  nombre: string;
  tasa: string;
  esRetencion: boolean;
  activo: boolean;
};

type ReglaFiscalFila = {
  id: string;
  codigo: string;
  nombre: string;
  autoridad: string;
  tasa: string;
  productoCodigo: string;
  productoNombre: string;
  fuente: string | null;
  activo: boolean;
};

export default async function ImpuestosPage() {
  const user = await requireSession();

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const tasaInss = TASA_SEGURIDAD_SOCIAL[pais] ?? 0.07;

  const [
    filas,
    perfiles,
    jurisdicciones,
    productosFiscales,
    reglasFiscales,
    snapshotsResumen,
  ] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: impuestos.id,
          codigo: impuestos.codigo,
          nombre: impuestos.nombre,
          tasa: impuestos.tasa,
          esRetencion: impuestos.esRetencion,
          activo: impuestos.activo,
        })
        .from(impuestos)
        .where(eq(impuestos.empresaId, user.empresaId)),
      tx
        .select({
          id: perfilesFiscales.id,
          pais: perfilesFiscales.pais,
          identificacionFiscal: perfilesFiscales.identificacionFiscal,
          nombreFiscal: perfilesFiscales.nombreFiscal,
          regimenFiscal: perfilesFiscales.regimenFiscal,
          facturaElectronicaActiva: perfilesFiscales.facturaElectronicaActiva,
          proveedorFiscal: perfilesFiscales.proveedorFiscal,
          activo: perfilesFiscales.activo,
        })
        .from(perfilesFiscales)
        .where(eq(perfilesFiscales.empresaId, user.empresaId))
        .orderBy(perfilesFiscales.pais),
      tx
        .select({
          id: jurisdiccionesFiscales.id,
          codigo: jurisdiccionesFiscales.codigo,
          nombre: jurisdiccionesFiscales.nombre,
          tipo: jurisdiccionesFiscales.tipo,
          metadata: jurisdiccionesFiscales.metadata,
          activo: jurisdiccionesFiscales.activo,
        })
        .from(jurisdiccionesFiscales)
        .where(eq(jurisdiccionesFiscales.empresaId, user.empresaId))
        .orderBy(jurisdiccionesFiscales.codigo),
      tx
        .select({
          id: codigosProductoFiscal.id,
          codigo: codigosProductoFiscal.codigo,
          nombre: codigosProductoFiscal.nombre,
          categoria: codigosProductoFiscal.categoria,
          activo: codigosProductoFiscal.activo,
        })
        .from(codigosProductoFiscal)
        .where(eq(codigosProductoFiscal.empresaId, user.empresaId))
        .orderBy(codigosProductoFiscal.categoria, codigosProductoFiscal.codigo),
      tx
        .select({
          id: reglasImpuestoFiscal.id,
          codigo: reglasImpuestoFiscal.codigo,
          nombre: reglasImpuestoFiscal.nombre,
          autoridad: reglasImpuestoFiscal.autoridad,
          tasa: reglasImpuestoFiscal.tasa,
          productoCodigo: codigosProductoFiscal.codigo,
          productoNombre: codigosProductoFiscal.nombre,
          fuente: reglasImpuestoFiscal.fuente,
          activo: reglasImpuestoFiscal.activo,
        })
        .from(reglasImpuestoFiscal)
        .innerJoin(
          codigosProductoFiscal,
          eq(codigosProductoFiscal.id, reglasImpuestoFiscal.productoFiscalId),
        )
        .where(eq(reglasImpuestoFiscal.empresaId, user.empresaId))
        .orderBy(desc(reglasImpuestoFiscal.activo), reglasImpuestoFiscal.codigo),
      tx
        .select({
          total: sql<string>`count(*)`,
          impuesto: sql<string>`coalesce(sum(${snapshotsImpuestoFiscal.impuesto}), 0)`,
          ultimaFecha: sql<Date | null>`max(${snapshotsImpuestoFiscal.fecha})`,
        })
        .from(snapshotsImpuestoFiscal)
        .where(eq(snapshotsImpuestoFiscal.empresaId, user.empresaId)),
    ]),
  );

  const impuestosFilas = filas as Fila[];
  const reglas = reglasFiscales as ReglaFiscalFila[];
  const resumenSnapshots = snapshotsResumen[0] ?? { total: "0", impuesto: "0", ultimaFecha: null };

  const columnas: Columna<Fila>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (r) => <span className="font-mono text-[12px]">{r.codigo}</span>,
      width: "100px",
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (r) => <span className="font-medium">{r.nombre}</span>,
    },
    {
      key: "tasa",
      header: "Tasa",
      align: "right",
      cell: (r) => `${(parseFloat(r.tasa) * 100).toFixed(2)}%`,
      width: "120px",
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esRetencion ? <Badge variant="warning">Retención</Badge> : <Badge variant="info">Trasladado</Badge>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => (r.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="neutral">Inactivo</Badge>),
      width: "100px",
    },
  ];

  const columnasReglas: Columna<ReglaFiscalFila>[] = [
    {
      key: "producto",
      header: "Producto fiscal",
      cell: (r) => (
        <div>
          <div className="font-mono text-[12px]">{r.productoCodigo}</div>
          <div className="text-small text-[color:var(--color-text-muted)]">{r.productoNombre}</div>
        </div>
      ),
    },
    {
      key: "regla",
      header: "Regla",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.nombre}</div>
          <div className="font-mono text-[12px] text-[color:var(--color-text-muted)]">{r.codigo}</div>
        </div>
      ),
    },
    {
      key: "autoridad",
      header: "Autoridad",
      cell: (r) => r.autoridad,
    },
    {
      key: "tasa",
      header: "Tasa",
      align: "right",
      cell: (r) => `${(parseFloat(r.tasa) * 100).toFixed(2)}%`,
      width: "120px",
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => (r.activo ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>),
      width: "110px",
    },
  ];

  const perfilPrincipal = perfiles[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impuestos"
        subtitle={`${impuestosFilas.length} impuestos configurados`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="impuestos" />
            <CrearImpuestoForm tasaInssPct={tasaInss} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Perfil fiscal" subtitle={`${empresa?.pais ?? "NI"} / ${empresa?.moneda ?? "NIO"}`} />
          <CardBody className="space-y-3 text-small">
            <FilaResumen label="Nombre fiscal" value={perfilPrincipal?.nombreFiscal ?? empresa?.razonSocial ?? "Sin configurar"} />
            <FilaResumen label="Identificación" value={perfilPrincipal?.identificacionFiscal ?? empresa?.identificacionFiscal ?? "Sin configurar"} />
            <FilaResumen label="Régimen" value={perfilPrincipal?.regimenFiscal ?? "Pendiente"} />
            <FilaResumen
              label="Factura electrónica"
              value={perfilPrincipal?.facturaElectronicaActiva ? "Activa" : "Pendiente"}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Jurisdicciones" subtitle={`${jurisdicciones.length} configuradas`} />
          <CardBody className="space-y-3 text-small">
            {jurisdicciones.length === 0 ? (
              <p className="text-[color:var(--color-text-muted)]">Sin jurisdicciones fiscales.</p>
            ) : (
              jurisdicciones.slice(0, 4).map((jurisdiccion) => (
                <div key={jurisdiccion.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{jurisdiccion.nombre}</div>
                    <div className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                      {jurisdiccion.codigo} / {jurisdiccion.tipo}
                    </div>
                  </div>
                  <Badge variant={jurisdiccion.activo ? "success" : "neutral"}>
                    {jurisdiccion.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Snapshots fiscales" subtitle="Evidencia append-only de ventas" />
          <CardBody className="space-y-3 text-small">
            <FilaResumen label="Snapshots" value={resumenSnapshots.total} />
            <FilaResumen label="Impuesto registrado" value={Number(resumenSnapshots.impuesto).toLocaleString("es", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} />
            <FilaResumen
              label="Último snapshot"
              value={resumenSnapshots.ultimaFecha ? resumenSnapshots.ultimaFecha.toLocaleString("es") : "Sin actividad"}
            />
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">Impuestos base</h2>
        <DataTable data={impuestosFilas} columns={columnas} rowKey={(r) => r.id} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">Reglas fiscales</h2>
            <p className="text-small text-[color:var(--color-text-muted)]">
              Relacionan producto fiscal, jurisdicción e impuesto para snapshots de venta.
            </p>
          </div>
          <Badge variant="info">{productosFiscales.length} códigos de producto</Badge>
        </div>
        <DataTable
          data={reglas}
          columns={columnasReglas}
          rowKey={(r) => r.id}
          empty="No hay reglas fiscales configuradas."
        />
      </section>
    </div>
  );
}

function FilaResumen({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="text-right font-medium text-[color:var(--color-text-primary)]">{value}</span>
    </div>
  );
}
