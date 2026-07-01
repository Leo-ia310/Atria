import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import {
  CreateCustomerDto,
  CreateQuotationDto,
  SalesQueryDto,
  UpdateCustomerDto,
  VoidSaleDto,
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

  async findOne(user: JwtUser, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        customer: true,
        branch: true,
        warehouse: true,
        items: { include: { product: true } },
        payments: true,
        receivable: true,
      },
    });
    if (!sale) {
      throw new NotFoundException('No encontramos esa venta.');
    }

    const createdByMembership = sale.createdByMembershipId
      ? await this.prisma.membership.findUnique({
          where: { id: sale.createdByMembershipId },
          include: { user: true },
        })
      : null;

    const journal = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId: user.organizationId,
        sourceType: 'sale',
        sourceId: sale.id,
      },
      include: { lines: { include: { account: true } } },
    });

    return { sale: { ...sale, createdByMembership }, journal };
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

  async updateCustomer(user: JwtUser, id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Cliente no encontrado.');
    return this.prisma.customer.update({
      where: { id },
      data: {
        fullName: dto.fullName ?? undefined,
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        documentId: dto.documentId ?? undefined,
      },
    });
  }

  async deleteCustomer(user: JwtUser, id: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Cliente no encontrado.');
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true, id };
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

  async deleteQuotation(user: JwtUser, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada.');
    await this.prisma.quotation.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Anula una venta: la marca como VOID, revierte el stock y crea un asiento
   * contable reverso. Se registra la razón en el AuditLog vía interceptor.
   */
  async voidSale(user: JwtUser, id: string, dto: VoidSaleDto) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada.');
    if (sale.status === 'VOID') {
      throw new NotFoundException('La venta ya está anulada.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar venta como VOID
      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: 'VOID',
          note: dto.reason
            ? `${sale.note ?? ''} [Anulada: ${dto.reason}]`.trim()
            : sale.note,
        },
      });

      // 2. Devolver stock al warehouse
      for (const item of sale.items) {
        await tx.productInventory.updateMany({
          where: { productId: item.productId, warehouseId: sale.warehouseId },
          data: { availableQty: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            productId: item.productId,
            warehouseId: sale.warehouseId,
            branchId: sale.branchId,
            actorMembershipId: user.membershipId,
            type: 'RETURN_IN',
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: 'sale_void',
            referenceId: sale.id,
            note: `Anulación venta ${sale.number}`,
          },
        });
      }

      // 3. Asiento contable reverso (si existe el original)
      const originalEntry = await tx.journalEntry.findFirst({
        where: {
          organizationId: user.organizationId,
          sourceType: 'sale',
          sourceId: sale.id,
        },
        include: { lines: true },
      });
      if (originalEntry) {
        const count = await tx.journalEntry.count({
          where: { organizationId: user.organizationId },
        });
        await tx.journalEntry.create({
          data: {
            organizationId: user.organizationId,
            branchId: originalEntry.branchId,
            number: `AS-${String(count + 1).padStart(6, '0')}`,
            memo: `Anulación venta ${sale.number}${dto.reason ? ' — ' + dto.reason : ''}`,
            sourceType: 'sale_void',
            sourceId: sale.id,
            entryDate: new Date(),
            status: 'POSTED',
            createdByMembershipId: user.membershipId,
            lines: {
              create: originalEntry.lines.map((l) => ({
                accountId: l.accountId,
                description: `Reverso: ${l.description ?? ''}`,
                debit: l.credit,
                credit: l.debit,
              })),
            },
          },
        });
        await tx.journalEntry.update({
          where: { id: originalEntry.id },
          data: { status: 'REVERSED' },
        });
      }

      return { voided: true, sale: updated, reason: dto.reason };
    });
  }
}
