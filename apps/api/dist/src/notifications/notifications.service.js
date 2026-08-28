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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const toNumber = (value) => Number(value ?? 0);
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user) {
        const orgId = user.organizationId;
        const now = new Date();
        const [lowStock, overdue, suspended] = await Promise.all([
            this.prisma.productInventory.findMany({
                where: { organizationId: orgId },
                include: {
                    product: { select: { id: true, name: true, minStock: true } },
                    warehouse: { include: { branch: { select: { name: true } } } },
                },
                orderBy: { availableQty: 'asc' },
                take: 50,
            }),
            this.prisma.receivable.findMany({
                where: {
                    organizationId: orgId,
                    status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
                    dueDate: { lt: now },
                },
                include: {
                    customer: { select: { fullName: true } },
                    sale: { select: { id: true, number: true } },
                },
                orderBy: { dueDate: 'asc' },
                take: 20,
            }),
            this.prisma.sale.findMany({
                where: { organizationId: orgId, status: client_1.SaleStatus.SUSPENDED },
                include: { customer: { select: { fullName: true } } },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
        ]);
        const items = [];
        for (const row of lowStock) {
            const disponible = toNumber(row.availableQty);
            const minimo = toNumber(row.product.minStock);
            if (minimo > 0 && disponible <= minimo) {
                const agotado = disponible <= 0;
                items.push({
                    id: `stock:${row.product.id}:${row.warehouseId}`,
                    tipo: 'stock_bajo',
                    severidad: agotado ? 'error' : 'warning',
                    titulo: agotado ? 'Producto agotado' : 'Stock bajo',
                    descripcion: `${row.product.name} · ${disponible}/${minimo} en ${row.warehouse.branch.name}`,
                    href: '/app/inventario',
                    fecha: null,
                });
            }
        }
        for (const receivable of overdue) {
            const dias = Math.max(0, Math.floor((now.getTime() - receivable.dueDate.getTime()) / 86_400_000));
            items.push({
                id: `cxc:${receivable.id}`,
                tipo: 'factura_vencida',
                severidad: 'error',
                titulo: 'Factura vencida',
                descripcion: `${receivable.customer.fullName} · venta ${receivable.sale.number} · vencida hace ${dias} día${dias === 1 ? '' : 's'}`,
                href: `/app/ventas/${receivable.sale.id}`,
                fecha: receivable.dueDate.toISOString(),
            });
        }
        for (const sale of suspended) {
            items.push({
                id: `venta:${sale.id}`,
                tipo: 'venta_en_espera',
                severidad: 'info',
                titulo: 'Venta en espera',
                descripcion: `${sale.number}${sale.customer ? ` · ${sale.customer.fullName}` : ''}`,
                href: `/app/ventas/${sale.id}`,
                fecha: sale.createdAt.toISOString(),
            });
        }
        return { total: items.length, items };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map