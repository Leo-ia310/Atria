import type { JwtUser } from "../auth/auth.types";
import { CreatePurchaseDto, CreateSupplierDto, PurchasesQueryDto, UpdateSupplierDto } from './dto/purchases.dto';
import { PurchasesService } from './purchases.service';
export declare class PurchasesController {
    private readonly purchasesService;
    constructor(purchasesService: PurchasesService);
    list(user: JwtUser, query: PurchasesQueryDto): Promise<{
        data: {
            referenceId: string;
            createdAt: Date;
            supplierName: string | null;
            branchName: string;
            itemCount: number;
            total: number;
            note: string | null;
        }[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
        };
    }>;
    create(user: JwtUser, dto: CreatePurchaseDto): Promise<{
        referenceId: `${string}-${string}-${string}-${string}-${string}`;
        subtotal: number;
        taxTotal: number;
        grandTotal: number;
    }>;
    suppliers(user: JwtUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        organizationId: string;
        phone: string | null;
        email: string | null;
        taxIdentifier: string | null;
        contactName: string | null;
    }[]>;
    createSupplier(user: JwtUser, dto: CreateSupplierDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        organizationId: string;
        phone: string | null;
        email: string | null;
        taxIdentifier: string | null;
        contactName: string | null;
    }>;
    updateSupplier(user: JwtUser, id: string, dto: UpdateSupplierDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        organizationId: string;
        phone: string | null;
        email: string | null;
        taxIdentifier: string | null;
        contactName: string | null;
    }>;
    deleteSupplier(user: JwtUser, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
    findOne(user: JwtUser, referenceId: string): Promise<{
        movements: ({
            warehouse: {
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
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                organizationId: string;
                code: string;
                isPrimary: boolean;
                branchId: string;
            };
            product: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                organizationId: string;
                isActive: boolean;
                description: string | null;
                categoryId: string | null;
                brandId: string | null;
                supplierId: string | null;
                taxRateId: string | null;
                sku: string;
                barcode: string | null;
                unit: string;
                salePrice: import("@prisma/client/runtime/library").Decimal;
                costPrice: import("@prisma/client/runtime/library").Decimal;
                minStock: import("@prisma/client/runtime/library").Decimal;
                isTrackSerial: boolean;
                isTrackExpiration: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            organizationId: string;
            branchId: string | null;
            type: import("@prisma/client").$Enums.InventoryMovementType;
            warehouseId: string;
            productId: string;
            quantity: import("@prisma/client/runtime/library").Decimal;
            note: string | null;
            unitCost: import("@prisma/client/runtime/library").Decimal;
            actorMembershipId: string | null;
            referenceType: string;
            referenceId: string;
        })[];
        journal: ({
            lines: ({
                account: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    organizationId: string;
                    code: string;
                    parentId: string | null;
                    type: import("@prisma/client").$Enums.AccountType;
                    allowsPosting: boolean;
                    level: number;
                };
            } & {
                id: string;
                description: string | null;
                accountId: string;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                journalEntryId: string;
            })[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            branchId: string | null;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdByMembershipId: string | null;
            sourceType: string;
            memo: string;
            entryDate: Date;
            sourceId: string | null;
        }) | null;
    }>;
}
