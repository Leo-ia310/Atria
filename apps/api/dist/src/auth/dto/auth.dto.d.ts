declare class RegisterBranchDto {
    name: string;
}
export declare class RegisterDto {
    companyName: string;
    legalName: string;
    businessType: 'HARDWARE' | 'PHARMACY' | 'RETAIL' | 'DISTRIBUTOR' | 'MEDICAL_SUPPLY' | 'OTHER';
    tenantSlug?: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    primaryBranch: RegisterBranchDto;
}
export declare class LoginDto {
    email: string;
    password: string;
    tenantSlug?: string;
}
export declare class ForgotPasswordDto {
    email: string;
    tenantSlug: string;
}
export declare class ResetPasswordDto {
    token: string;
    password: string;
    tenantSlug: string;
}
export declare class VerifyEmailDto {
    token: string;
    tenantSlug: string;
}
export declare class RevokeSessionDto {
    sessionId: string;
}
export declare class IssueCsrfDto {
    scopes?: string[];
}
export {};
