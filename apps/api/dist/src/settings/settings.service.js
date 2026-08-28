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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
let SettingsService = class SettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    jsonInput(value) {
        if (value === null || value === undefined) {
            return client_1.Prisma.JsonNull;
        }
        return value;
    }
    async company(user) {
        const [organization, settings, taxes, subscription] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({
                where: { id: user.organizationId },
            }),
            this.prisma.companySetting.findUniqueOrThrow({
                where: { organizationId: user.organizationId },
            }),
            this.prisma.taxRate.findMany({
                where: { organizationId: user.organizationId },
                orderBy: { name: 'asc' },
            }),
            this.prisma.subscription.findUnique({
                where: { organizationId: user.organizationId },
            }),
        ]);
        return {
            organization,
            settings,
            taxes,
            subscription,
        };
    }
    async update(user, dto) {
        return this.prisma.$transaction(async (transaction) => {
            const organization = await transaction.organization.update({
                where: { id: user.organizationId },
                data: {
                    displayName: dto.displayName,
                    legalName: dto.legalName,
                },
            });
            const current = await transaction.companySetting.findUniqueOrThrow({
                where: { organizationId: user.organizationId },
            });
            const settings = await transaction.companySetting.update({
                where: { organizationId: user.organizationId },
                data: {
                    invoicePrefix: dto.invoicePrefix ?? current.invoicePrefix,
                    quotePrefix: dto.quotePrefix ?? current.quotePrefix,
                    themePrimary: dto.themePrimary ?? current.themePrimary,
                    themeSecondary: dto.themeSecondary ?? current.themeSecondary,
                    posAllowDiscounts: dto.posAllowDiscounts ?? current.posAllowDiscounts,
                    posRequireCustomer: dto.posRequireCustomer ?? current.posRequireCustomer,
                    notifications: this.jsonInput(dto.notifications ?? current.notifications),
                    security: this.jsonInput(dto.security ?? current.security),
                    invoiceTemplate: this.jsonInput(dto.invoiceTemplate ?? current.invoiceTemplate),
                },
            });
            return { organization, settings };
        });
    }
    async security(user) {
        const [sessions, apiCredentials, auditLogs] = await Promise.all([
            this.prisma.deviceSession.findMany({
                where: {
                    organizationId: user.organizationId,
                    revokedAt: null,
                },
                orderBy: { lastSeenAt: 'desc' },
                take: 10,
            }),
            this.prisma.apiCredential.findMany({
                where: {
                    organizationId: user.organizationId,
                    revokedAt: null,
                },
            }),
            this.prisma.auditLog.findMany({
                where: { organizationId: user.organizationId },
                orderBy: { createdAt: 'desc' },
                take: 15,
            }),
        ]);
        return {
            sessions,
            apiCredentials,
            recentSecurityEvents: auditLogs,
        };
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map