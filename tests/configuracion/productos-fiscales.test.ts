import assert from "node:assert/strict";
import test from "node:test";

import { productoSchema } from "../../lib/validations/productos";

const productoBase = {
  sku: "",
  codigoBarras: "",
  nombre: "Servicio de implementacion",
  descripcion: "",
  tipo: "servicio" as const,
  categoriaId: "",
  marcaId: "",
  unidadBaseId: "",
  impuestoId: "",
  precioBase: 100,
  costoPromedio: 0,
  stockMinimo: 0,
  stockMaximo: undefined,
  metodoCosteo: "promedio" as const,
  manejaLotes: false,
  manejaSeries: false,
  fechaVencimiento: "",
};

test("producto fiscal usa GENERAL_TAXABLE por defecto", () => {
  const parsed = productoSchema.parse(productoBase);

  assert.equal(parsed.productoFiscalCodigo, "GENERAL_TAXABLE");
});

test("producto fiscal acepta codigos especificos del catalogo", () => {
  const parsed = productoSchema.safeParse({
    ...productoBase,
    productoFiscalCodigo: "RESTAURANTE_PREPARED_FOOD",
  });

  assert.equal(parsed.success, true);
});
