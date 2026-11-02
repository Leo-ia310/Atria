import { and, eq, gt, gte, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import { clientes, compras, proveedores } from "./db/schema";
import { listSearchPattern, type ListFilters } from "./list-filters";

export function customerListWhere(empresaId: string, f: ListFilters) {
  const pattern = listSearchPattern(f.q);
  return and(
    eq(clientes.empresaId, empresaId),
    isNull(clientes.eliminadoEn),
    f.q
      ? or(
          ilike(clientes.nombre, pattern),
          ilike(clientes.identificacionFiscal, pattern),
          ilike(clientes.telefono, pattern),
          ilike(clientes.email, pattern),
        )
      : undefined,
    f.tipo
      ? eq(clientes.esConsumidorFinal, f.tipo === "consumidor")
      : undefined,
    f.credito === "credito"
      ? gt(clientes.limiteCredito, "0")
      : f.credito === "contado"
        ? lte(clientes.limiteCredito, "0")
        : undefined,
    f.estado ? eq(clientes.activo, f.estado === "activo") : undefined,
  );
}
export function supplierListWhere(empresaId: string, f: ListFilters) {
  const pattern = listSearchPattern(f.q);
  return and(
    eq(proveedores.empresaId, empresaId),
    isNull(proveedores.eliminadoEn),
    f.q
      ? or(
          ilike(proveedores.razonSocial, pattern),
          ilike(proveedores.nombreComercial, pattern),
          ilike(proveedores.identificacionFiscal, pattern),
          ilike(proveedores.telefono, pattern),
          ilike(proveedores.email, pattern),
          ilike(proveedores.contacto, pattern),
        )
      : undefined,
    f.credito === "credito"
      ? gt(proveedores.diasCredito, 0)
      : f.credito === "contado"
        ? lte(proveedores.diasCredito, 0)
        : undefined,
    f.estado ? eq(proveedores.activo, f.estado === "activo") : undefined,
  );
}
export function purchaseListWhere(
  empresaId: string,
  branches: string[] | null,
  f: ListFilters,
) {
  const pattern = listSearchPattern(f.q);
  return and(
    eq(compras.empresaId, empresaId),
    eq(proveedores.empresaId, empresaId),
    branches ? inArray(compras.sucursalId, branches) : undefined,
    f.q
      ? or(
          ilike(compras.numeroFactura, pattern),
          ilike(proveedores.razonSocial, pattern),
          ilike(proveedores.nombreComercial, pattern),
        )
      : undefined,
    f.credito ? eq(compras.esCredito, f.credito === "credito") : undefined,
    f.estado === "borrador" ||
      f.estado === "recibida" ||
      f.estado === "parcial" ||
      f.estado === "anulada"
      ? eq(compras.estado, f.estado)
      : undefined,
    f.desde ? gte(compras.fecha, f.desde) : undefined,
    f.hasta ? lte(compras.fecha, f.hasta) : undefined,
    f.minimo ? gte(compras.total, f.minimo) : undefined,
    f.maximo ? lte(compras.total, f.maximo) : undefined,
  );
}
