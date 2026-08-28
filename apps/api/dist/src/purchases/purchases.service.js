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
exports.PurchasesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const contracts_1 = require("@atria/contracts");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const decimal = (value) => new client_1.Prisma.Decimal(value);
const toNumber = (value) => Number(value ?? 0);
let PurchasesService = class PurchasesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user, query) {
        const pageSize = Math.min(query.pageSize ?? 25, 100);
        const movements = await this.prisma.stockMovement.findMany({
            where: {
                organizationId: user.organizationId,
                type: 'PURCHASE',
            },
            include: {
                product: true,
                warehouse: { include: { branch: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: pageSize * 4,
        });
        const compras = new Map();
        for (const m of movements) {
            const refId = m.referenceId;
            const existing = compras.get(refId) ?? {
                referenceId: refId,
                createdAt: m.createdAt,
                supplierName: null,
                branchName: m.warehouse.branch.name,
                itemCount: 0,
                total: 0,
                note: m.note,
            };
            existing.itemCount += 1;
            existing.total += toNumber(m.quantity) * toNumber(m.unitCost);
            compras.set(refId, existing);
        }
        const arr = Array.from(compras.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const total = arr.length;
        const page = query.page ?? 1;
        const start = (page - 1) * pageSize;
        const data = arr.slice(start, start + pageSize);
        return { data, meta: { page, pageSize, total } };
    }
    async findOne(user, referenceId) {
        const movements = await this.prisma.stockMovement.findMany({
            where: {
                organizationId: user.organizationId,
                type: 'PURCHASE',
                referenceId,
            },
            include: {
                product: true,
                warehouse: { include: { branch: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (movements.length === 0) {
            throw new common_1.NotFoundException('No encontramos esa compra.');
        }
        const journal = await this.prisma.journalEntry.findFirst({
            where: {
                organizationId: user.organizationId,
                sourceType: 'purchase',
                sourceId: referenceId,
            },
            include: { lines: { include: { account: true } } },
        });
        return { movements, journal };
    }
    async create(user, dto) {
        if (dto.items.length === 0) {
            throw new common_1.BadRequestException('La compra debe tener al menos un producto.');
        }
        if (dto.paymentTerms === 'CREDIT' && !dto.dueDate) {
            throw new common_1.BadRequestException('Compras al crédito requieren fecha de vencimiento.');
        }
        return this.prisma.$transaction(async (tx) => {
            const supplier = await tx.supplier.findFirst({
                where: { id: dto.supplierId, organizationId: user.organizationId },
            });
            if (!supplier)
                throw new common_1.NotFoundException('Proveedor no encontrado.');
            const warehouse = (dto.warehouseId
                ? await tx.warehouse.findFirst({
                    where: { id: dto.warehouseId, organizationId: user.organizationId },
                })
                : null) ??
                (await tx.warehouse.findFirst({
                    where: { organizationId: user.organizationId, isPrimary: true },
                }));
            if (!warehouse)
                throw new common_1.NotFoundException('No encontramos un almacén operativo.');
            const productIds = dto.items.map((i) => i.productId);
            const products = await tx.product.findMany({
                where: { organizationId: user.organizationId, id: { in: productIds } },
            });
            const productMap = new Map(products.map((p) => [p.id, p]));
            for (const item of dto.items) {
                if (!productMap.has(item.productId)) {
                    throw new common_1.NotFoundException(`Producto ${item.productId} no encontrado.`);
                }
            }
            const referenceId = (0, node_crypto_1.randomUUID)();
            let subtotal = 0;
            let taxTotal = 0;
            for (const item of dto.items) {
                const product = productMap.get(item.productId);
                const lineSubtotal = item.quantity * item.unitCost;
                const lineTax = item.taxAmount ?? 0;
                subtotal += lineSubtotal;
                taxTotal += lineTax;
                await tx.stockMovement.create({
                    data: {
                        organizationId: user.organizationId,
                        productId: product.id,
                        warehouseId: warehouse.id,
                        branchId: warehouse.branchId,
                        actorMembershipId: user.membershipId,
                        type: 'PURCHASE',
                        quantity: decimal(item.quantity),
                        unitCost: decimal(item.unitCost),
                        referenceType: 'purchase',
                        referenceId,
                        note: dto.supplierInvoiceNumber
                            ? `Compra ${dto.supplierInvoiceNumber}`
                            : `Compra del proveedor ${supplier.name}`,
                    },
                });
                const existing = await tx.productInventory.findFirst({
                    where: { productId: product.id, warehouseId: warehouse.id },
                });
                if (existing) {
                    const stockAnterior = toNumber(existing.availableQty);
                    const costoAnterior = toNumber(existing.averageCost);
                    const nuevoCosto = stockAnterior + item.quantity <= 0
                        ? item.unitCost
                        : (stockAnterior * costoAnterior + item.quantity * item.unitCost) /
                            (stockAnterior + item.quantity);
                    await tx.productInventory.update({
                        where: { id: existing.id },
                        data: {
                            availableQty: decimal(stockAnterior + item.quantity),
                            averageCost: decimal(nuevoCosto),
                        },
                    });
                }
                else {
                    await tx.productInventory.create({
                        data: {
                            organizationId: user.organizationId,
                            productId: product.id,
                            warehouseId: warehouse.id,
                            availableQty: decimal(item.quantity),
                            averageCost: decimal(item.unitCost),
                        },
                    });
                }
                await tx.product.update({
                    where: { id: product.id },
                    data: { costPrice: decimal(item.unitCost) },
                });
            }
            const grandTotal = subtotal + taxTotal;
            if (dto.paymentTerms === 'CREDIT') {
                await tx.payable.create({
                    data: {
                        organizationId: user.organizationId,
                        supplierId: supplier.id,
                        dueDate: new Date(dto.dueDate),
                        originalAmount: decimal(grandTotal),
                        outstandingAmount: decimal(grandTotal),
                        status: 'PENDING',
                    },
                });
            }
            const accountCodes = [
                contracts_1.ACCOUNT_KEYS.INVENTORY,
                contracts_1.ACCOUNT_KEYS.VAT_RECEIVABLE,
                contracts_1.ACCOUNT_KEYS.AP_SUPPLIERS,
                contracts_1.ACCOUNT_KEYS.CASH,
            ];
            const accounts = await tx.account.findMany({
                where: {
                    organizationId: user.organizationId,
                    code: { in: accountCodes },
                },
            });
            const accountMap = new Map(accounts.map((a) => [a.code, a]));
            const inventoryAcc = accountMap.get(contracts_1.ACCOUNT_KEYS.INVENTORY);
            const vatAcc = accountMap.get(contracts_1.ACCOUNT_KEYS.VAT_RECEIVABLE);
            const apAcc = accountMap.get(contracts_1.ACCOUNT_KEYS.AP_SUPPLIERS);
            const cashAcc = accountMap.get(contracts_1.ACCOUNT_KEYS.CASH);
            if (!inventoryAcc || !apAcc || !cashAcc) {
                throw new common_1.BadRequestException('Catálogo de cuentas incompleto. Vuelve a sembrar el plan contable.');
            }
            const lines = [
                {
                    account: { connect: { id: inventoryAcc.id } },
                    description: 'Entrada de inventario',
                    debit: decimal(subtotal),
                    credit: decimal(0),
                },
            ];
            if (taxTotal > 0 && vatAcc) {
                lines.push({
                    account: { connect: { id: vatAcc.id } },
                    description: 'IVA acreditable',
                    debit: decimal(taxTotal),
                    credit: decimal(0),
                });
            }
            lines.push({
                account: {
                    connect: { id: (dto.paymentTerms === 'CREDIT' ? apAcc : cashAcc).id },
                },
                description: dto.paymentTerms === 'CREDIT'
                    ? `Compra al crédito ${supplier.name}`
                    : `Pago compra ${supplier.name}`,
                debit: decimal(0),
                credit: decimal(grandTotal),
            });
            const totalDebit = lines.reduce((acc, l) => acc + Number(l.debit), 0);
            const totalCredit = lines.reduce((acc, l) => acc + Number(l.credit), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.0001) {
                throw new common_1.BadRequestException(`Asiento de compra desbalanceado: debe=${totalDebit.toFixed(4)} haber=${totalCredit.toFixed(4)}`);
            }
            const journalCount = await tx.journalEntry.count({
                where: { organizationId: user.organizationId },
            });
            await tx.journalEntry.create({
                data: {
                    organizationId: user.organizationId,
                    branchId: warehouse.branchId,
                    number: `AS-${String(journalCount + 1).padStart(6, '0')}`,
                    memo: dto.supplierInvoiceNumber
                        ? `Compra ${supplier.name} ${dto.supplierInvoiceNumber}`
                        : `Compra del proveedor ${supplier.name}`,
                    sourceType: 'purchase',
                    sourceId: referenceId,
                    entryDate: new Date(),
                    createdByMembershipId: user.membershipId,
                    lines: { create: lines },
                },
            });
            return { referenceId, subtotal, taxTotal, grandTotal };
        });
    }
    async suppliers(user) {
        return this.prisma.supplier.findMany({
            where: { organizationId: user.organizationId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }
    async createSupplier(user, dto) {
        return this.prisma.supplier.create({
            data: {
                organizationId: user.organizationId,
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                taxIdentifier: dto.taxIdentifier,
                contactName: dto.contactName,
            },
        });
    }
    async updateSupplier(user, id, dto) {
        const existing = await this.prisma.supplier.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
        });
        if (!existing)
            throw new common_1.NotFoundException('Proveedor no encontrado.');
        return this.prisma.supplier.update({
            where: { id },
            data: {
                name: dto.name ?? undefined,
                email: dto.email ?? undefined,
                phone: dto.phone ?? undefined,
                taxIdentifier: dto.taxIdentifier ?? undefined,
                contactName: dto.contactName ?? undefined,
            },
        });
    }
    async deleteSupplier(user, id) {
        const existing = await this.prisma.supplier.findFirst({
            where: { id, organizationId: user.organizationId, deletedAt: null },
            include: { _count: { select: { payables: true } } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Proveedor no encontrado.');
        if (existing._count.payables > 0) {
            throw new common_1.BadRequestException('El proveedor tiene cuentas por pagar pendientes.');
        }
        await this.prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        return { deleted: true, id };
    }
};
exports.PurchasesService = PurchasesService;
exports.PurchasesService = PurchasesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchasesService);
//# sourceMappingURL=purchases.service.js.map