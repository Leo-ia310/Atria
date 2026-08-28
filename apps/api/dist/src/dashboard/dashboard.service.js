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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const toAmount = (value) => Number(value ?? 0);
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview(user) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const chartStart = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
        const orgId = user.organizationId;
        const [saleTotals, dailySeries, monthMargin, lowStockRows, receivables, topSellers, branchSales, branches, overdueReceivables, recentActivity,] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT
          COALESCE(SUM("grandTotal") FILTER (WHERE "soldAt" >= ${startOfDay}), 0) AS today_total,
          COUNT(*)                    FILTER (WHERE "soldAt" >= ${startOfDay})    AS today_count,
          COALESCE(SUM("grandTotal") FILTER (WHERE "soldAt" >= ${startOfMonth}), 0) AS month_total,
          COALESCE(SUM("paidTotal")  FILTER (WHERE "soldAt" >= ${startOfMonth}), 0) AS month_paid,
          COUNT(*)                    FILTER (WHERE "soldAt" >= ${startOfMonth})  AS month_count,
          COALESCE(SUM("grandTotal") FILTER (WHERE "soldAt" >= ${startOfPrevMonth} AND "soldAt" < ${startOfMonth}), 0) AS prev_total
        FROM "Sale"
        WHERE "organizationId" = ${orgId}
          AND "status" = 'COMPLETED'
          AND "soldAt" >= ${startOfPrevMonth}
      `,
            this.prisma.$queryRaw `
        SELECT to_char(date_trunc('day', "soldAt"), 'YYYY-MM-DD') AS dia,
               COALESCE(SUM("grandTotal"), 0) AS total
        FROM "Sale"
        WHERE "organizationId" = ${orgId}
          AND "status" = 'COMPLETED'
          AND "soldAt" >= ${chartStart}
        GROUP BY 1
      `,
            this.prisma.$queryRaw `
        SELECT
          COALESCE(SUM(si."lineTotal"), 0) AS revenue,
          COALESCE(SUM(si."quantity" * si."unitCost"), 0) AS cost
        FROM "SaleItem" si
        JOIN "Sale" s ON s."id" = si."saleId"
        WHERE s."organizationId" = ${orgId}
          AND s."status" = 'COMPLETED'
          AND s."soldAt" >= ${startOfMonth}
      `,
            this.prisma.productInventory.findMany({
                where: { organizationId: orgId },
                include: {
                    product: true,
                    warehouse: { include: { branch: true } },
                },
                orderBy: { availableQty: 'asc' },
                take: 6,
            }),
            this.prisma.receivable.aggregate({
                where: {
                    organizationId: orgId,
                    status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
                },
                _sum: { outstandingAmount: true },
            }),
            this.prisma.sale.groupBy({
                by: ['createdByMembershipId'],
                where: {
                    organizationId: orgId,
                    status: client_1.SaleStatus.COMPLETED,
                    soldAt: { gte: startOfMonth },
                    createdByMembershipId: { not: null },
                },
                _sum: { grandTotal: true },
                _count: true,
                orderBy: { _sum: { grandTotal: 'desc' } },
                take: 5,
            }),
            this.prisma.sale.groupBy({
                by: ['branchId'],
                where: {
                    organizationId: orgId,
                    status: client_1.SaleStatus.COMPLETED,
                    soldAt: { gte: startOfMonth },
                },
                _sum: { grandTotal: true },
                _count: true,
                orderBy: { _sum: { grandTotal: 'desc' } },
            }),
            this.prisma.branch.findMany({
                where: { organizationId: orgId, deletedAt: null },
                select: { id: true, name: true },
            }),
            this.prisma.receivable.findMany({
                where: {
                    organizationId: orgId,
                    status: 'OVERDUE',
                },
                include: { customer: true, sale: { select: { number: true } } },
                orderBy: { dueDate: 'asc' },
                take: 5,
            }),
            this.prisma.auditLog.findMany({
                where: { organizationId: orgId },
                include: { actor: true },
                orderBy: { createdAt: 'desc' },
                take: 8,
            }),
        ]);
        const totals = saleTotals[0];
        const margin = monthMargin[0];
        const membershipIds = topSellers
            .map((entry) => entry.createdByMembershipId)
            .filter((value) => Boolean(value));
        const memberships = membershipIds.length
            ? await this.prisma.membership.findMany({
                where: { id: { in: membershipIds } },
                include: { user: true },
            })
            : [];
        const chartMap = new Map();
        for (let offset = 13; offset >= 0; offset -= 1) {
            const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
            chartMap.set(date.toISOString().slice(0, 10), 0);
        }
        dailySeries.forEach((row) => {
            if (chartMap.has(row.dia)) {
                chartMap.set(row.dia, toAmount(row.total));
            }
        });
        const monthRevenue = toAmount(margin?.revenue);
        const monthCost = toAmount(margin?.cost);
        const margenBruto = monthRevenue > 0 ? ((monthRevenue - monthCost) / monthRevenue) * 100 : 0;
        const branchMap = new Map(branches.map((b) => [b.id, b.name]));
        const prevRevenue = toAmount(totals?.prev_total);
        const currentRevenue = toAmount(totals?.month_total);
        const ingresosMesDelta = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
        return {
            kpis: {
                ventasHoy: {
                    total: toAmount(totals?.today_total),
                    transacciones: toAmount(totals?.today_count),
                },
                ingresosMes: {
                    total: toAmount(totals?.month_total),
                    cobrados: toAmount(totals?.month_paid),
                    transacciones: toAmount(totals?.month_count),
                    delta: ingresosMesDelta,
                },
                alertasInventario: lowStockRows.filter((row) => toAmount(row.availableQty) <= toAmount(row.product.minStock)).length,
                cuentasPorCobrar: toAmount(receivables._sum.outstandingAmount),
                margenBruto,
            },
            ventasSerie: Array.from(chartMap.entries()).map(([fecha, total]) => ({
                fecha,
                total,
            })),
            stockCritico: lowStockRows
                .filter((row) => toAmount(row.availableQty) <= toAmount(row.product.minStock))
                .map((row) => ({
                id: row.product.id,
                producto: row.product.name,
                disponible: toAmount(row.availableQty),
                minimo: toAmount(row.product.minStock),
                sucursal: row.warehouse.branch.name,
            })),
            rendimientoEquipo: topSellers.map((entry) => {
                const membership = memberships.find((candidate) => candidate.id === entry.createdByMembershipId);
                return {
                    miembroId: entry.createdByMembershipId,
                    nombre: membership?.user
                        ? `${membership.user.firstName} ${membership.user.lastName}`
                        : 'Operador',
                    transacciones: entry._count,
                    total: toAmount(entry._sum.grandTotal),
                };
            }),
            rendimientoSucursales: branchSales.map((entry) => ({
                sucursalId: entry.branchId,
                nombre: branchMap.get(entry.branchId) ?? 'Sucursal',
                ingresosMes: toAmount(entry._sum.grandTotal),
                transacciones: entry._count,
            })),
            accionRequerida: overdueReceivables.map((r) => ({
                id: r.id,
                tipo: 'factura_vencida',
                cliente: r.customer.fullName,
                venta: r.sale.number,
                monto: toAmount(r.outstandingAmount),
                diasVencido: Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / 86_400_000)),
            })),
            actividadReciente: recentActivity.map((log) => ({
                id: log.id,
                actor: log.actor
                    ? `${log.actor.firstName} ${log.actor.lastName}`
                    : 'Sistema',
                modulo: log.module,
                accion: log.action,
                entidad: log.entityType,
                fecha: log.createdAt,
            })),
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map