"use client";

import { useState } from "react";
import { BarChart3, Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { formatearFechaHora } from "@/lib/utils";

type ReportType = {
  key: string;
  name: string;
  formats: string[];
};

type ReportExport = {
  id: string;
  type: string;
  format: string;
  status: string;
  fileUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export default function ReportesPage() {
  const catalogo = useApi<ReportType[]>("/reports/catalog");
  const exports = useApi<ReportExport[]>("/reports/exports");
  const { mostrar } = useToast();
  const [generando, setGenerando] = useState<string | null>(null);

  async function generar(tipo: string, formato: string) {
    setGenerando(`${tipo}-${formato}`);
    try {
      await apiClient.post("/reports/exports", { type: tipo, format: formato, filters: {} });
      mostrar("success", "Reporte encolado. Aparecerá cuando termine de generarse.");
      await exports.refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos encolar el reporte");
    } finally {
      setGenerando(null);
    }
  }

  const columnasExports: Columna<ReportExport>[] = [
    {
      key: "tipo",
      header: "Reporte",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.type}</div>
          <div className="text-[11px] text-[color:var(--color-text-muted)]">
            {formatearFechaHora(r.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "formato",
      header: "Formato",
      cell: (r) => (
        <span className="flex items-center gap-1">
          {r.format === "xlsx" || r.format === "csv" ? (
            <FileSpreadsheet size={12} />
          ) : (
            <FileText size={12} />
          )}
          {r.format.toUpperCase()}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => {
        const map: Record<string, "success" | "warning" | "error" | "neutral"> = {
          PENDING: "neutral",
          PROCESSING: "warning",
          COMPLETED: "success",
          FAILED: "error",
        };
        return <Badge variant={map[r.status] ?? "neutral"}>{r.status}</Badge>;
      },
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) =>
        r.fileUrl ? (
          <a
            href={r.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="atria-btn atria-btn-secondary atria-btn-sm"
          >
            <Download size={12} /> Descargar
          </a>
        ) : r.status === "FAILED" ? (
          <span
            className="text-[11px] text-[color:var(--color-error)]"
            title={r.errorMessage ?? ""}
          >
            Falló
          </span>
        ) : (
          <Loader2 size={14} className="ml-auto animate-spin text-[color:var(--color-text-muted)]" />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Genera exportaciones de tus datos" />

      <ApiAviso apiDisabled={catalogo.apiDisabled} error={catalogo.error} />

      <Card className="mb-6">
        <CardHeader title="Catálogo" subtitle="Selecciona el tipo y formato" />
        <CardBody>
          {!catalogo.data || catalogo.data.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              titulo="Cargando catálogo..."
              descripcion="Los reportes disponibles vienen del servidor."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {catalogo.data.map((r) => (
                <div
                  key={r.key}
                  className="rounded-md border border-[color:var(--color-border)] p-4"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="rounded-md bg-[color:var(--color-surface-2)] p-2 text-[color:var(--color-primary)]">
                      <BarChart3 size={16} />
                    </div>
                    <div>
                      <div className="text-small font-semibold">{r.name}</div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {r.key}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.formats.map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant="secondary"
                        loading={generando === `${r.key}-${f}`}
                        onClick={() => generar(r.key, f)}
                      >
                        {f.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Exportaciones recientes"
          subtitle={`${exports.data?.length ?? 0} reportes`}
        />
        <CardBody className="p-0">
          {!exports.data || exports.data.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Download}
                titulo="Sin exportaciones aún"
                descripcion="Genera un reporte arriba y aparecerá aquí cuando esté listo."
              />
            </div>
          ) : (
            <DataTable data={exports.data} columns={columnasExports} rowKey={(r) => r.id} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
