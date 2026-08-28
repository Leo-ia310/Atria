export declare class CreateEmployeeDto {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleKey: string;
    branchId: string;
    jobTitle?: string;
}
export declare class UpdateEmployeeDto {
    firstName?: string;
    lastName?: string;
    roleKey?: string;
    branchId?: string;
    jobTitle?: string;
}
