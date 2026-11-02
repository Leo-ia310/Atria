import { currentBusinessContext } from "./business-context";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { empresas, sucursales } from "@/lib/db/schema";

async function leerEmpresa(empresaId:string) {
    const [empresa] = await dbConEmpresa(empresaId, (tx) =>
      tx
        .select({
          id: empresas.id,
          pais: empresas.pais,
          moneda: empresas.moneda,
          tipoEmpresa: empresas.tipoEmpresa,
          verticalEmpresa: empresas.verticalEmpresa,
          razonSocial: empresas.razonSocial,
          nombreComercial: empresas.nombreComercial,
          identificacionFiscal: empresas.identificacionFiscal,
          direccion: empresas.direccion,
          telefono: empresas.telefono,
          zonaHoraria: empresas.zonaHoraria,
        })
        .from(empresas)
        .where(eq(empresas.id, empresaId))
        .limit(1),
    );

    if (!empresa) return null;
    return {
      ...empresa,
      verticalEmpresa:
        empresa.tipoEmpresa === "restaurante" ? "restaurante" : empresa.verticalEmpresa,
    };
}
const cargarEmpresa = unstable_cache(
  leerEmpresa,
  ["empresa-metadata-v1"],
  { revalidate: 300, tags: ["empresa-metadata"] },
);

const leerSucursalesActivas = async (empresaId: string) =>
    dbConEmpresa(empresaId, (tx) =>
      tx
        .select({
          id: sucursales.id,
          nombre: sucursales.nombre,
          esPrincipal: sucursales.esPrincipal,
        })
        .from(sucursales)
        .where(
          and(
            eq(sucursales.empresaId, empresaId),
            eq(sucursales.activa, true),
            isNull(sucursales.eliminadoEn),
          ),
        )
        .orderBy(sucursales.nombre),
    );
const cargarSucursalesActivas = unstable_cache(
  leerSucursalesActivas,
  ["sucursales-activas-v1"],
  { revalidate: 60 },
);

const empresaPorRequest=cache(cargarEmpresa);
const sucursalesPorRequest=cache(cargarSucursalesActivas);
export function getEmpresaMetadata(empresaId:string) {
  return currentBusinessContext() ? leerEmpresa(empresaId) : empresaPorRequest(empresaId);
}
export function getSucursalesActivas(empresaId:string) {
  return currentBusinessContext() ? leerSucursalesActivas(empresaId) : sucursalesPorRequest(empresaId);
}
