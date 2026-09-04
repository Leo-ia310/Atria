import assert from "node:assert/strict";
import test from "node:test";

import { getPaisConfig, PAISES_ARRAY } from "../../lib/paises";
import { formatearMoneda } from "../../lib/utils";
import { registroEmpresaSchema } from "../../lib/validations/auth";
import {
  cuentaFinancieraSchema,
} from "../../lib/validations/configuracion";

test("expone Estados Unidos y Mexico en el catalogo de paises", () => {
  assert.ok(PAISES_ARRAY.some((pais) => pais.codigo === "US"));
  assert.ok(PAISES_ARRAY.some((pais) => pais.codigo === "MX"));

  assert.deepEqual(
    {
      moneda: getPaisConfig("US").moneda,
      impuestoNombre: getPaisConfig("US").impuestoNombre,
      impuestoCodigo: getPaisConfig("US").impuestoCodigo,
      tasaDefault: getPaisConfig("US").tasaDefault,
      idFiscalNombre: getPaisConfig("US").idFiscalNombre,
      zonaHoraria: getPaisConfig("US").zonaHoraria,
    },
    {
      moneda: "USD",
      impuestoNombre: "Sales Tax",
      impuestoCodigo: "CO_SALES_TAX",
      tasaDefault: 0.029,
      idFiscalNombre: "EIN",
      zonaHoraria: "America/Denver",
    },
  );

  assert.deepEqual(
    {
      moneda: getPaisConfig("MX").moneda,
      impuestoNombre: getPaisConfig("MX").impuestoNombre,
      impuestoCodigo: getPaisConfig("MX").impuestoCodigo,
      tasaDefault: getPaisConfig("MX").tasaDefault,
      idFiscalNombre: getPaisConfig("MX").idFiscalNombre,
      zonaHoraria: getPaisConfig("MX").zonaHoraria,
    },
    {
      moneda: "MXN",
      impuestoNombre: "IVA",
      impuestoCodigo: "IVA16",
      tasaDefault: 0.16,
      idFiscalNombre: "RFC",
      zonaHoraria: "America/Mexico_City",
    },
  );
});

test("formatea moneda para Estados Unidos y Mexico", () => {
  assert.equal(formatearMoneda(1234.5, "US"), "$1234,50");
  assert.equal(formatearMoneda(1234.5, "MX"), "$1234,50");
});

test("registro acepta US/USD y MX/MXN", () => {
  const base = {
    razonSocial: "Atria Demo LLC",
    nombreComercial: "",
    identificacionFiscal: "",
    tipoEmpresa: "general" as const,
  };

  assert.equal(
    registroEmpresaSchema.safeParse({ ...base, pais: "US", moneda: "USD" }).success,
    true,
  );
  assert.equal(
    registroEmpresaSchema.safeParse({ ...base, pais: "MX", moneda: "MXN" }).success,
    true,
  );
});

test("cuentas financieras aceptan MXN", () => {
  const parsed = cuentaFinancieraSchema.safeParse({
    tipo: "banco",
    nombre: "Banco MX",
    banco: "",
    numeroCuenta: "",
    moneda: "MXN",
    saldoInicial: 0,
  });

  assert.equal(parsed.success, true);
});
