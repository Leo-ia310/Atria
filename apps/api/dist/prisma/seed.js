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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const contracts_1 = require("@atria/contracts");
const prisma = new client_1.PrismaClient();
async function main() {
    const ownerPassword = await argon2.hash('Atria2026!');
    const adminPassword = await argon2.hash('Atria2026!');
    const workerPassword = await argon2.hash('Atria2026!');
    const organization = await prisma.organization.upsert({
        where: { slug: 'acero-norte' },
        update: {},
        create: {
            slug: 'acero-norte',
            displayName: 'Acero Norte',
            legalName: 'Acero Norte S.A.',
            businessType: 'HARDWARE',
            countryCode: 'NI',
            currencyCode: 'USD',
            timezone: 'America/Managua',
            subscriptionPlan: 'ENTERPRISE',
            onboardingCompletedAt: new Date(),
        },
    });
    const roles = await Promise.all(Object.entries(contracts_1.roleTemplates).map(([key, permissions]) => prisma.role.upsert({
        where: {
            organizationId_key: {
                organizationId: organization.id,
                key,
            },
        },
        update: { permissions },
        create: {
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
    const branchCentral = await prisma.branch.upsert({
        where: {
            organizationId_code: {
                organizationId: organization.id,
                code: 'CENTRAL',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            code: 'CENTRAL',
            name: 'Sucursal Central',
            addressLine1: 'Carretera Norte km 8',
            city: 'Managua',
            countryCode: 'NI',
            isPrimary: true,
            phone: '+505 2222 0000',
            email: 'central@aceronorte.com',
        },
    });
    const branchPlaza = await prisma.branch.upsert({
        where: {
            organizationId_code: {
                organizationId: organization.id,
                code: 'PLAZA',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            code: 'PLAZA',
            name: 'Sucursal Plaza',
            addressLine1: 'Plaza Empresarial local 12',
            city: 'León',
            countryCode: 'NI',
            isPrimary: false,
        },
    });
    const [warehouseCentral, warehousePlaza] = await Promise.all([
        prisma.warehouse.upsert({
            where: {
                organizationId_code: {
                    organizationId: organization.id,
                    code: 'BOD-CENTRAL',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                branchId: branchCentral.id,
                code: 'BOD-CENTRAL',
                name: 'Bodega principal',
                isPrimary: true,
            },
        }),
        prisma.warehouse.upsert({
            where: {
                organizationId_code: {
                    organizationId: organization.id,
                    code: 'BOD-PLAZA',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                branchId: branchPlaza.id,
                code: 'BOD-PLAZA',
                name: 'Bodega plaza',
                isPrimary: true,
            },
        }),
    ]);
    const [ownerUser, adminUser, workerUser] = await Promise.all([
        prisma.user.upsert({
            where: { email: 'fundador@aceronorte.com' },
            update: { passwordHash: ownerPassword, emailVerifiedAt: new Date() },
            create: {
                email: 'fundador@aceronorte.com',
                firstName: 'Lucía',
                lastName: 'Mendoza',
                passwordHash: ownerPassword,
                emailVerifiedAt: new Date(),
            },
        }),
        prisma.user.upsert({
            where: { email: 'operaciones@aceronorte.com' },
            update: { passwordHash: adminPassword, emailVerifiedAt: new Date() },
            create: {
                email: 'operaciones@aceronorte.com',
                firstName: 'Carlos',
                lastName: 'Pineda',
                passwordHash: adminPassword,
                emailVerifiedAt: new Date(),
            },
        }),
        prisma.user.upsert({
            where: { email: 'caja@aceronorte.com' },
            update: { passwordHash: workerPassword, emailVerifiedAt: new Date() },
            create: {
                email: 'caja@aceronorte.com',
                firstName: 'Andrea',
                lastName: 'Ruiz',
                passwordHash: workerPassword,
                emailVerifiedAt: new Date(),
            },
        }),
    ]);
    const roleMap = new Map(roles.map((role) => [role.key, role.id]));
    const [ownerMembership, adminMembership, workerMembership] = await Promise.all([
        prisma.membership.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId: ownerUser.id,
                },
            },
            update: {
                roleId: roleMap.get('owner'),
                defaultBranchId: branchCentral.id,
            },
            create: {
                organizationId: organization.id,
                userId: ownerUser.id,
                roleId: roleMap.get('owner'),
                defaultBranchId: branchCentral.id,
            },
        }),
        prisma.membership.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId: adminUser.id,
                },
            },
            update: {
                roleId: roleMap.get('admin'),
                defaultBranchId: branchCentral.id,
            },
            create: {
                organizationId: organization.id,
                userId: adminUser.id,
                roleId: roleMap.get('admin'),
                defaultBranchId: branchCentral.id,
            },
        }),
        prisma.membership.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId: workerUser.id,
                },
            },
            update: {
                roleId: roleMap.get('worker'),
                defaultBranchId: branchPlaza.id,
            },
            create: {
                organizationId: organization.id,
                userId: workerUser.id,
                roleId: roleMap.get('worker'),
                defaultBranchId: branchPlaza.id,
            },
        }),
    ]);
    await prisma.employeeProfile.upsert({
        where: { membershipId: ownerMembership.id },
        update: {},
        create: {
            organizationId: organization.id,
            membershipId: ownerMembership.id,
            branchId: branchCentral.id,
            employeeCode: 'EMP-001',
            jobTitle: 'CEO',
            hireDate: new Date('2024-01-01T10:00:00.000Z'),
        },
    });
    await prisma.employeeProfile.upsert({
        where: { membershipId: adminMembership.id },
        update: {},
        create: {
            organizationId: organization.id,
            membershipId: adminMembership.id,
            branchId: branchCentral.id,
            employeeCode: 'EMP-002',
            jobTitle: 'Gerente de operaciones',
            hireDate: new Date('2024-03-01T10:00:00.000Z'),
        },
    });
    await prisma.employeeProfile.upsert({
        where: { membershipId: workerMembership.id },
        update: {},
        create: {
            organizationId: organization.id,
            membershipId: workerMembership.id,
            branchId: branchPlaza.id,
            employeeCode: 'EMP-003',
            jobTitle: 'Cajera',
            hireDate: new Date('2024-04-01T10:00:00.000Z'),
        },
    });
    const tax = await prisma.taxRate.upsert({
        where: {
            organizationId_code: {
                organizationId: organization.id,
                code: 'IVA15',
            },
        },
        update: { rate: new client_1.Prisma.Decimal(15), isDefault: true },
        create: {
            organizationId: organization.id,
            code: 'IVA15',
            name: 'IVA general',
            rate: new client_1.Prisma.Decimal(15),
            scope: 'BOTH',
            isDefault: true,
        },
    });
    const settings = await prisma.companySetting.upsert({
        where: { organizationId: organization.id },
        update: {},
        create: {
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
            },
            security: {
                sessionTimeoutMinutes: 60,
                enforce2fa: false,
            },
            invoiceTemplate: {
                showLogo: true,
                footer: 'Gracias por comprar en Acero Norte.',
            },
        },
    });
    await prisma.subscription.upsert({
        where: { organizationId: organization.id },
        update: {
            planCode: 'ENTERPRISE',
            status: 'ACTIVE',
            seatsUsed: 3,
            branchesUsed: 2,
            apiAccessEnabled: true,
        },
        create: {
            organizationId: organization.id,
            planCode: 'ENTERPRISE',
            status: 'ACTIVE',
            activeFrom: new Date(),
            renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            seatsUsed: 3,
            branchesUsed: 2,
            apiAccessEnabled: true,
        },
    });
    const codeToId = new Map();
    for (const cuenta of contracts_1.BASE_CHART_OF_ACCOUNTS) {
        const created = await prisma.account.upsert({
            where: {
                organizationId_code: {
                    organizationId: organization.id,
                    code: cuenta.code,
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
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
            await prisma.account.update({
                where: { id: selfId },
                data: { parentId },
            });
        }
    }
    const [categoryTools, categoryElectrical, brandBosch, brand3M, supplierAtlas,] = await Promise.all([
        prisma.category.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: 'Herramientas',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                name: 'Herramientas',
            },
        }),
        prisma.category.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: 'Eléctrico',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                name: 'Eléctrico',
            },
        }),
        prisma.brand.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: 'Bosch',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                name: 'Bosch',
            },
        }),
        prisma.brand.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: '3M',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                name: '3M',
            },
        }),
        prisma.supplier
            .upsert({
            where: {
                id: (await prisma.supplier.findFirst({
                    where: {
                        organizationId: organization.id,
                        name: 'Distribuidora Atlas',
                    },
                    select: { id: true },
                }))?.id ?? 'no-match',
            },
            update: {},
            create: {
                organizationId: organization.id,
                name: 'Distribuidora Atlas',
                email: 'compras@atlas.com',
                phone: '+505 8800 1111',
            },
        })
            .catch(async () => prisma.supplier.findFirstOrThrow({
            where: {
                organizationId: organization.id,
                name: 'Distribuidora Atlas',
            },
        })),
    ]);
    const products = await Promise.all([
        prisma.product.upsert({
            where: {
                organizationId_sku: {
                    organizationId: organization.id,
                    sku: 'BOS-MART-500',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                categoryId: categoryTools.id,
                brandId: brandBosch.id,
                supplierId: supplierAtlas.id,
                taxRateId: tax.id,
                sku: 'BOS-MART-500',
                barcode: '770123456001',
                name: 'Martillo Bosch 500g',
                unit: 'unidad',
                salePrice: new client_1.Prisma.Decimal(18.5),
                costPrice: new client_1.Prisma.Decimal(11.2),
                minStock: new client_1.Prisma.Decimal(15),
            },
        }),
        prisma.product.upsert({
            where: {
                organizationId_sku: {
                    organizationId: organization.id,
                    sku: '3M-CIN-101',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                categoryId: categoryElectrical.id,
                brandId: brand3M.id,
                supplierId: supplierAtlas.id,
                taxRateId: tax.id,
                sku: '3M-CIN-101',
                barcode: '770123456002',
                name: 'Cinta aislante 3M',
                unit: 'unidad',
                salePrice: new client_1.Prisma.Decimal(2.75),
                costPrice: new client_1.Prisma.Decimal(1.2),
                minStock: new client_1.Prisma.Decimal(40),
            },
        }),
        prisma.product.upsert({
            where: {
                organizationId_sku: {
                    organizationId: organization.id,
                    sku: 'TAL-INAL-800',
                },
            },
            update: {},
            create: {
                organizationId: organization.id,
                categoryId: categoryTools.id,
                brandId: brandBosch.id,
                supplierId: supplierAtlas.id,
                taxRateId: tax.id,
                sku: 'TAL-INAL-800',
                barcode: '770123456003',
                name: 'Taladro inalámbrico 800W',
                unit: 'unidad',
                salePrice: new client_1.Prisma.Decimal(139.99),
                costPrice: new client_1.Prisma.Decimal(98.5),
                minStock: new client_1.Prisma.Decimal(6),
                isTrackSerial: true,
            },
        }),
    ]);
    const stockSeed = [
        [warehouseCentral.id, products[0].id, 28, 11.2],
        [warehouseCentral.id, products[1].id, 92, 1.2],
        [warehouseCentral.id, products[2].id, 4, 98.5],
        [warehousePlaza.id, products[0].id, 12, 11.2],
        [warehousePlaza.id, products[1].id, 35, 1.2],
    ];
    for (const [warehouseId, productId, quantity, averageCost] of stockSeed) {
        await prisma.productInventory.upsert({
            where: {
                warehouseId_productId: {
                    warehouseId,
                    productId,
                },
            },
            update: {
                availableQty: new client_1.Prisma.Decimal(quantity),
                averageCost: new client_1.Prisma.Decimal(averageCost),
            },
            create: {
                organizationId: organization.id,
                warehouseId,
                productId,
                availableQty: new client_1.Prisma.Decimal(quantity),
                averageCost: new client_1.Prisma.Decimal(averageCost),
            },
        });
    }
    const customer = await prisma.customer.upsert({
        where: {
            organizationId_code: {
                organizationId: organization.id,
                code: 'CLI-00001',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            code: 'CLI-00001',
            fullName: 'Constructora Rivera',
            email: 'compras@rivera.com',
            phone: '+505 8899 4433',
            creditLimit: new client_1.Prisma.Decimal(5000),
            balance: new client_1.Prisma.Decimal(420),
        },
    });
    const quotation = await prisma.quotation.upsert({
        where: {
            organizationId_number: {
                organizationId: organization.id,
                number: 'COT-000001',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            branchId: branchCentral.id,
            customerId: customer.id,
            number: 'COT-000001',
            status: 'DRAFT',
            subtotal: new client_1.Prisma.Decimal(37),
            taxTotal: new client_1.Prisma.Decimal(5.55),
            discountTotal: new client_1.Prisma.Decimal(0),
            grandTotal: new client_1.Prisma.Decimal(42.55),
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdByMembershipId: adminMembership.id,
        },
    });
    const existingQuotationItem = await prisma.quotationItem.findFirst({
        where: {
            quotationId: quotation.id,
            productId: products[0].id,
        },
    });
    if (!existingQuotationItem) {
        await prisma.quotationItem.create({
            data: {
                quotationId: quotation.id,
                productId: products[0].id,
                quantity: new client_1.Prisma.Decimal(2),
                unitPrice: new client_1.Prisma.Decimal(18.5),
                taxAmount: new client_1.Prisma.Decimal(5.55),
                discountAmount: new client_1.Prisma.Decimal(0),
                lineTotal: new client_1.Prisma.Decimal(42.55),
            },
        });
    }
    const sale = await prisma.sale.upsert({
        where: {
            organizationId_number: {
                organizationId: organization.id,
                number: 'POS-000001',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            branchId: branchCentral.id,
            warehouseId: warehouseCentral.id,
            customerId: customer.id,
            number: 'POS-000001',
            type: 'POS',
            status: 'COMPLETED',
            subtotal: new client_1.Prisma.Decimal(162.74),
            taxTotal: new client_1.Prisma.Decimal(24.41),
            discountTotal: new client_1.Prisma.Decimal(5),
            paidTotal: new client_1.Prisma.Decimal(187.15),
            grandTotal: new client_1.Prisma.Decimal(182.15),
            note: 'Venta mostrador',
            createdByMembershipId: adminMembership.id,
            soldAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
    });
    const saleItemExists = await prisma.saleItem.findFirst({
        where: { saleId: sale.id, productId: products[2].id },
    });
    if (!saleItemExists) {
        await prisma.saleItem.createMany({
            data: [
                {
                    saleId: sale.id,
                    productId: products[2].id,
                    quantity: new client_1.Prisma.Decimal(1),
                    unitPrice: new client_1.Prisma.Decimal(139.99),
                    unitCost: new client_1.Prisma.Decimal(98.5),
                    taxAmount: new client_1.Prisma.Decimal(21),
                    discountAmount: new client_1.Prisma.Decimal(5),
                    lineTotal: new client_1.Prisma.Decimal(155.99),
                },
                {
                    saleId: sale.id,
                    productId: products[1].id,
                    quantity: new client_1.Prisma.Decimal(2),
                    unitPrice: new client_1.Prisma.Decimal(2.75),
                    unitCost: new client_1.Prisma.Decimal(1.2),
                    taxAmount: new client_1.Prisma.Decimal(0.82),
                    discountAmount: new client_1.Prisma.Decimal(0),
                    lineTotal: new client_1.Prisma.Decimal(6.32),
                },
            ],
        });
    }
    const existingPayment = await prisma.payment.findFirst({
        where: { saleId: sale.id },
    });
    if (!existingPayment) {
        await prisma.payment.create({
            data: {
                organizationId: organization.id,
                saleId: sale.id,
                branchId: branchCentral.id,
                method: 'CARD',
                amount: new client_1.Prisma.Decimal(182.15),
                reference: 'AUTH-22911',
            },
        });
    }
    const stockMovementExists = await prisma.stockMovement.findFirst({
        where: {
            organizationId: organization.id,
            referenceId: sale.id,
        },
    });
    if (!stockMovementExists) {
        await prisma.stockMovement.createMany({
            data: [
                {
                    organizationId: organization.id,
                    productId: products[2].id,
                    warehouseId: warehouseCentral.id,
                    branchId: branchCentral.id,
                    actorMembershipId: adminMembership.id,
                    type: 'SALE',
                    quantity: new client_1.Prisma.Decimal(1),
                    unitCost: new client_1.Prisma.Decimal(98.5),
                    referenceType: 'sale',
                    referenceId: sale.id,
                    note: 'Venta POS-000001',
                },
                {
                    organizationId: organization.id,
                    productId: products[1].id,
                    warehouseId: warehouseCentral.id,
                    branchId: branchCentral.id,
                    actorMembershipId: adminMembership.id,
                    type: 'SALE',
                    quantity: new client_1.Prisma.Decimal(2),
                    unitCost: new client_1.Prisma.Decimal(1.2),
                    referenceType: 'sale',
                    referenceId: sale.id,
                    note: 'Venta POS-000001',
                },
            ],
        });
    }
    await prisma.receivable.upsert({
        where: { saleId: sale.id },
        update: {
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            originalAmount: new client_1.Prisma.Decimal(420),
            outstandingAmount: new client_1.Prisma.Decimal(420),
            status: 'PENDING',
        },
        create: {
            organizationId: organization.id,
            customerId: customer.id,
            saleId: sale.id,
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            originalAmount: new client_1.Prisma.Decimal(420),
            outstandingAmount: new client_1.Prisma.Decimal(420),
            status: 'PENDING',
        },
    });
    await prisma.expense.createMany({
        data: [
            {
                organizationId: organization.id,
                branchId: branchCentral.id,
                supplierId: supplierAtlas.id,
                category: 'Logística',
                amount: new client_1.Prisma.Decimal(65),
                taxTotal: new client_1.Prisma.Decimal(9.75),
                total: new client_1.Prisma.Decimal(74.75),
                description: 'Transporte de carga semanal',
                occurredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            },
            {
                organizationId: organization.id,
                branchId: branchPlaza.id,
                supplierId: supplierAtlas.id,
                category: 'Operación',
                amount: new client_1.Prisma.Decimal(40),
                taxTotal: new client_1.Prisma.Decimal(6),
                total: new client_1.Prisma.Decimal(46),
                description: 'Material de empaque',
                occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
        ],
        skipDuplicates: true,
    });
    const payableExists = await prisma.payable.findFirst({
        where: {
            organizationId: organization.id,
            supplierId: supplierAtlas.id,
        },
    });
    if (!payableExists) {
        await prisma.payable.create({
            data: {
                organizationId: organization.id,
                supplierId: supplierAtlas.id,
                dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
                originalAmount: new client_1.Prisma.Decimal(520),
                outstandingAmount: new client_1.Prisma.Decimal(520),
                status: 'PENDING',
            },
        });
    }
    await prisma.attendanceRecord.createMany({
        data: [
            {
                organizationId: organization.id,
                employeeProfileId: (await prisma.employeeProfile.findUniqueOrThrow({
                    where: { membershipId: adminMembership.id },
                })).id,
                branchId: branchCentral.id,
                status: 'PRESENT',
                checkInAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
            },
            {
                organizationId: organization.id,
                employeeProfileId: (await prisma.employeeProfile.findUniqueOrThrow({
                    where: { membershipId: workerMembership.id },
                })).id,
                branchId: branchPlaza.id,
                status: 'LATE',
                checkInAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
            },
        ],
        skipDuplicates: true,
    });
    await prisma.billingInvoice.upsert({
        where: {
            organizationId_number: {
                organizationId: organization.id,
                number: 'BILL-000001',
            },
        },
        update: {},
        create: {
            organizationId: organization.id,
            number: 'BILL-000001',
            planCode: 'ENTERPRISE',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amountDue: new client_1.Prisma.Decimal(399),
            amountPaid: new client_1.Prisma.Decimal(399),
            currencyCode: 'USD',
            status: 'PAID',
        },
    });
    await prisma.reportExport
        .upsert({
        where: {
            id: (await prisma.reportExport.findFirst({
                where: { organizationId: organization.id, type: 'sales-summary' },
                select: { id: true },
            }))?.id ?? 'missing',
        },
        update: {},
        create: {
            organizationId: organization.id,
            type: 'sales-summary',
            format: 'json',
            status: 'COMPLETED',
            filters: { period: '30d' },
            fileKey: './exports/demo-sales-summary.json',
            requestedByMembershipId: ownerMembership.id,
        },
    })
        .catch(() => undefined);
    await prisma.auditLog.create({
        data: {
            organizationId: organization.id,
            actorId: ownerUser.id,
            module: 'system',
            action: 'seed',
            entityType: 'organization',
            entityId: organization.id,
            metadata: {
                settingsId: settings.id,
            },
        },
    });
    console.log('Seed completed', {
        tenant: organization.slug,
        owner: 'fundador@aceronorte.com / Atria2026!',
        admin: 'operaciones@aceronorte.com / Atria2026!',
        cashier: 'caja@aceronorte.com / Atria2026!',
    });
}
main()
    .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map