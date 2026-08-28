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
exports.AccountingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const currency = (value) => new client_1.Prisma.Decimal(value);
const toNumber = (value) => Number(value ?? 0);
let AccountingService = class AccountingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async summary(user) {
        const [receivables, payables, expenses, payments] = await Promise.all([
            this.prisma.receivable.aggregate({
                where: {
                    organizationId: user.organizationId,
                    status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
                },
                _sum: { outstandingAmount: true },
            }),
            this.prisma.payable.aggregate({
                where: {
                    organizationId: user.organizationId,
                    status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
                },
                _sum: { outstandingAmount: true },
            }),
            this.prisma.expense.aggregate({
                where: { organizationId: user.organizationId },
                _sum: { total: true },
            }),
            this.prisma.payment.aggregate({
                where: { organizationId: user.organizationId },
                _sum: { amount: true },
            }),
        ]);
        return {
            cashFlow: toNumber(payments._sum.amount) - toNumber(expenses._sum.total),
            cuentasPorCobrar: toNumber(receivables._sum.outstandingAmount),
            cuentasPorPagar: toNumber(payables._sum.outstandingAmount),
            gastosAcumulados: toNumber(expenses._sum.total),
        };
    }
    async accounts(user) {
        return this.prisma.account.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { code: 'asc' },
        });
    }
    async trialBalance(user) {
        const lines = await this.prisma.journalEntryLine.findMany({
            where: {
                journalEntry: { organizationId: user.organizationId, status: 'POSTED' },
            },
            select: {
                debit: true,
                credit: true,
                account: { select: { id: true, code: true, name: true, type: true } },
            },
        });
        const porCuenta = new Map();
        for (const line of lines) {
            const acc = line.account;
            const actual = porCuenta.get(acc.id) ?? {
                code: acc.code,
                name: acc.name,
                type: acc.type,
                debit: 0,
                credit: 0,
            };
            actual.debit += toNumber(line.debit);
            actual.credit += toNumber(line.credit);
            porCuenta.set(acc.id, actual);
        }
        const deudoras = new Set(['ASSET', 'EXPENSE', 'COST_OF_SALES']);
        const cuentas = Array.from(porCuenta.values())
            .map((c) => ({
            ...c,
            balance: deudoras.has(c.type) ? c.debit - c.credit : c.credit - c.debit,
        }))
            .sort((a, b) => a.code.localeCompare(b.code));
        const porTipo = (tipos) => cuentas
            .filter((c) => tipos.includes(c.type))
            .map((c) => ({ code: c.code, name: c.name, balance: c.balance }));
        const totalDebit = cuentas.reduce((acc, c) => acc + c.debit, 0);
        const totalCredit = cuentas.reduce((acc, c) => acc + c.credit, 0);
        return {
            activos: porTipo(['ASSET']),
            pasivos: porTipo(['LIABILITY']),
            patrimonio: porTipo(['EQUITY']),
            ingresos: porTipo(['REVENUE']),
            gastos: porTipo(['EXPENSE', 'COST_OF_SALES']),
            totalDebit,
            totalCredit,
            balanceado: Math.abs(totalDebit - totalCredit) < 0.01,
        };
    }
    async entries(user, query) {
        const page = query.page ?? 1;
        const pageSize = Math.min(query.pageSize ?? 25, 100);
        const skip = (page - 1) * pageSize;
        const where = {
            organizationId: user.organizationId,
            ...(query.sourceType && { sourceType: query.sourceType }),
            ...(query.status && { status: query.status }),
            ...(query.from || query.to
                ? {
                    entryDate: {
                        ...(query.from && { gte: new Date(query.from) }),
                        ...(query.to && { lte: new Date(query.to) }),
                    },
                }
                : {}),
            ...(query.search
                ? {
                    OR: [
                        { number: { contains: query.search, mode: 'insensitive' } },
                        { memo: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [data, total] = await Promise.all([
            this.prisma.journalEntry.findMany({
                where,
                include: { lines: { include: { account: true } } },
                orderBy: { entryDate: 'desc' },
                skip,
                take: pageSize,
            }),
            this.prisma.journalEntry.count({ where }),
        ]);
        return { data, meta: { page, pageSize, total } };
    }
    async createEntry(user, dto) {
        const debitTotal = dto.lines.reduce((acc, line) => acc + line.debit, 0);
        const creditTotal = dto.lines.reduce((acc, line) => acc + line.credit, 0);
        if (Math.abs(debitTotal - creditTotal) > 0.001) {
            throw new common_1.BadRequestException('La partida contable debe estar balanceada.');
        }
        const count = await this.prisma.journalEntry.count({
            where: { organizationId: user.organizationId },
        });
        return this.prisma.journalEntry.create({
            data: {
                organizationId: user.organizationId,
                branchId: user.defaultBranchId,
                number: `AS-${String(count + 1).padStart(6, '0')}`,
                memo: dto.memo,
                sourceType: 'manual',
                entryDate: new Date(dto.entryDate),
                createdByMembershipId: user.membershipId,
                lines: {
                    create: dto.lines.map((line) => ({
                        accountId: line.accountId,
                        description: line.description,
                        debit: currency(line.debit),
                        credit: currency(line.credit),
                    })),
                },
            },
        });
    }
    async voidEntry(user, id, dto) {
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, organizationId: user.organizationId },
            include: { lines: true },
        });
        if (!entry)
            throw new common_1.NotFoundException('Asiento no encontrado.');
        if (entry.status === 'REVERSED') {
            throw new common_1.BadRequestException('El asiento ya fue reversado.');
        }
        if (entry.sourceType && entry.sourceType !== 'manual') {
            throw new common_1.BadRequestException(`Este asiento es automático (origen: ${entry.sourceType}). Usa el endpoint específico para anular la operación de origen.`);
        }
        return this.prisma.$transaction(async (tx) => {
            const count = await tx.journalEntry.count({
                where: { organizationId: user.organizationId },
            });
            const reverso = await tx.journalEntry.create({
                data: {
                    organizationId: user.organizationId,
                    branchId: entry.branchId,
                    number: `AS-${String(count + 1).padStart(6, '0')}`,
                    memo: `Reverso: ${entry.memo}${dto.reason ? ' — ' + dto.reason : ''}`,
                    sourceType: 'reversal',
                    sourceId: entry.id,
                    entryDate: new Date(),
                    status: 'POSTED',
                    createdByMembershipId: user.membershipId,
                    lines: {
                        create: entry.lines.map((l) => ({
                            accountId: l.accountId,
                            description: `Reverso: ${l.description ?? ''}`,
                            debit: l.credit,
                            credit: l.debit,
                        })),
                    },
                },
            });
            await tx.journalEntry.update({
                where: { id: entry.id },
                data: { status: 'REVERSED' },
            });
            return { reversed: true, reverso, reason: dto.reason };
        });
    }
};
exports.AccountingService = AccountingService;
exports.AccountingService = AccountingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccountingService);
//# sourceMappingURL=accounting.service.js.map