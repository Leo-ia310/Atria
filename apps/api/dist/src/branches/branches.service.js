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
exports.BranchesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const amount = (value) => Number(value ?? 0);
let BranchesService = class BranchesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user) {
        const branches = await this.prisma.branch.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            include: {
                warehouses: true,
                _count: { select: { memberships: true, sales: true } },
            },
            orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        });
        return branches;
    }
    async analytics(user) {
        const branches = await this.prisma.branch.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            include: {
                sales: {
                    where: { status: 'COMPLETED' },
                    select: { grandTotal: true },
                },
                warehouses: {
                    include: {
                        inventory: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
            },
        });
        return branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            ventas: branch.sales.reduce((acc, sale) => acc + amount(sale.grandTotal), 0),
            valorInventario: branch.warehouses
                .flatMap((warehouse) => warehouse.inventory)
                .reduce((acc, row) => acc + amount(row.availableQty) * amount(row.product.costPrice), 0),
            bodegas: branch.warehouses.length,
        }));
    }
    async create(user, dto) {
        return this.prisma.$transaction(async (transaction) => {
            const branch = await transaction.branch.create({
                data: {
                    organizationId: user.organizationId,
                    code: dto.code.toUpperCase(),
                    name: dto.name,
                    addressLine1: dto.addressLine1,
                    city: dto.city,
                    countryCode: dto.countryCode.toUpperCase(),
                },
            });
            const warehouse = await transaction.warehouse.create({
                data: {
                    organizationId: user.organizationId,
                    branchId: branch.id,
                    code: `BOD-${dto.code.toUpperCase()}`,
                    name: dto.warehouseName,
                    isPrimary: true,
                },
            });
            await transaction.subscription.update({
                where: { organizationId: user.organizationId },
                data: { branchesUsed: { increment: 1 } },
            });
            return { branch, warehouse };
        });
    }
    async update(user, id, dto) {
        const existing = await this.prisma.branch.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Sucursal no encontrada.');
        return this.prisma.branch.update({
            where: { id },
            data: {
                name: dto.name ?? undefined,
                addressLine1: dto.addressLine1 ?? undefined,
                city: dto.city ?? undefined,
                countryCode: dto.countryCode?.toUpperCase() ?? undefined,
            },
        });
    }
    async remove(user, id) {
        const existing = await this.prisma.branch.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
            include: { _count: { select: { sales: true, memberships: true } } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Sucursal no encontrada.');
        if (existing.isPrimary) {
            throw new common_1.BadRequestException('No puedes eliminar la sucursal principal.');
        }
        if (existing._count.sales > 0) {
            throw new common_1.BadRequestException(`Esta sucursal tiene ${existing._count.sales} ventas registradas. Anúlalas antes de eliminar.`);
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.branch.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
            await tx.subscription.update({
                where: { organizationId: user.organizationId },
                data: { branchesUsed: { decrement: 1 } },
            });
            return { deleted: true, id };
        });
    }
};
exports.BranchesService = BranchesService;
exports.BranchesService = BranchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BranchesService);
//# sourceMappingURL=branches.service.js.map