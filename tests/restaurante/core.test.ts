import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularCostoPorPorcion,
  calcularFoodCostPct,
  convertirCantidadBase,
  hashToken,
  normalizarCodigoUnidad,
  normalizarEmail,
  normalizarTelefono,
  sumarDias,
  ultimos4Token,
} from "../../lib/restaurante/core";

test("normaliza y convierte unidades base de cocina", () => {
  assert.equal(normalizarCodigoUnidad("kg"), "kg");
  assert.equal(normalizarCodigoUnidad("LT"), "l");
  assert.equal(convertirCantidadBase({ cantidad: 1.5, unidadOrigen: "KG" }), 1500);
  assert.equal(convertirCantidadBase({ cantidad: 0.75, unidadOrigen: "LT" }), 750);
  assert.equal(
    convertirCantidadBase({ cantidad: 2, unidadOrigen: "CJA", factorProducto: 12 }),
    24,
  );
  assert.throws(
    () => convertirCantidadBase({ cantidad: 1, unidadOrigen: "CJA" }),
    /requiere factor/,
  );
});

test("calcula food cost con redondeo estable", () => {
  assert.equal(calcularCostoPorPorcion(37.5, 15), 2.5);
  assert.equal(calcularFoodCostPct(2.5, 10), 25);
  assert.equal(calcularFoodCostPct(2.3333, 7), 33.33);
  assert.equal(calcularFoodCostPct(10, 0), 0);
});

test("hash de token no expone el token original", () => {
  process.env.ARCA_TOKEN_PEPPER = "test-pepper";
  const token = "arca_guest_plain_token_1234";
  const hash = hashToken(token);

  assert.equal(hash.length, 64);
  assert.notEqual(hash, token);
  assert.equal(hashToken(token), hash);
  assert.equal(ultimos4Token(token), "1234");
});

test("normaliza datos voluntarios de comensal", () => {
  assert.equal(normalizarEmail("  HOLA@EXAMPLE.COM "), "hola@example.com");
  assert.equal(normalizarEmail(" "), null);
  assert.equal(normalizarTelefono(" +505 8888-7777 "), "+50588887777");
  assert.equal(normalizarTelefono(" "), null);

  const fecha = new Date("2026-08-25T12:00:00.000Z");
  assert.equal(sumarDias(fecha, 7).toISOString(), "2026-09-01T12:00:00.000Z");
});
