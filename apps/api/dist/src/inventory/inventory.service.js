"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const decimal = (value) => new client_1.Prisma.Decimal(value);
const numberValue = (value) => Number(value ?? 0);
let InventoryService = class InventoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async products(user, query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            organizationId: user.organizationId,
            deletedAt: null,
            categoryId: query.categoryId,
            supplierId: query.supplierId,
            OR: query.search
                ? [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { sku: { contains: query.search, mode: 'insensitive' } },
                    { barcode: { contains: query.search, mode: 'insensitive' } },
                ]
                : undefined,
            inventory: query.warehouseId || query.branchId
                ? {
                    some: {
                        warehouseId: query.warehouseId,
                        warehouse: query.branchId
                            ? { branchId: query.branchId }
                            : undefined,
                    },
                }
                : undefined,
        };
        const include = {
            category: true,
            brand: true,
            supplier: true,
            taxRate: true,
            inventory: {
                include: {
                    warehouse: {
                        include: { branch: true },
                    },
                },
            },
        };
        if (query.stockLevel) {
            const candidates = await this.prisma.product.findMany({
                where,
                include,
                orderBy: { name: 'asc' },
                take: 500,
            });
            const filtered = candidates.filter((product) => {
                const disponible = product.inventory.reduce((acc, row) => acc + numberValue(row.availableQty), 0);
                return query.stockLevel === 'OUT'
                    ? disponible <= 0
                    : disponible <= numberValue(product.minStock);
            });
            const skip = (page - 1) * pageSize;
            return {
                data: filtered.slice(skip, skip + pageSize),
                meta: { page, pageSize, total: filtered.length },
            };
        }
        const skip = (page - 1) * pageSize;
        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include,
                skip,
                take: pageSize,
                orderBy: { name: 'asc' },
            }),
            this.prisma.product.count({ where }),
        ]);
        return {
            data: products,
            meta: { page, pageSize, total },
        };
    }
    async filters(user) {
        const [categories, suppliers, warehouses] = await Promise.all([
            this.prisma.category.findMany({
                where: { organizationId: user.organizationId },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.supplier.findMany({
                where: { organizationId: user.organizationId, deletedAt: null },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.warehouse.findMany({
                where: { organizationId: user.organizationId },
                select: { id: true, name: true, branch: { select: { name: true } } },
                orderBy: { name: 'asc' },
            }),
        ]);
        return { categories, suppliers, warehouses };
    }
    async createProduct(user, dto) {
        return this.prisma.$transaction(async (transaction) => {
            const taxRate = await transaction.taxRate.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    isDefault: true,
                },
            });
            const branch = (dto.branchId
                ? await transaction.branch.findFirst({
                    where: {
                        id: dto.branchId,
                        organizationId: user.organizationId,
                    },
                })
                : await transaction.branch.findFirst({
                    where: {
                        id: user.defaultBranchId ?? undefined,
                        organizationId: user.organizationId,
                    },
                })) ??
                (await transaction.branch.findFirst({
                    where: {
                        organizationId: user.organizationId,
                        isPrimary: true,
                    },
                }));
            if (!branch) {
                throw new common_1.NotFoundException('No encontramos una sucursal operativa.');
            }
            const warehouse = await transaction.warehouse.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    branchId: branch.id,
                    isPrimary: true,
                },
            });
            const category = dto.categoryName
                ? await transaction.category.upsert({
                    where: {
                        organizationId_name: {
                            organizationId: user.organizationId,
                            name: dto.categoryName,
                        },
                    },
                    update: {},
                    create: {
                        organizationId: user.organizationId,
                        name: dto.categoryName,
                    },
                })
                : null;
            const brand = dto.brandName
                ? await transaction.brand.upsert({
                    where: {
                        organizationId_name: {
                            organizationId: user.organizationId,
                            name: dto.brandName,
                        },
                    },
                    update: {},
                    create: {
                        organizationId: user.organizationId,
                        name: dto.brandName,
                    },
                })
                : null;
            const supplier = dto.supplierName
                ? await transaction.supplier.create({
                    data: {
                        organizationId: user.organizationId,
                        name: dto.supplierName,
                    },
                })
                : null;
            const product = await transaction.product.create({
                data: {
                    organizationId: user.organizationId,
                    categoryId: category?.id,
                    brandId: brand?.id,
                    supplierId: supplier?.id,
                    taxRateId: taxRate.id,
                    sku: dto.sku.toUpperCase(),
                    barcode: dto.barcode,
                    name: dto.name,
                    unit: dto.unit,
                    salePrice: decimal(dto.salePrice),
                    costPrice: decimal(dto.costPrice),
                    minStock: decimal(dto.minStock),
                    isTrackSerial: dto.isTrackSerial ?? false,
                    isTrackExpiration: dto.isTrackExpiration ?? false,
                },
            });
            await transaction.productInventory.create({
                data: {
                    organizationId: user.organizationId,
                    productId: product.id,
                    warehouseId: warehouse.id,
                    availableQty: decimal(0),
                    averageCost: decimal(dto.costPrice),
                },
            });
            return product;
        });
    }
    async productDetail(user, id) {
        const product = await this.prisma.product.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
            include: {
                category: true,
                brand: true,
                supplier: true,
                taxRate: true,
                inventory: { include: { warehouse: { include: { branch: true } } } },
            },
        });
        if (!product)
            throw new common_1.NotFoundException('Producto no encontrado.');
        return product;
    }
    async updateProduct(user, id, dto) {
        const existing = await this.prisma.product.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Producto no encontrado.');
        return this.prisma.product.update({
            where: { id },
            data: {
                name: dto.name ?? undefined,
                barcode: dto.barcode ?? undefined,
                unit: dto.unit ?? undefined,
                salePrice: dto.salePrice !== undefined ? decimal(dto.salePrice) : undefined,
                costPrice: dto.costPrice !== undefined ? decimal(dto.costPrice) : undefined,
                minStock: dto.minStock !== undefined ? decimal(dto.minStock) : undefined,
                isActive: dto.isActive ?? undefined,
                isTrackSerial: dto.isTrackSerial ?? undefined,
                isTrackExpiration: dto.isTrackExpiration ?? undefined,
            },
        });
    }
    async deleteProduct(user, id) {
        const existing = await this.prisma.product.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Producto no encontrado.');
        await this.prisma.product.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        return { deleted: true, id };
    }
    async alerts(user) {
        const [lowStock, expiring] = await Promise.all([
            this.prisma.productInventory.findMany({
                where: { organizationId: user.organizationId },
                include: {
                    product: true,
                    warehouse: { include: { branch: true } },
                },
            }),
            this.prisma.productBatch.findMany({
                where: {
                    organizationId: user.organizationId,
                    expiresAt: {
                        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                },
                include: {
                    product: true,
                    warehouse: { include: { branch: true } },
                },
            }),
        ]);
        return {
            stockBajo: lowStock
                .filter((row) => numberValue(row.availableQty) <= numberValue(row.product.minStock))
                .map((row) => ({
                producto: row.product.name,
                disponible: numberValue(row.availableQty),
                minimo: numberValue(row.product.minStock),
                sucursal: row.warehouse.branch.name,
            })),
            proximosAVencer: expiring.map((row) => ({
                producto: row.product.name,
                lote: row.lotNumber,
                cantidad: numberValue(row.quantity),
                expira: row.expiresAt,
                sucursal: row.warehouse.branch.name,
            })),
        };
    }
    async movements(user, productId) {
        return this.prisma.stockMovement.findMany({
            where: { organizationId: user.organizationId, productId },
            include: {
                product: true,
                warehouse: { include: { branch: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: productId ? 10 : 50,
        });
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map