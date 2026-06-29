import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import {
  CreateCustomerDto,
  CreateQuotationDto,
  SalesQueryDto,
} from './dto/sales.dto';

const money = (value: number) => new Prisma.Decimal(value);
const num = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(user: JwtUser, query: SalesQueryDto) {
    return this.prisma.sale.findMany({
      where: {
        organizationId: user.organizationId,
        status: query.status as never,
      },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { soldAt: 'desc' },
      take: query.pageSize ?? 30,
    });
  }

  async analytics(user: JwtUser) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [sales, customers] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          organizationId: user.organizationId,
          status: 'COMPLETED',
          soldAt: { gte: thirtyDaysAgo },
        },
        include: { customer: true },
      }),
      this.prisma.customer.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        include: { sales: true },
      }),
    ]);

    const revenue = sales.reduce((acc, sale) => acc + num(sale.grandTotal), 0);
    const averageTicket = sales.length ? revenue / sales.length : 0;

    const topCustomers = customers
      .map((customer) => ({
        id: customer.id,
        nombre: customer.fullName,
        total: customer.sales.reduce(
          (acc, sale) => acc + num(sale.grandTotal),
          0,
        ),
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);

    return {
      revenue,
      averageTicket,
      topCustomers,
      totalSales: sales.length,
    };
  }

  async customers(user: JwtUser) {
    return this.prisma.customer.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { fullName: 'asc' },
    });
  }

  async createCustomer(user: JwtUser, dto: CreateCustomerDto) {
    const count = await this.prisma.customer.count({
      where: { organizationId: user.organizationId },
    });

    return this.prisma.customer.create({
      data: {
        organizationId: user.organizationId,
        code: `CLI-${String(count + 1).padStart(5, '0')}`,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        documentId: dto.documentId,
      },
    });
  }

  async quotations(user: JwtUser) {
    return this.prisma.quotation.findMany({
      where: { organizationId: user.organizationId },
      include: {
        customer: true,
        branch: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuotation(user: JwtUser, dto: CreateQuotationDto) {
    const branch = await this.prisma.branch.findFirstOrThrow({
      where: {
        organizationId: user.organizationId,
        id: user.defaultBranchId ?? undefined,
      },
    });
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: dto.items.map((item) => item.productId) },
      },
      include: { taxRate: true },
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      const taxRate = num(product?.taxRate?.rate);
      const base = item.quantity * item.unitPrice;
      const tax = base * (taxRate / 100);

      return {
        ...item,
        tax,
        total: base + tax,
      };
    });
    const count = await this.prisma.quotation.count({
      where: { organizationId: user.organizationId },
    });

    return this.prisma.quotation.create({
      data: {
        organizationId: user.organizationId,
        branchId: branch.id,
        customerId: dto.customerId,
        number: `COT-${String(count + 1).padStart(6, '0')}`,
        subtotal: money(
          items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
        ),
        taxTotal: money(items.reduce((acc, item) => acc + item.tax, 0)),
        discountTotal: money(0),
        grandTotal: money(items.reduce((acc, item) => acc + item.total, 0)),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        createdByMembershipId: user.membershipId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: money(item.quantity),
            unitPrice: money(item.unitPrice),
            taxAmount: money(item.tax),
            discountAmount: money(0),
            lineTotal: money(item.total),
          })),
        },
      },
    });
  }
}
