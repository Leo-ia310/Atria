import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateArcaPrice,
  calculateExternalSoftwareCost,
  calculateSavings,
  getAllExternalSoftwareIds,
  getDefaultSelectedSoftwareIds,
} from "@/lib/marketing/pricingCalculations";
import type { ExternalSoftware } from "@/lib/marketing/pricingTypes";

const SOFTWARE_FIXTURES: ExternalSoftware[] = [
  {
    id: "crm-user",
    name: "CRM por usuario",
    category: "CRM",
    description: "Gestion de clientes",
    pricingType: "per-user",
    monthlyPrice: 15,
    currency: "USD",
    billingCadence: "monthly",
    billingLabel: "por usuario/mes",
    priceNote: "Fixture de prueba",
    selectedByDefault: true,
    verificationStatus: "pending",
  },
  {
    id: "accounting-flat",
    name: "Contabilidad fija",
    category: "Contabilidad",
    description: "Libros y reportes",
    pricingType: "flat",
    monthlyPrice: 40,
    currency: "USD",
    billingCadence: "monthly",
    billingLabel: "precio fijo mensual",
    priceNote: "Fixture de prueba",
    selectedByDefault: true,
    verificationStatus: "pending",
  },
  {
    id: "inventory-annual",
    name: "Inventario anual",
    category: "Inventario",
    description: "Stock independiente",
    pricingType: "flat",
    monthlyPrice: 30,
    annualPrice: 300,
    currency: "USD",
    billingCadence: "annual",
    billingLabel: "precio anual",
    priceNote: "Fixture de prueba",
    verificationStatus: "pending",
  },
];

describe("calculateArcaPrice", () => {
  it("calcula Plan Pro de 1 a 7 usuarios", () => {
    assert.deepEqual(
      pickArca(calculateArcaPrice(1)),
      { plan: "Pro", users: 1, includedUsers: 7, additionalUsers: 0, monthlyTotal: 39 },
    );
    assert.deepEqual(
      pickArca(calculateArcaPrice(7)),
      { plan: "Pro", users: 7, includedUsers: 7, additionalUsers: 0, monthlyTotal: 39 },
    );
  });

  it("calcula Enterprise base de 8 a 10 usuarios", () => {
    assert.deepEqual(
      pickArca(calculateArcaPrice(8)),
      { plan: "Enterprise", users: 8, includedUsers: 10, additionalUsers: 0, monthlyTotal: 149 },
    );
    assert.deepEqual(
      pickArca(calculateArcaPrice(10)),
      { plan: "Enterprise", users: 10, includedUsers: 10, additionalUsers: 0, monthlyTotal: 149 },
    );
  });

  it("calcula usuarios adicionales despues de 10", () => {
    assert.equal(calculateArcaPrice(11).monthlyTotal, 154);
    assert.equal(calculateArcaPrice(20).monthlyTotal, 199);
    assert.equal(calculateArcaPrice(20).additionalUsersCost, 50);
    assert.equal(calculateArcaPrice(20).annualTotal, 2388);
  });

  it("rechaza valores invalidos", () => {
    assert.throws(() => calculateArcaPrice(0), /al menos 1/);
    assert.throws(() => calculateArcaPrice(-2), /al menos 1/);
    assert.throws(() => calculateArcaPrice(1.5), /entero/);
    assert.throws(() => calculateArcaPrice(""), /numero/);
  });
});

