import { ARCA_PRICING } from "@/lib/marketing/arcaPricing";
import type {
  ArcaPriceResult,
  ExternalSoftware,
  ExternalSoftwareCost,
  ExternalSoftwareTotals,
  SavingsResult,
} from "@/lib/marketing/pricingTypes";

export function normalizeUserCount(value: unknown, maxUsers = ARCA_PRICING.maxUsers): number {
  const numberValue =
    typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error("La cantidad de usuarios debe ser un numero.");
  }

  if (!Number.isInteger(numberValue)) {
    throw new Error("La cantidad de usuarios debe ser un numero entero.");
  }

  if (numberValue < 1) {
    throw new Error("La cantidad de usuarios debe ser al menos 1.");
  }

  if (numberValue > maxUsers) {
    throw new Error(`La cantidad maxima configurable es ${maxUsers}.`);
  }

  return numberValue;
}

export function clampUserCount(value: unknown, maxUsers = ARCA_PRICING.maxUsers): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), maxUsers);
}

export function calculateArcaPrice(usersInput: unknown): ArcaPriceResult {
  const users = normalizeUserCount(usersInput);
  const { pro, enterprise } = ARCA_PRICING;

  if (users <= pro.includedUsers) {
    return {
      plan: pro.name,
      users,
      includedUsers: pro.includedUsers,
      additionalUsers: 0,
      baseMonthlyPrice: pro.monthlyPrice,
      additionalUsersCost: 0,
      monthlyTotal: pro.monthlyPrice,
      annualTotal: pro.monthlyPrice * 12,
    };
  }

  const additionalUsers = Math.max(users - enterprise.includedUsers, 0);
  const additionalUsersCost = additionalUsers * enterprise.additionalUserPrice;
  const monthlyTotal = enterprise.monthlyPrice + additionalUsersCost;

  return {
    plan: enterprise.name,
    users,
    includedUsers: enterprise.includedUsers,
    additionalUsers,
    baseMonthlyPrice: enterprise.monthlyPrice,
    additionalUsersCost,
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
  };
}

export function calculateSoftwareCost(
  software: ExternalSoftware,
  usersInput: unknown,
): ExternalSoftwareCost {
  const users = normalizeUserCount(usersInput);
  const monthlyUnitPrice = software.annualPrice
    ? software.annualPrice / 12
    : software.monthlyPrice;

  const monthlyCost =
    software.pricingType === "per-user" ? monthlyUnitPrice * users : monthlyUnitPrice;

  const annualUnitPrice = software.annualPrice ?? software.monthlyPrice * 12;
  const annualCost =
    software.pricingType === "per-user" ? annualUnitPrice * users : annualUnitPrice;

  return {
    softwareId: software.id,
    name: software.name,
    category: software.category,
    monthlyCost: roundCurrency(monthlyCost),
    annualCost: roundCurrency(annualCost),
    billingLabel: software.billingLabel,
    verificationStatus: software.verificationStatus,
  };
}

export function calculateExternalSoftwareCost(
  softwareList: ExternalSoftware[],
  selectedSoftwareIds: Iterable<string>,
  usersInput: unknown,
): ExternalSoftwareTotals {
  const users = normalizeUserCount(usersInput);
  const selected = new Set(selectedSoftwareIds);
  const items = softwareList.reduce<ExternalSoftwareCost[]>((acc, software) => {
    if (selected.has(software.id)) acc.push(calculateSoftwareCost(software, users));
    return acc;
  }, []);

  return {
    selectedCount: items.length,
    users,
    monthlyTotal: roundCurrency(items.reduce((sum, item) => sum + item.monthlyCost, 0)),
    annualTotal: roundCurrency(items.reduce((sum, item) => sum + item.annualCost, 0)),
    items,
  };
}

export function calculateSavings(
  softwareList: ExternalSoftware[],
  selectedSoftwareIds: Iterable<string>,
  usersInput: unknown,
): SavingsResult {
  const users = normalizeUserCount(usersInput);
  const external = calculateExternalSoftwareCost(softwareList, selectedSoftwareIds, users);
  const arca = calculateArcaPrice(users);
  const monthlySavings = roundCurrency(external.monthlyTotal - arca.monthlyTotal);
  const annualSavings = roundCurrency(external.annualTotal - arca.annualTotal);
  const savingsPercentage =
    external.annualTotal > 0 ? roundCurrency((annualSavings / external.annualTotal) * 100) : 0;

  return {
    external,
    arca,
    monthlySavings,
    annualSavings,
    savingsPercentage,
    hasSelection: external.selectedCount > 0,
    isPositiveSavings: annualSavings > 0 && external.selectedCount > 0,
    isNeutralSavings: annualSavings === 0 && external.selectedCount > 0,
  };
}

export function getDefaultSelectedSoftwareIds(softwareList: ExternalSoftware[]): string[] {
  return softwareList.reduce<string[]>((ids, software) => {
    if (software.selectedByDefault) ids.push(software.id);
    return ids;
  }, []);
}

export function getAllExternalSoftwareIds(softwareList: ExternalSoftware[]): string[] {
  return softwareList.map((software) => software.id);
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
