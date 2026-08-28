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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const decimal = (value) => new client_1.Prisma.Decimal(value);
let BillingService = class BillingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview(user) {
        const [subscription, invoices, usersCount, branchCount] = await Promise.all([
            this.prisma.subscription.findUniqueOrThrow({
                where: { organizationId: user.organizationId },
            }),
            this.prisma.billingInvoice.findMany({
                where: { organizationId: user.organizationId },
                orderBy: { createdAt: 'desc' },
                take: 12,
            }),
            this.prisma.membership.count({
                where: { organizationId: user.organizationId, deletedAt: null },
            }),
            this.prisma.branch.count({
                where: { organizationId: user.organizationId, deletedAt: null },
            }),
        ]);
        return {
            subscription,
            usage: {
                users: usersCount,
                branches: branchCount,
            },
            invoices,
        };
    }
    async changePlan(user, dto) {
        const [usersCount, branchCount] = await Promise.all([
            this.prisma.membership.count({
                where: { organizationId: user.organizationId, deletedAt: null },
            }),
            this.prisma.branch.count({
                where: { organizationId: user.organizationId, deletedAt: null },
            }),
        ]);
        if (dto.planCode === 'BUSINESS' && (usersCount > 3 || branchCount > 1)) {
            throw new common_1.ForbiddenException('No puedes volver a Business mientras excedas sus límites de usuarios o sucursales.');
        }
        const billingCount = await this.prisma.billingInvoice.count({
            where: { organizationId: user.organizationId },
        });
        const [subscription, invoice] = await this.prisma.$transaction([
            this.prisma.subscription.update({
                where: { organizationId: user.organizationId },
                data: {
                    planCode: dto.planCode,
                    status: 'ACTIVE',
                    apiAccessEnabled: dto.planCode === 'ENTERPRISE',
                },
            }),
            this.prisma.billingInvoice.create({
                data: {
                    organizationId: user.organizationId,
                    number: `BILL-${String(billingCount + 1).padStart(6, '0')}`,
                    planCode: dto.planCode,
                    periodStart: new Date(),
                    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    amountDue: decimal(dto.planCode === 'ENTERPRISE' ? 399 : 99),
                    currencyCode: 'USD',
                },
            }),
        ]);
        return { subscription, invoice };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingService);
//# sourceMappingURL=billing.service.js.map