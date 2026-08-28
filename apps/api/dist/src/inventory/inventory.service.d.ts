import { Prisma } from '@prisma/client';
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CreateProductDto, InventoryQueryDto, UpdateProductDto } from './dto/inventory.dto';
export declare class InventoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    products(user: JwtUser, query: InventoryQueryDto): Promise<{
        data: ({
            inventory: ({
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
            } & {
                id: string;
                updatedAt: Date;
                organizationId: string;
                warehouseId: string;
                productId: string;
                averageCost: Prisma.Decimal;
                availableQty: Prisma.Decimal;
                reservedQty: Prisma.Decimal;
            })[];
            taxRate: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                organizationId: string;
                code: string;
                rate: Prisma.Decimal;
                scope: import("@prisma/client").$Enums.TaxScope;
                isDefault: boolean;
            } | null;
            category: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                organizationId: string;
                description: string | null;
            } | null;
            brand: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                organizationId: string;
            } | null;
            supplier: {
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
            } | null;
        } & {
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
            salePrice: Prisma.Decimal;
            costPrice: Prisma.Decimal;
            minStock: Prisma.Decimal;
            isTrackSerial: boolean;
            isTrackExpiration: boolean;
        })[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
        };
    }>;
    filters(user: JwtUser): Promise<{
        categories: {
            id: string;
            name: string;
        }[];
        suppliers: {
            id: string;
            name: string;
        }[];
        warehouses: {
            id: string;
            name: string;
            branch: {
                name: string;
            };
        }[];
    }>;
    createProduct(user: JwtUser, dto: CreateProductDto): Promise<{
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
        salePrice: Prisma.Decimal;
        costPrice: Prisma.Decimal;
        minStock: Prisma.Decimal;
        isTrackSerial: boolean;
        isTrackExpiration: boolean;
    }>;
    productDetail(user: JwtUser, id: string): Promise<{
        inventory: ({
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
        } & {
            id: string;
            updatedAt: Date;
            organizationId: string;
            warehouseId: string;
            productId: string;
            averageCost: Prisma.Decimal;
            availableQty: Prisma.Decimal;
            reservedQty: Prisma.Decimal;
        })[];
        taxRate: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            code: string;
            rate: Prisma.Decimal;
            scope: import("@prisma/client").$Enums.TaxScope;
            isDefault: boolean;
        } | null;
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            description: string | null;
        } | null;
        brand: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
        } | null;
        supplier: {
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
        } | null;
    } & {
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
        salePrice: Prisma.Decimal;
        costPrice: Prisma.Decimal;
        minStock: Prisma.Decimal;
        isTrackSerial: boolean;
        isTrackExpiration: boolean;
    }>;
    updateProduct(user: JwtUser, id: string, dto: UpdateProductDto): Promise<{
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
        salePrice: Prisma.Decimal;
        costPrice: Prisma.Decimal;
        minStock: Prisma.Decimal;
        isTrackSerial: boolean;
        isTrackExpiration: boolean;
    }>;
    deleteProduct(user: JwtUser, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
    alerts(user: JwtUser): Promise<{
        stockBajo: {
            producto: string;
            disponible: number;
            minimo: number;
            sucursal: string;
        }[];
        proximosAVencer: {
            producto: string;
            lote: string;
            cantidad: number;
            expira: Date | null;
            sucursal: string;
        }[];
    }>;
    movements(user: JwtUser, productId?: string): Promise<({
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
            salePrice: Prisma.Decimal;
            costPrice: Prisma.Decimal;
            minStock: Prisma.Decimal;
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
        quantity: Prisma.Decimal;
        note: string | null;
        unitCost: Prisma.Decimal;
        actorMembershipId: string | null;
        referenceType: string;
        referenceId: string;
    })[]>;
}
