import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { construirLibro } from "@/lib/excel/builder";
import { RECURSOS, type ExportCtx } from "@/lib/excel/recursos";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recurso: string }> },
) {
  const { recurso } = await params;
  const def = RECURSOS[recurso];
  if (!def) {
    return new NextResponse("Recurso de exportación no encontrado", { status: 404 });
  }

  const user = await requireSession();
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const zonaHoraria = empresa?.zonaHoraria ?? getPaisConfig(pais).zonaHoraria;
  const sucursalIds = selectedSucursalIds(scope);

  const ctx: ExportCtx = {
    user,
    empresa: empresa
      ? {
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial,
          identificacionFiscal: empresa.identificacionFiscal,
          pais,
          zonaHoraria,
        }
      : null,
    pais,
    zonaHoraria,
    sucursalIds,
    params: req.nextUrl.searchParams,
  };

  const filas = await def.query(ctx);
  const subtituloPartes: string[] = [];
  const sub = def.subtitulo?.(ctx);
  if (sub) subtituloPartes.push(sub);
  if (scope.visible) subtituloPartes.push(scope.etiqueta);

  const buffer = await construirLibro({
    empresa: ctx.empresa ?? { pais },
    titulo: def.titulo,
    subtitulo: subtituloPartes.length ? subtituloPartes.join(" · ") : undefined,
    columnas: def.columnas,
    filas,
    zonaHoraria,
  });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `${slugify(def.titulo)}-${fecha}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
