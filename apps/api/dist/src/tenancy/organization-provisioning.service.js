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
exports.OrganizationProvisioningService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const contracts_1 = require("@atria/contracts");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
let OrganizationProvisioningService = class OrganizationProvisioningService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async provision(transaction, input) {
        const organization = await transaction.organization.create({
            data: {
                slug: input.slug,
                displayName: input.displayName,
                legalName: input.legalName,
                businessType: input.businessType,
                countryCode: input.countryCode,
                currencyCode: input.currencyCode,
                timezone: input.timezone,
            },
            select: { id: true, slug: true, displayName: true },
        });
        const roles = await Promise.all(Object.entries(contracts_1.roleTemplates).map(([key, permissions]) => transaction.role.create({
            data: {
                organizationId: organization.id,
                key,
                name: key === 'owner'
                    ? 'Propietario'
                    : key === 'admin'
                        ? 'Administrador'
                        : key === 'worker'
                            ? 'Operador'
                            : 'Contabilidad',
                isSystem: true,
                permissions,
            },
        })));
        const primaryBranch = await transaction.branch.create({
            data: {
                organizationId: organization.id,
                code: 'CENTRAL',
                name: input.primaryBranchName,
                addressLine1: 'A definir',
                city: 'A definir',
                countryCode: input.countryCode,
                isPrimary: true,
            },
        });
        const primaryWarehouse = await transaction.warehouse.create({
            data: {
                organizationId: organization.id,
                branchId: primaryBranch.id,
                code: 'BOD-CENTRAL',
                name: 'Bodega principal',
                isPrimary: true,
            },
        });
        await transaction.taxRate.create({
            data: {
                organizationId: organization.id,
                code: 'GENERAL',
                name: 'Impuesto general',
                rate: new client_1.Prisma.Decimal(0),
                scope: 'BOTH',
                isDefault: true,
            },
        });
        await transaction.companySetting.create({
            data: {
                organizationId: organization.id,
                invoicePrefix: 'FAC',
                quotePrefix: 'COT',
                themePrimary: '#2B1F3A',
                themeSecondary: '#A18BCF',
                posAllowDiscounts: true,
                posRequireCustomer: false,
                notifications: {
                    stockAlerts: true,
                    emailSummaries: true,
                    shiftClosures: true,
                },
                security: {
                    enforce2fa: false,
                    sessionTimeoutMinutes: 60,
                    passwordRotationDays: 90,
                },
                invoiceTemplate: {
                    showLogo: true,
                    footer: 'Gracias por confiar en Atria.',
                },
            },
        });
        await transaction.subscription.create({
            data: {
                organizationId: organization.id,
                planCode: 'BUSINESS',
                status: 'TRIAL',
                activeFrom: new Date(),
                renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                seatsUsed: 1,
                branchesUsed: 1,
                apiAccessEnabled: false,
            },
        });
        await this.seedDefaultChartOfAccounts(transaction, organization.id);
        const ownerRole = roles.find((role) => role.key === 'owner') ?? roles[0];
        return {
            organization,
            ownerRoleId: ownerRole.id,
            primaryBranchId: primaryBranch.id,
            primaryWarehouseId: primaryWarehouse.id,
        };
    }
    async seedDefaultChartOfAccounts(transaction, organizationId) {
        const codeToId = new Map();
        for (const cuenta of contracts_1.BASE_CHART_OF_ACCOUNTS) {
            const created = await transaction.account.create({
                data: {
                    organizationId,
                    code: cuenta.code,
                    name: cuenta.name,
                    type: cuenta.type,
                    level: cuenta.level,
                    allowsPosting: cuenta.isDetail,
                },
            });
            codeToId.set(cuenta.code, created.id);
        }
        for (const cuenta of contracts_1.BASE_CHART_OF_ACCOUNTS) {
            if (!cuenta.parentCode)
                continue;
            const parentId = codeToId.get(cuenta.parentCode);
            const selfId = codeToId.get(cuenta.code);
            if (parentId && selfId) {
                await transaction.account.update({
                    where: { id: selfId },
                    data: { parentId },
                });
            }
        }
    }
};
exports.OrganizationProvisioningService = OrganizationProvisioningService;
exports.OrganizationProvisioningService = OrganizationProvisioningService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationProvisioningService);
//# sourceMappingURL=organization-provisioning.service.js.map