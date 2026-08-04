export type CurrencyCode = "USD";

export type ExternalPricingType = "per-user" | "flat";

export type ExternalBillingCadence = "monthly" | "annual";

export type VerificationStatus = "verified" | "pending";

export type ExternalSoftware = {
  id: string;
  name: string;
  category: string;
  description: string;
  pricingType: ExternalPricingType;
  monthlyPrice: number;
  annualPrice?: number;
  currency: CurrencyCode;
  billingCadence: ExternalBillingCadence;
  billingLabel: string;
  priceNote: string;
  officialUrl?: string;
  lastVerifiedAt?: string;
  selectedByDefault?: boolean;
  verificationStatus: VerificationStatus;
};

export type ExternalSoftwareCost = {
  softwareId: string;
  name: string;
  category: string;
  monthlyCost: number;
  annualCost: number;
  billingLabel: string;
  verificationStatus: VerificationStatus;
};

export type ExternalSoftwareTotals = {
  selectedCount: number;
  users: number;
  monthlyTotal: number;
  annualTotal: number;
  items: ExternalSoftwareCost[];
};

export type ArcaPlanName = "Pro" | "Enterprise";

export type ArcaPriceResult = {
  plan: ArcaPlanName;
  users: number;
  includedUsers: number;
  additionalUsers: number;
  baseMonthlyPrice: number;
  additionalUsersCost: number;
  monthlyTotal: number;
  annualTotal: number;
};

export type SavingsResult = {
  external: ExternalSoftwareTotals;
  arca: ArcaPriceResult;
  monthlySavings: number;
  annualSavings: number;
  savingsPercentage: number;
  hasSelection: boolean;
  isPositiveSavings: boolean;
  isNeutralSavings: boolean;
};
