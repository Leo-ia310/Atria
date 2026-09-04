import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCTOS_FISCALES_BASE,
  jurisdiccionFiscalDefault,
  reglasImpuestoDefault,
} from "../../lib/compliance-core";

test("define codigos fiscales base para SaaS y restaurante", () => {
  const codigos = new Set(PRODUCTOS_FISCALES_BASE.map((producto) => producto.codigo));

  assert.ok(codigos.has("ARCA_SAAS_STANDARD"));
  assert.ok(codigos.has("ARCA_IMPLEMENTATION"));
  assert.ok(codigos.has("RESTAURANTE_PREPARED_FOOD"));
  assert.ok(codigos.has("RESTAURANTE_TIP_VOLUNTARY"));
  assert.ok(codigos.has("RESTAURANTE_SERVICE_CHARGE"));
});

test("USA nace como piloto Colorado con banderas de jurisdiccion", () => {
  const jurisdiccion = jurisdiccionFiscalDefault("US");
  const reglas = reglasImpuestoDefault("US");
  const saas = reglas.find((regla) => regla.productoFiscalCodigo === "ARCA_SAAS_STANDARD");

  assert.equal(jurisdiccion.codigo, "US-CO");
  assert.equal(jurisdiccion.metadata.requiereDireccionExacta, true);
  assert.equal(jurisdiccion.metadata.requiereNexus, true);
  assert.equal(saas?.tasa, 0.029);
  assert.equal(saas?.condicion.noUsarComoTasaNacional, true);
});

test("Mexico nace con jurisdiccion federal e IVA SaaS 16", () => {
  const jurisdiccion = jurisdiccionFiscalDefault("MX");
  const reglas = reglasImpuestoDefault("MX");
  const saas = reglas.find((regla) => regla.productoFiscalCodigo === "ARCA_SAAS_STANDARD");

  assert.equal(jurisdiccion.codigo, "MX-FED");
  assert.equal(jurisdiccion.metadata.requiereCfdi, true);
  assert.equal(jurisdiccion.metadata.requiereRfc, true);
  assert.equal(saas?.tasa, 0.16);
});
