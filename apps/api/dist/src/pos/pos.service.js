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
exports.PosService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const pos_accounting_1 = require("./pos-accounting");
const toDecimal = (value) => new client_1.Prisma.Decimal(value);
const toNumber = (value) => Number(value ?? 0);
let PosService = class PosService {
    prisma;
    eventEmitter;
    constructor(prisma, eventEmitter) {
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
    }
    async catalog(user, query) {
        const products = await this.prisma.product.findMany({
            where: {
                organizationId: user.organizationId,
                isActive: true,
                deletedAt: null,
                categoryId: query.categoryId,
                OR: query.search
                    ? [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { sku: { contains: query.search, mode: 'insensitive' } },
                        { barcode: { contains: query.search, mode: 'insensitive' } },
                    ]
                    : undefined,
            },
            include: {
                inventory: true,
                taxRate: true,
                category: true,
            },
            take: query.pageSize ?? 40,
            orderBy: [{ name: 'asc' }],
        });
        return products.map((product) => ({
            ...product,
            stockDisponible: product.inventory.reduce((acc, row) => acc + toNumber(row.availableQty), 0),
        }));
    }
    async suspended(user) {
        return this.prisma.sale.findMany({
            where: {
                organizationId: user.organizationId,
                status: client_1.SaleStatus.SUSPENDED,
            },
            include: { customer: true, items: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async checkout(user, dto) {
        if (dto.items.length === 0) {
            throw new common_1.BadRequestException('El carrito no puede estar vacío.');
        }
        return this.prisma.$transaction(async (transaction) => {
            const branch = (dto.branchId
                ? await transaction.branch.findFirst({
                    where: { id: dto.branchId, organizationId: user.organizationId },
                })
                : await transaction.branch.findFirst({
                    where: {
                        id: user.defaultBranchId ?? undefined,
                        organizationId: user.organizationId,
                    },
                })) ??
                (await transaction.branch.findFirst({
                    where: { organizationId: user.organizationId, isPrimary: true },
                }));
            if (!branch) {
                throw new common_1.NotFoundException('No encontramos la sucursal seleccionada.');
            }
            const warehouse = await transaction.warehouse.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    branchId: branch.id,
                    isPrimary: true,
                },
            });
            const products = await transaction.product.findMany({
                where: {
                    organizationId: user.organizationId,
                    id: { in: dto.items.map((item) => item.productId) },
                },
                include: {
                    taxRate: true,
                    inventory: {
                        where: { warehouseId: warehouse.id },
                    },
                },
            });
            const productMap = new Map(products.map((product) => [product.id, product]));
            const items = dto.items.map((item) => {
                const product = productMap.get(item.productId);
                if (!product) {
                    throw new common_1.NotFoundException(`Producto ${item.productId} no encontrado.`);
                }
                const inventory = product.inventory[0];
                const quantity = item.quantity;
                if (!inventory || toNumber(inventory.availableQty) < quantity) {
                    throw new common_1.BadRequestException(`Stock insuficiente para ${product.name}.`);
                }
                const base = toNumber(product.salePrice) * quantity;
                const discount = item.discount ?? 0;
                const taxable = base - discount;
                const taxRate = toNumber(product.taxRate?.rate);
                const tax = taxable * (taxRate / 100);
                const total = taxable + tax;
                return {
                    product,
                    inventory,
                    quantity,
                    discount,
                    tax,
                    total,
                };
            });
            const subtotal = items.reduce((acc, item) => acc + toNumber(item.product.salePrice) * item.quantity, 0);
            const discountTotal = items.reduce((acc, item) => acc + item.discount, 0);
            const taxTotal = items.reduce((acc, item) => acc + item.tax, 0);
            const grandTotal = items.reduce((acc, item) => acc + item.total, 0);
            const paidTotal = dto.payments.reduce((acc, payment) => acc + payment.amount, 0);
            const saleCount = await transaction.sale.count({
                where: { organizationId: user.organizationId },
            });
            const saleNumber = `POS-${String(saleCount + 1).padStart(6, '0')}`;
            const sale = await transaction.sale.create({
                data: {
                    organizationId: user.organizationId,
                    branchId: branch.id,
                    warehouseId: warehouse.id,
                    customerId: dto.customerId,
                    number: saleNumber,
                    type: client_1.SaleType.POS,
                    status: paidTotal >= grandTotal || dto.customerId
                        ? client_1.SaleStatus.COMPLETED
                        : client_1.SaleStatus.SUSPENDED,
                    subtotal: toDecimal(subtotal),
                    taxTotal: toDecimal(taxTotal),
                    discountTotal: toDecimal(discountTotal),
                    paidTotal: toDecimal(paidTotal),
                    grandTotal: toDecimal(grandTotal),
                    note: dto.note,
                    createdByMembershipId: user.membershipId,
                    items: {
                        create: items.map((item) => ({
                            productId: item.product.id,
                            quantity: toDecimal(item.quantity),
                            unitPrice: item.product.salePrice,
                            unitCost: item.product.costPrice,
                            taxAmount: toDecimal(item.tax),
                            discountAmount: toDecimal(item.discount),
                            lineTotal: toDecimal(item.total),
                        })),
                    },
                },
                include: { items: true },
            });
            if (sale.status === client_1.SaleStatus.COMPLETED) {
                for (const payment of dto.payments) {
                    await transaction.payment.create({
                        data: {
                            organizationId: user.organizationId,
                            saleId: sale.id,
                            branchId: branch.id,
                            method: payment.method,
                            amount: toDecimal(payment.amount),
                            reference: payment.reference,
                        },
                    });
                }
                for (const item of items) {
                    await transaction.productInventory.update({
                        where: {
                            warehouseId_productId: {
                                warehouseId: warehouse.id,
                                productId: item.product.id,
                            },
                        },
                        data: {
                            availableQty: {
                                decrement: toDecimal(item.quantity),
                            },
                        },
                    });
                    await transaction.stockMovement.create({
                        data: {
                            organizationId: user.organizationId,
                            productId: item.product.id,
                            warehouseId: warehouse.id,
                            branchId: branch.id,
                            actorMembershipId: user.membershipId,
                            type: 'SALE',
                            quantity: toDecimal(item.quantity),
                            unitCost: item.product.costPrice,
                            referenceType: 'sale',
                            referenceId: sale.id,
                            note: `Salida por venta ${sale.number}`,
                        },
                    });
                }
                if (paidTotal < grandTotal && dto.customerId) {
                    await transaction.receivable.create({
                        data: {
                            organizationId: user.organizationId,
                            customerId: dto.customerId,
                            saleId: sale.id,
                            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                            originalAmount: toDecimal(grandTotal),
                            outstandingAmount: toDecimal(grandTotal - paidTotal),
                            status: paidTotal > 0 ? 'PARTIAL' : 'PENDING',
                        },
                    });
                }
                const accounts = await transaction.account.findMany({
                    where: {
                        organizationId: user.organizationId,
                        code: { in: ['1101', '1201', '1301', '2102', '4101', '5101'] },
                    },
                });
                const accountMap = new Map(accounts.map((account) => [account.code, account]));
                const cuentaId = (code) => {
                    const account = accountMap.get(code);
                    if (!account) {
                        throw new common_1.BadRequestException(`Cuenta contable ${code} no está configurada en el plan de cuentas.`);
                    }
                    return account.id;
                };
                const cogs = items.reduce((acc, item) => acc + toNumber(item.product.costPrice) * item.quantity, 0);
                const journalLines = (0, pos_accounting_1.construirLineasAsientoVenta)({
                    grandTotal,
                    taxTotal,
                    paidTotal,
                    cogs,
                    cuentaId,
                });
                const journalCount = await transaction.journalEntry.count({
                    where: { organizationId: user.organizationId },
                });
                await transaction.journalEntry.create({
                    data: {
                        organizationId: user.organizationId,
                        branchId: branch.id,
                        number: `AS-${String(journalCount + 1).padStart(6, '0')}`,
                        memo: `Venta POS ${sale.number}`,
                        sourceType: 'sale',
                        sourceId: sale.id,
                        entryDate: new Date(),
                        createdByMembershipId: user.membershipId,
                        lines: {
                            create: journalLines.map((l) => ({
                                accountId: l.accountId,
                                description: l.description,
                                debit: toDecimal(l.debit),
                                credit: toDecimal(l.credit),
                            })),
                        },
                    },
                });
                this.eventEmitter.emit('sales.completed', {
                    organizationId: user.organizationId,
                    saleId: sale.id,
                    total: grandTotal,
                });
            }
            const [customer, organization, companySetting, membership] = await Promise.all([
                dto.customerId
                    ? transaction.customer.findFirst({
                        where: {
                            id: dto.customerId,
                            organizationId: user.organizationId,
                        },
                        select: { id: true, fullName: true, documentId: true },
                    })
                    : Promise.resolve(null),
                transaction.organization.findUniqueOrThrow({
                    where: { id: user.organizationId },
                    select: { legalName: true, currencyCode: true },
                }),
                transaction.companySetting.findUnique({
                    where: { organizationId: user.organizationId },
                    select: { invoiceTemplate: true },
                }),
                user.membershipId
                    ? transaction.membership.findUnique({
                        where: { id: user.membershipId },
                        include: {
                            user: {
                                select: { firstName: true, lastName: true, email: true },
                            },
                        },
                    })
                    : Promise.resolve(null),
            ]);
            const receipt = construirReciboSnapshot({
                emisorConfig: companySetting?.invoiceTemplate?.['emisor'],
                legalName: organization.legalName,
                currency: organization.currencyCode,
                sale,
                branchName: branch.name,
                cajero: membership?.user
                    ? `${membership.user.firstName} ${membership.user.lastName}`.trim()
                    : membership?.user?.email ?? '—',
                customer,
                items: items.map((item) => ({
                    descripcion: item.product.name,
                    cantidad: item.quantity,
                    precioUnit: toNumber(item.product.salePrice),
                    subtotal: toNumber(item.product.salePrice) * item.quantity,
                })),
                subtotal,
                discountTotal,
                taxTotal,
                grandTotal,
                paidTotal,
                payments: dto.payments.map((payment) => ({
                    metodo: payment.method,
                    monto: payment.amount,
                    referencia: payment.reference ?? null,
                })),
                amountReceived: dto.amountReceived,
            });
            await transaction.sale.update({
                where: { id: sale.id },
                data: { receiptSnapshot: receipt },
            });
            return {
                sale,
                branch: { id: branch.id, name: branch.name },
                customer,
                receipt,
                totals: {
                    subtotal,
                    discountTotal,
                    taxTotal,
                    grandTotal,
                    paidTotal,
                },
            };
        });
    }
    async receipts(user, query) {
        const where = {
            organizationId: user.organizationId,
            receiptSnapshot: { not: client_1.Prisma.DbNull },
        };
        if (query.status) {
            where.status = query.status;
        }
        if (query.branchId) {
            where.branchId = query.branchId;
        }
        if (query.method) {
            where.payments = { some: { method: query.method } };
        }
        if (query.search) {
            where.OR = [
                { number: { contains: query.search, mode: 'insensitive' } },
                {
                    customer: {
                        fullName: { contains: query.search, mode: 'insensitive' },
                    },
                },
            ];
        }
        if (query.from || query.to) {
            const soldAt = {};
            if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
                soldAt.gte = new Date(`${query.from}T00:00:00`);
            }
            if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
                const end = new Date(`${query.to}T00:00:00`);
                soldAt.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            }
            where.soldAt = soldAt;
        }
        const sales = await this.prisma.sale.findMany({
            where,
            select: {
                id: true,
                number: true,
                soldAt: true,
                status: true,
                grandTotal: true,
                paidTotal: true,
                receiptSnapshot: true,
                customer: { select: { fullName: true } },
                branch: { select: { name: true } },
                payments: { select: { method: true, amount: true } },
            },
            orderBy: { soldAt: 'desc' },
            take: 1000,
        });
        const porMetodo = new Map();
        const porEstado = new Map();
        let montoTotal = 0;
        for (const sale of sales) {
            montoTotal += toNumber(sale.grandTotal);
            porEstado.set(sale.status, (porEstado.get(sale.status) ?? 0) + 1);
            const metodosVenta = new Set();
            for (const payment of sale.payments) {
                const acc = porMetodo.get(payment.method) ?? { count: 0, monto: 0 };
                acc.monto += toNumber(payment.amount);
                if (!metodosVenta.has(payment.method)) {
                    acc.count += 1;
                    metodosVenta.add(payment.method);
                }
                porMetodo.set(payment.method, acc);
            }
        }
        return {
            resumen: {
                totalRecibos: sales.length,
                montoTotal,
                porMetodo: Array.from(porMetodo.entries()).map(([metodo, value]) => ({
                    metodo,
                    count: value.count,
                    monto: value.monto,
                })),
                porEstado: Array.from(porEstado.entries()).map(([estado, count]) => ({
                    estado,
                    count,
                })),
            },
            recibos: sales.map((sale) => ({
                id: sale.id,
                numero: sale.number,
                fecha: sale.soldAt,
                estado: sale.status,
                cliente: sale.customer?.fullName ?? null,
                sucursal: sale.branch.name,
                total: toNumber(sale.grandTotal),
                metodos: Array.from(new Set(sale.payments.map((p) => p.method))),
                snapshot: sale.receiptSnapshot,
            })),
        };
    }
    async cashClose(user, query) {
        const { from, to, label } = this.resolveDayRange(query.date);
        const branch = query.branchId
            ? await this.prisma.branch.findFirst({
                where: { id: query.branchId, organizationId: user.organizationId },
                select: { id: true, name: true },
            })
            : null;
        const sales = await this.prisma.sale.findMany({
            where: {
                organizationId: user.organizationId,
                status: client_1.SaleStatus.COMPLETED,
                soldAt: { gte: from, lt: to },
                branchId: query.branchId || undefined,
            },
            include: { payments: true },
            orderBy: { soldAt: 'asc' },
        });
        const byMethod = new Map();
        let subtotal = 0;
        let discountTotal = 0;
        let taxTotal = 0;
        let grossTotal = 0;
        let paidTotal = 0;
        for (const sale of sales) {
            subtotal += toNumber(sale.subtotal);
            discountTotal += toNumber(sale.discountTotal);
            taxTotal += toNumber(sale.taxTotal);
            grossTotal += toNumber(sale.grandTotal);
            paidTotal += toNumber(sale.paidTotal);
            for (const payment of sale.payments) {
                const current = byMethod.get(payment.method) ?? { count: 0, amount: 0 };
                current.count += 1;
                current.amount += toNumber(payment.amount);
                byMethod.set(payment.method, current);
            }
        }
        const creditOutstanding = sales.reduce((acc, sale) => acc + Math.max(toNumber(sale.grandTotal) - toNumber(sale.paidTotal), 0), 0);
        return {
            date: label,
            range: { from, to },
            branch,
            salesCount: sales.length,
            totals: {
                subtotal,
                discountTotal,
                taxTotal,
                grossTotal,
                paidTotal,
                creditOutstanding,
            },
            byMethod: Array.from(byMethod.entries()).map(([method, value]) => ({
                method,
                count: value.count,
                amount: value.amount,
            })),
        };
    }
    resolveDayRange(date) {
        const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? new Date(`${date}T00:00:00`)
            : new Date();
        const from = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
        const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
        const label = `${String(from.getDate()).padStart(2, '0')}/${String(from.getMonth() + 1).padStart(2, '0')}/${from.getFullYear()}`;
        return { from, to, label };
    }
};
exports.PosService = PosService;
exports.PosService = PosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2])
], PosService);
const ESTADO_RECIBO = {
    COMPLETED: 'Emitido',
    SUSPENDED: 'En espera',
    VOID: 'Anulado',
    REFUNDED: 'Devuelto',
};
function construirReciboSnapshot(input) {
    const cfg = (input.emisorConfig ?? {});
    const emisor = {
        nombre: cfg.nombre || input.legalName || 'Mi empresa',
        ruc: cfg.ruc ?? '',
        direccion: cfg.direccion ?? '',
        telefono: cfg.telefono ?? '',
        correo: cfg.correo ?? '',
        caja: cfg.caja || 'Caja General',
        piePagina: cfg.piePagina ?? '',
    };
    const montoRecibido = input.amountReceived ?? input.paidTotal;
    return {
        emisor,
        moneda: input.currency,
        numero: input.sale.number,
        fecha: input.sale.soldAt.toISOString(),
        sucursal: input.branchName,
        cajero: input.cajero,
        cliente: input.customer
            ? { nombre: input.customer.fullName, documento: input.customer.documentId }
            : null,
        items: input.items,
        subtotal: input.subtotal,
        descuento: input.discountTotal,
        impuesto: input.taxTotal,
        total: input.grandTotal,
        pagos: input.payments,
        montoRecibido,
        cambio: Math.max(montoRecibido - input.grandTotal, 0),
        saldoPendiente: Math.max(input.grandTotal - input.paidTotal, 0),
        observacion: input.paidTotal >= input.grandTotal
            ? 'Pago cancelado en su totalidad.'
            : null,
        estado: ESTADO_RECIBO[input.sale.status] ?? input.sale.status,
    };
}
//# sourceMappingURL=pos.service.js.map