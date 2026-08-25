import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import { empresas, sucursales } from "@/lib/db/schema";

const cargarEmpresa = unstable_cache(
  async (empresaId: string) => {
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
  },
  ["empresa-metadata-v1"],
  { revalidate: 300, tags: ["empresa-metadata"] },
);

const cargarSucursalesActivas = unstable_cache(
  async (empresaId: string) =>
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
    ),
  ["sucursales-activas-v1"],
  { revalidate: 60 },
);

export const getEmpresaMetadata = cache((empresaId: string) =>
  cargarEmpresa(empresaId),
);

export const getSucursalesActivas = cache((empresaId: string) =>
  cargarSucursalesActivas(empresaId),
);
