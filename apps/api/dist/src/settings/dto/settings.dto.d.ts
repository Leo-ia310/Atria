export declare class UpdateSettingsDto {
    displayName?: string;
    legalName?: string;
    invoicePrefix?: string;
    quotePrefix?: string;
    themePrimary?: string;
    themeSecondary?: string;
    posAllowDiscounts?: boolean;
    posRequireCustomer?: boolean;
    notifications?: Record<string, unknown>;
    security?: Record<string, unknown>;
    invoiceTemplate?: Record<string, unknown>;
}
