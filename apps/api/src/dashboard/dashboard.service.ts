import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

const toAmount = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: JwtUser) {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const chartStart = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);

    const [
      todaySales,
      monthSales,
      lowStockRows,
      recentSales,
      receivables,
      topSellers,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          organizationId: user.organizationId,
          status: SaleStatus.COMPLETED,
          soldAt: { gte: startOfDay },
        },
        _sum: { grandTotal: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: {
          organizationId: user.organizationId,
          status: SaleStatus.COMPLETED,
          soldAt: { gte: startOfMonth },
        },
        _sum: { grandTotal: true, paidTotal: true },
        _count: true,
      }),
      this.prisma.productInventory.findMany({
        where: { organizationId: user.organizationId },
        include: {
          product: true,
          warehouse: { include: { branch: true } },
        },
        orderBy: { availableQty: 'asc' },
        take: 6,
      }),
      this.prisma.sale.findMany({
        where: {
          organizationId: user.organizationId,
          status: SaleStatus.COMPLETED,
          soldAt: { gte: chartStart },
        },
        select: {
          soldAt: true,
          grandTotal: true,
        },
        orderBy: { soldAt: 'asc' },
      }),
      this.prisma.receivable.aggregate({
        where: {
          organizationId: user.organizationId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.sale.groupBy({
        by: ['createdByMembershipId'],
        where: {
          organizationId: user.organizationId,
          status: SaleStatus.COMPLETED,
          soldAt: { gte: startOfMonth },
          createdByMembershipId: { not: null },
        },
        _sum: { grandTotal: true },
        _count: true,
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
    ]);

    const membershipIds = topSellers
      .map((entry) => entry.createdByMembershipId)
      .filter((value): value is string => Boolean(value));

    const memberships = membershipIds.length
      ? await this.prisma.membership.findMany({
          where: { id: { in: membershipIds } },
          include: { user: true },
        })
      : [];

    const chartMap = new Map<string, number>();
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      chartMap.set(date.toISOString().slice(0, 10), 0);
    }

    recentSales.forEach((sale) => {
      const key = sale.soldAt.toISOString().slice(0, 10);
      chartMap.set(key, (chartMap.get(key) ?? 0) + toAmount(sale.grandTotal));
    });

    return {
      kpis: {
        ventasHoy: {
          total: toAmount(todaySales._sum.grandTotal),
          transacciones: todaySales._count,
        },
        ingresosMes: {
          total: toAmount(monthSales._sum.grandTotal),
          cobrados: toAmount(monthSales._sum.paidTotal),
          transacciones: monthSales._count,
        },
        alertasInventario: lowStockRows.filter(
          (row) => toAmount(row.availableQty) <= toAmount(row.product.minStock),
        ).length,
        cuentasPorCobrar: toAmount(receivables._sum.outstandingAmount),
      },
      ventasSerie: Array.from(chartMap.entries()).map(([fecha, total]) => ({
        fecha,
        total,
      })),
      stockCritico: lowStockRows
        .filter(
          (row) => toAmount(row.availableQty) <= toAmount(row.product.minStock),
        )
        .map((row) => ({
          id: row.product.id,
          producto: row.product.name,
          disponible: toAmount(row.availableQty),
          minimo: toAmount(row.product.minStock),
          sucursal: row.warehouse.branch.name,
        })),
      rendimientoEquipo: topSellers.map((entry) => {
        const membership = memberships.find(
          (candidate) => candidate.id === entry.createdByMembershipId,
        );

        return {
          miembroId: entry.createdByMembershipId,
          nombre: membership?.user
            ? `${membership.user.firstName} ${membership.user.lastName}`
            : 'Operador',
          transacciones: entry._count,
          total: toAmount(entry._sum.grandTotal),
        };
      }),
    };
  }
}
