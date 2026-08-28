"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
let OnboardingService = class OnboardingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async state(user) {
        const [organization, taxes, branch, subscription] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({
                where: { id: user.organizationId },
            }),
            this.prisma.taxRate.findMany({
                where: { organizationId: user.organizationId },
            }),
            this.prisma.branch.findFirst({
                where: { organizationId: user.organizationId, isPrimary: true },
            }),
            this.prisma.subscription.findUnique({
                where: { organizationId: user.organizationId },
            }),
        ]);
        return {
            organization,
            taxes,
            branch,
            subscription,
            completed: Boolean(organization.onboardingCompletedAt),
        };
    }
    async complete(user, dto) {
        return this.prisma.$transaction(async (transaction) => {
            const primaryBranch = await transaction.branch.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    isPrimary: true,
                },
            });
            await transaction.organization.update({
                where: { id: user.organizationId },
                data: {
                    businessType: dto.businessType,
                    countryCode: dto.countryCode.toUpperCase(),
                    currencyCode: dto.currencyCode.toUpperCase(),
                    timezone: dto.timezone,
                    onboardingCompletedAt: new Date(),
                },
            });
            await transaction.branch.update({
                where: { id: primaryBranch.id },
                data: { name: dto.primaryBranchName },
            });
            await Promise.all(dto.taxes.map((tax, index) => transaction.taxRate.upsert({
                where: {
                    organizationId_code: {
                        organizationId: user.organizationId,
                        code: tax.code,
                    },
                },
                update: {
                    name: tax.name,
                    rate: new client_1.Prisma.Decimal(tax.rate),
                    scope: tax.scope,
                    isDefault: index === 0,
                },
                create: {
                    organizationId: user.organizationId,
                    code: tax.code,
                    name: tax.name,
                    rate: new client_1.Prisma.Decimal(tax.rate),
                    scope: tax.scope,
                    isDefault: index === 0,
                },
            })));
            const roles = await transaction.role.findMany({
                where: { organizationId: user.organizationId },
            });
            const primaryWarehouse = await transaction.warehouse.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    isPrimary: true,
                },
            });
            const defaultTax = await transaction.taxRate.findFirstOrThrow({
                where: {
                    organizationId: user.organizationId,
                    isDefault: true,
                },
            });
            for (const initialUser of dto.initialUsers) {
                const role = roles.find((candidate) => candidate.key === initialUser.roleKey);
                if (!role) {
                    continue;
                }
                const passwordHash = await argon2.hash(initialUser.password);
                const createdUser = await transaction.user.upsert({
                    where: { email: initialUser.email.toLowerCase() },
                    update: {
                        firstName: initialUser.firstName,
                        lastName: initialUser.lastName,
                        passwordHash,
                    },
                    create: {
                        email: initialUser.email.toLowerCase(),
                        firstName: initialUser.firstName,
                        lastName: initialUser.lastName,
                        passwordHash,
                    },
                });
                const membership = await transaction.membership.upsert({
                    where: {
                        organizationId_userId: {
                            organizationId: user.organizationId,
                            userId: createdUser.id,
                        },
                    },
                    update: {
                        roleId: role.id,
                        defaultBranchId: primaryBranch.id,
                    },
                    create: {
                        organizationId: user.organizationId,
                        userId: createdUser.id,
                        roleId: role.id,
                        defaultBranchId: primaryBranch.id,
                    },
                });
                await transaction.employeeProfile.upsert({
                    where: { membershipId: membership.id },
                    update: {
                        branchId: primaryBranch.id,
                        jobTitle: initialUser.jobTitle ?? 'Operación',
                    },
                    create: {
                        organizationId: user.organizationId,
                        membershipId: membership.id,
                        branchId: primaryBranch.id,
                        employeeCode: `EMP-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
                        jobTitle: initialUser.jobTitle ?? 'Operación',
                        hireDate: new Date(),
                    },
                });
            }
            for (const initialProduct of dto.initialProducts) {
                const category = initialProduct.categoryName
                    ? await transaction.category.upsert({
                        where: {
                            organizationId_name: {
                                organizationId: user.organizationId,
                                name: initialProduct.categoryName,
                            },
                        },
                        update: {},
                        create: {
                            organizationId: user.organizationId,
                            name: initialProduct.categoryName,
                        },
                    })
                    : null;
                const product = await transaction.product.upsert({
                    where: {
                        organizationId_sku: {
                            organizationId: user.organizationId,
                            sku: initialProduct.sku,
                        },
                    },
                    update: {
                        name: initialProduct.name,
                        salePrice: new client_1.Prisma.Decimal(initialProduct.salePrice),
                        costPrice: new client_1.Prisma.Decimal(initialProduct.costPrice),
                        minStock: new client_1.Prisma.Decimal(initialProduct.minStock),
                        categoryId: category?.id,
                        taxRateId: defaultTax.id,
                    },
                    create: {
                        organizationId: user.organizationId,
                        sku: initialProduct.sku,
                        name: initialProduct.name,
                        unit: 'unidad',
                        salePrice: new client_1.Prisma.Decimal(initialProduct.salePrice),
                        costPrice: new client_1.Prisma.Decimal(initialProduct.costPrice),
                        minStock: new client_1.Prisma.Decimal(initialProduct.minStock),
                        categoryId: category?.id,
                        taxRateId: defaultTax.id,
                    },
                });
                await transaction.productInventory.upsert({
                    where: {
                        warehouseId_productId: {
                            warehouseId: primaryWarehouse.id,
                            productId: product.id,
                        },
                    },
                    update: {},
                    create: {
                        organizationId: user.organizationId,
                        productId: product.id,
                        warehouseId: primaryWarehouse.id,
                        availableQty: new client_1.Prisma.Decimal(initialProduct.minStock * 2),
                        averageCost: new client_1.Prisma.Decimal(initialProduct.costPrice),
                    },
                });
            }
            return { completed: true };
        });
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map