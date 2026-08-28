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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const money = (value) => new client_1.Prisma.Decimal(value);
const num = (value) => Number(value ?? 0);
let SalesService = class SalesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async sales(user, query) {
        return this.prisma.sale.findMany({
            where: {
                organizationId: user.organizationId,
                status: query.status,
            },
            include: {
                customer: true,
                branch: true,
                items: { include: { product: true } },
                payments: true,
            },
            orderBy: { soldAt: 'desc' },
            take: query.pageSize ?? 30,
        });
    }
    async findOne(user, id) {
        const sale = await this.prisma.sale.findFirst({
            where: { id, organizationId: user.organizationId },
            include: {
                customer: true,
                branch: true,
                warehouse: true,
                items: { include: { product: true } },
                payments: true,
                receivable: true,
            },
        });
        if (!sale) {
            throw new common_1.NotFoundException('No encontramos esa venta.');
        }
        const createdByMembership = sale.createdByMembershipId
            ? await this.prisma.membership.findUnique({
                where: { id: sale.createdByMembershipId },
                include: { user: true },
            })
            : null;
        const journal = await this.prisma.journalEntry.findFirst({
            where: {
                organizationId: user.organizationId,
                sourceType: 'sale',
                sourceId: sale.id,
            },
            include: { lines: { include: { account: true } } },
        });
        return { sale: { ...sale, createdByMembership }, journal };
    }
    async analytics(user) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [sales, customers] = await Promise.all([
            this.prisma.sale.findMany({
                where: {
                    organizationId: user.organizationId,
                    status: 'COMPLETED',
                    soldAt: { gte: thirtyDaysAgo },
                },
                include: { customer: true },
            }),
            this.prisma.customer.findMany({
                where: { organizationId: user.organizationId, deletedAt: null },
                include: { sales: true },
            }),
        ]);
        const revenue = sales.reduce((acc, sale) => acc + num(sale.grandTotal), 0);
        const averageTicket = sales.length ? revenue / sales.length : 0;
        const topCustomers = customers
            .map((customer) => ({
            id: customer.id,
            nombre: customer.fullName,
            total: customer.sales.reduce((acc, sale) => acc + num(sale.grandTotal), 0),
        }))
            .sort((left, right) => right.total - left.total)
            .slice(0, 5);
        return {
            revenue,
            averageTicket,
            topCustomers,
            totalSales: sales.length,
        };
    }
    async customers(user) {
        return this.prisma.customer.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            orderBy: { fullName: 'asc' },
        });
    }
    async createCustomer(user, dto) {
        const count = await this.prisma.customer.count({
            where: { organizationId: user.organizationId },
        });
        return this.prisma.customer.create({
            data: {
                organizationId: user.organizationId,
                code: `CLI-${String(count + 1).padStart(5, '0')}`,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                documentId: dto.documentId,
            },
        });
    }
    async updateCustomer(user, id, dto) {
        const existing = await this.prisma.customer.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Cliente no encontrado.');
        return this.prisma.customer.update({
            where: { id },
            data: {
                fullName: dto.fullName ?? undefined,
                email: dto.email ?? undefined,
                phone: dto.phone ?? undefined,
                documentId: dto.documentId ?? undefined,
            },
        });
    }
    async deleteCustomer(user, id) {
        const existing = await this.prisma.customer.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Cliente no encontrado.');
        await this.prisma.customer.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return { deleted: true, id };
    }
    async quotations(user) {
        return this.prisma.quotation.findMany({
            where: { organizationId: user.organizationId },
            include: {
                customer: true,
                branch: true,
                items: { include: { product: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createQuotation(user, dto) {
        const branch = await this.prisma.branch.findFirstOrThrow({
            where: {
                organizationId: user.organizationId,
                id: user.defaultBranchId ?? undefined,
            },
        });
        const products = await this.prisma.product.findMany({
            where: {
                organizationId: user.organizationId,
                id: { in: dto.items.map((item) => item.productId) },
            },
            include: { taxRate: true },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const items = dto.items.map((item) => {
            const product = productMap.get(item.productId);
            const taxRate = num(product?.taxRate?.rate);
            const base = item.quantity * item.unitPrice;
            const tax = base * (taxRate / 100);
            return {
                ...item,
                tax,
                total: base + tax,
            };
        });
        const count = await this.prisma.quotation.count({
            where: { organizationId: user.organizationId },
        });
        return this.prisma.quotation.create({
            data: {
                organizationId: user.organizationId,
                branchId: branch.id,
                customerId: dto.customerId,
                number: `COT-${String(count + 1).padStart(6, '0')}`,
                subtotal: money(items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)),
                taxTotal: money(items.reduce((acc, item) => acc + item.tax, 0)),
                discountTotal: money(0),
                grandTotal: money(items.reduce((acc, item) => acc + item.total, 0)),
                validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
                createdByMembershipId: user.membershipId,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: money(item.quantity),
                        unitPrice: money(item.unitPrice),
                        taxAmount: money(item.tax),
                        discountAmount: money(0),
                        lineTotal: money(item.total),
                    })),
                },
            },
        });
    }
    async deleteQuotation(user, id) {
        const quotation = await this.prisma.quotation.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!quotation)
            throw new common_1.NotFoundException('Cotización no encontrada.');
        await this.prisma.quotation.delete({ where: { id } });
        return { deleted: true, id };
    }
    async voidSale(user, id, dto) {
        const sale = await this.prisma.sale.findFirst({
            where: { id, organizationId: user.organizationId },
            include: { items: true },
        });
        if (!sale)
            throw new common_1.NotFoundException('Venta no encontrada.');
        if (sale.status === 'VOID') {
            throw new common_1.NotFoundException('La venta ya está anulada.');
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.sale.update({
                where: { id },
                data: {
                    status: 'VOID',
                    note: dto.reason
                        ? `${sale.note ?? ''} [Anulada: ${dto.reason}]`.trim()
                        : sale.note,
                },
            });
            for (const item of sale.items) {
                await tx.productInventory.updateMany({
                    where: { productId: item.productId, warehouseId: sale.warehouseId },
                    data: { availableQty: { increment: item.quantity } },
                });
                await tx.stockMovement.create({
                    data: {
                        organizationId: user.organizationId,
                        productId: item.productId,
                        warehouseId: sale.warehouseId,
                        branchId: sale.branchId,
                        actorMembershipId: user.membershipId,
                        type: 'RETURN_IN',
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        referenceType: 'sale_void',
                        referenceId: sale.id,
                        note: `Anulación venta ${sale.number}`,
                    },
                });
            }
            const originalEntry = await tx.journalEntry.findFirst({
                where: {
                    organizationId: user.organizationId,
                    sourceType: 'sale',
                    sourceId: sale.id,
                },
                include: { lines: true },
            });
            if (originalEntry) {
                const count = await tx.journalEntry.count({
                    where: { organizationId: user.organizationId },
                });
                await tx.journalEntry.create({
                    data: {
                        organizationId: user.organizationId,
                        branchId: originalEntry.branchId,
                        number: `AS-${String(count + 1).padStart(6, '0')}`,
                        memo: `Anulación venta ${sale.number}${dto.reason ? ' — ' + dto.reason : ''}`,
                        sourceType: 'sale_void',
                        sourceId: sale.id,
                        entryDate: new Date(),
                        status: 'POSTED',
                        createdByMembershipId: user.membershipId,
                        lines: {
                            create: originalEntry.lines.map((l) => ({
                                accountId: l.accountId,
                                description: `Reverso: ${l.description ?? ''}`,
                                debit: l.credit,
                                credit: l.debit,
                            })),
                        },
                    },
                });
                await tx.journalEntry.update({
                    where: { id: originalEntry.id },
                    data: { status: 'REVERSED' },
                });
            }
            return { voided: true, sale: updated, reason: dto.reason };
        });
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesService);
//# sourceMappingURL=sales.service.js.map