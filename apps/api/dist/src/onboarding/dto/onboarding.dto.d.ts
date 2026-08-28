declare class TaxDto {
    code: string;
    name: string;
    rate: number;
    scope: 'SALE' | 'PURCHASE' | 'BOTH';
}
declare class InitialUserDto {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleKey: string;
    jobTitle?: string;
}
declare class InitialProductDto {
    name: string;
    sku: string;
    salePrice: number;
    costPrice: number;
    minStock: number;
    categoryName?: string;
}
export declare class CompleteOnboardingDto {
    businessType: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    primaryBranchName: string;
    taxes: TaxDto[];
    initialUsers: InitialUserDto[];
    initialProducts: InitialProductDto[];
}
export {};