describe("calculateExternalSoftwareCost", () => {
  it("devuelve cero sin seleccion", () => {
    const result = calculateExternalSoftwareCost(SOFTWARE_FIXTURES, [], 4);
    assert.equal(result.selectedCount, 0);
    assert.equal(result.monthlyTotal, 0);
    assert.equal(result.annualTotal, 0);
  });

  it("calcula una herramienta por usuario", () => {
    const result = calculateExternalSoftwareCost(SOFTWARE_FIXTURES, ["crm-user"], 3);
    assert.equal(result.monthlyTotal, 45);
    assert.equal(result.annualTotal, 540);
  });

  it("calcula varias herramientas y precio fijo", () => {
    const result = calculateExternalSoftwareCost(
      SOFTWARE_FIXTURES,
      ["crm-user", "accounting-flat"],
      2,
    );
    assert.equal(result.monthlyTotal, 70);
    assert.equal(result.annualTotal, 840);
  });

  it("usa precio anual oficial cuando existe", () => {
    const result = calculateExternalSoftwareCost(SOFTWARE_FIXTURES, ["inventory-annual"], 5);
    assert.equal(result.monthlyTotal, 25);
    assert.equal(result.annualTotal, 300);
  });

  it("cambia costos por usuario al cambiar usuarios", () => {
    const twoUsers = calculateExternalSoftwareCost(SOFTWARE_FIXTURES, ["crm-user"], 2);
    const fiveUsers = calculateExternalSoftwareCost(SOFTWARE_FIXTURES, ["crm-user"], 5);
    assert.equal(twoUsers.monthlyTotal, 30);
    assert.equal(fiveUsers.monthlyTotal, 75);
  });

  it("obtiene seleccion por defecto, seleccionar todas y limpiar", () => {
    assert.deepEqual(getDefaultSelectedSoftwareIds(SOFTWARE_FIXTURES), [
      "crm-user",
      "accounting-flat",
    ]);
    assert.deepEqual(getAllExternalSoftwareIds(SOFTWARE_FIXTURES), [
      "crm-user",
      "accounting-flat",
      "inventory-annual",
    ]);
    assert.equal(calculateExternalSoftwareCost(SOFTWARE_FIXTURES, [], 3).selectedCount, 0);
  });
});

describe("calculateSavings", () => {
  it("calcula ahorro positivo", () => {
    const result = calculateSavings(SOFTWARE_FIXTURES, ["crm-user", "accounting-flat"], 7);
    assert.equal(result.arca.plan, "Pro");
    assert.equal(result.external.monthlyTotal, 145);
    assert.equal(result.monthlySavings, 106);
    assert.equal(result.annualSavings, 1272);
    assert.equal(result.isPositiveSavings, true);
  });

  it("maneja ahorro cero", () => {
    const result = calculateSavings(
      [{ ...SOFTWARE_FIXTURES[1], monthlyPrice: 39 }],
      ["accounting-flat"],
      1,
    );
    assert.equal(result.monthlySavings, 0);
    assert.equal(result.annualSavings, 0);
    assert.equal(result.isNeutralSavings, true);
  });

  it("maneja ARCA mas caro", () => {
    const result = calculateSavings(SOFTWARE_FIXTURES, ["accounting-flat"], 9);
    assert.equal(result.arca.plan, "Enterprise");
    assert.equal(result.monthlySavings, -109);
    assert.equal(result.annualSavings, -1308);
    assert.equal(result.isPositiveSavings, false);
  });

  it("no muestra ahorro sin aplicaciones", () => {
    const result = calculateSavings(SOFTWARE_FIXTURES, [], 5);
    assert.equal(result.hasSelection, false);
    assert.equal(result.savingsPercentage, 0);
  });

  it("refleja cambio de plan y usuarios adicionales", () => {
    const enterprise = calculateSavings(SOFTWARE_FIXTURES, ["crm-user"], 8);
    const additional = calculateSavings(SOFTWARE_FIXTURES, ["crm-user"], 12);
    assert.equal(enterprise.arca.plan, "Enterprise");
    assert.equal(enterprise.arca.additionalUsers, 0);
    assert.equal(additional.arca.additionalUsers, 2);
    assert.equal(additional.arca.monthlyTotal, 159);
  });
});

function pickArca(result: ReturnType<typeof calculateArcaPrice>) {
  return {
    plan: result.plan,
    users: result.users,
    includedUsers: result.includedUsers,
    additionalUsers: result.additionalUsers,
    monthlyTotal: result.monthlyTotal,
  };
}
