import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
export declare class BranchesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(user: JwtUser): Promise<({
        warehouses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            code: string;
            isPrimary: boolean;
            branchId: string;
        }[];
        _count: {
            memberships: number;
            sales: number;
        };
    } & {
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
    })[]>;
    analytics(user: JwtUser): Promise<{
        id: string;
        name: string;
        ventas: number;
        valorInventario: number;
        bodegas: number;
    }[]>;
    create(user: JwtUser, dto: CreateBranchDto): Promise<{
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
        };
        warehouse: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            code: string;
            isPrimary: boolean;
            branchId: string;
        };
    }>;
    update(user: JwtUser, id: string, dto: UpdateBranchDto): Promise<{
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
    }>;
    remove(user: JwtUser, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
}
