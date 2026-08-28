import type { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
export declare class EmployeesService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    list(user: JwtUser): Promise<({
        branch: {
            id: string;
            countryCode: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            organizationId: string;
            code: string;
            phone: string | null;
            email: string | null;
            addressLine1: string;
            city: string;
            isPrimary: boolean;
        } | null;
        membership: {
            role: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                organizationId: string;
                key: string;
                isSystem: boolean;
                permissions: string[];
            };
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                email: string;
                firstName: string;
                lastName: string;
                passwordHash: string;
                emailVerifiedAt: Date | null;
                isActive: boolean;
                lastLoginAt: Date | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            organizationId: string;
            userId: string;
            roleId: string;
            status: import("@prisma/client").$Enums.MembershipStatus;
            title: string | null;
            defaultBranchId: string | null;
            permissionsOverride: string[];
        };
    } & {
        id: string;
        organizationId: string;
        branchId: string | null;
        membershipId: string;
        employeeCode: string;
        jobTitle: string;
        commissionRate: import("@prisma/client/runtime/library").Decimal;
        hireDate: Date;
    })[]>;
    create(user: JwtUser, dto: CreateEmployeeDto): Promise<{
        id: string;
        organizationId: string;
        branchId: string | null;
        membershipId: string;
        employeeCode: string;
        jobTitle: string;
        commissionRate: import("@prisma/client/runtime/library").Decimal;
        hireDate: Date;
    }>;
    attendance(user: JwtUser): Promise<({
        branch: {
            id: string;
            countryCode: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            organizationId: string;
            code: string;
            phone: string | null;
            email: string | null;
            addressLine1: string;
            city: string;
            isPrimary: boolean;
        } | null;
        employeeProfile: {
            membership: {
                user: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    deletedAt: Date | null;
                    email: string;
                    firstName: string;
                    lastName: string;
                    passwordHash: string;
                    emailVerifiedAt: Date | null;
                    isActive: boolean;
                    lastLoginAt: Date | null;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                organizationId: string;
                userId: string;
                roleId: string;
                status: import("@prisma/client").$Enums.MembershipStatus;
                title: string | null;
                defaultBranchId: string | null;
                permissionsOverride: string[];
            };
        } & {
            id: string;
            organizationId: string;
            branchId: string | null;
            membershipId: string;
            employeeCode: string;
            jobTitle: string;
            commissionRate: import("@prisma/client/runtime/library").Decimal;
            hireDate: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        organizationId: string;
        branchId: string | null;
        status: import("@prisma/client").$Enums.AttendanceStatus;
        employeeProfileId: string;
        checkInAt: Date;
        checkOutAt: Date | null;
    })[]>;
    activity(user: JwtUser): Promise<({
        actor: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            email: string;
            firstName: string;
            lastName: string;
            passwordHash: string;
            emailVerifiedAt: Date | null;
            isActive: boolean;
            lastLoginAt: Date | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        organizationId: string | null;
        module: string;
        action: string;
        entityType: string;
        entityId: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        actorId: string | null;
    })[]>;
    update(user: JwtUser, id: string, dto: UpdateEmployeeDto): Promise<{
        id: string;
        organizationId: string;
        branchId: string | null;
        membershipId: string;
        employeeCode: string;
        jobTitle: string;
        commissionRate: import("@prisma/client/runtime/library").Decimal;
        hireDate: Date;
    }>;
    remove(user: JwtUser, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
}
