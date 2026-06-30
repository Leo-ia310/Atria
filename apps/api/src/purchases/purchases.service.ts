import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ACCOUNT_KEYS } from '@atria/contracts';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  PurchasesQueryDto,
} from './dto/purchases.dto';

const decimal = (value: number) => new Prisma.Decimal(value);
const toNumber = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser, query: PurchasesQueryDto) {
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId: user.organizationId,
        type: 'PURCHASE',
      },
      include: {
        product: true,
        warehouse: { include: { branch: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize * 4,
    });

    type Compra = {
      referenceId: string;
      createdAt: Date;
      supplierName: string | null;
      branchName: string;
      itemCount: number;
      total: number;
      note: string | null;
    };
    const compras = new Map<string, Compra>();
    for (const m of movements) {
      const refId = m.referenceId;
      const existing = compras.get(refId) ?? {
        referenceId: refId,
        createdAt: m.createdAt,
        supplierName: null,
        branchName: m.warehouse.branch.name,
        itemCount: 0,
        total: 0,
        note: m.note,
      };
      existing.itemCount += 1;
      existing.total += toNumber(m.quantity) * toNumber(m.unitCost);
      compras.set(refId, existing);
    }

    const arr = Array.from(compras.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const total = arr.length;
    const page = query.page ?? 1;
    const start = (page - 1) * pageSize;
    const data = arr.slice(start, start + pageSize);

    return { data, meta: { page, pageSize, total } };
  }

  async findOne(user: JwtUser, referenceId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId: user.organizationId,
        type: 'PURCHASE',
        referenceId,
      },
      include: {
        product: true,
        warehouse: { include: { branch: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (movements.length === 0) {
      throw new NotFoundException('No encontramos esa compra.');
    }
    const journal = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId: user.organizationId,
        sourceType: 'purchase',
        sourceId: referenceId,
      },
      include: { lines: { include: { account: true } } },
    });
    return { movements, journal };
  }

  async create(user: JwtUser, dto: CreatePurchaseDto) {
    if (dto.items.length === 0) {
      throw new BadRequestException('La compra debe tener al menos un producto.');
    }
    if (dto.paymentTerms === 'CREDIT' && !dto.dueDate) {
      throw new BadRequestException('Compras al crédito requieren fecha de vencimiento.');
    }

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, organizationId: user.organizationId },
      });
      if (!supplier) throw new NotFoundException('Proveedor no encontrado.');

      const warehouse =
        (dto.warehouseId
          ? await tx.warehouse.findFirst({
              where: { id: dto.warehouseId, organizationId: user.organizationId },
            })
          : null) ??
        (await tx.warehouse.findFirst({
          where: { organizationId: user.organizationId, isPrimary: true },
        }));
      if (!warehouse) throw new NotFoundException('No encontramos un almacén operativo.');

      const productIds = dto.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { organizationId: user.organizationId, id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      for (const item of dto.items) {
        if (!productMap.has(item.productId)) {
          throw new NotFoundException(`Producto ${item.productId} no encontrado.`);
        }
      }

      const referenceId = randomUUID();
      let subtotal = 0;
      let taxTotal = 0;

      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        const lineSubtotal = item.quantity * item.unitCost;
        const lineTax = item.taxAmount ?? 0;
        subtotal += lineSubtotal;
        taxTotal += lineTax;

        await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            productId: product.id,
            warehouseId: warehouse.id,
            branchId: warehouse.branchId,
            actorMembershipId: user.membershipId,
            type: 'PURCHASE',
            quantity: decimal(item.quantity),
            unitCost: decimal(item.unitCost),
            referenceType: 'purchase',
            referenceId,
            note: dto.supplierInvoiceNumber
              ? `Compra ${dto.supplierInvoiceNumber}`
              : `Compra del proveedor ${supplier.name}`,
          },
        });

        const existing = await tx.productInventory.findFirst({
          where: { productId: product.id, warehouseId: warehouse.id },
        });
        if (existing) {
          const stockAnterior = toNumber(existing.availableQty);
          const costoAnterior = toNumber(existing.averageCost);
          const nuevoCosto =
            stockAnterior + item.quantity <= 0
              ? item.unitCost
              : (stockAnterior * costoAnterior + item.quantity * item.unitCost) /
                (stockAnterior + item.quantity);
          await tx.productInventory.update({
            where: { id: existing.id },
            data: {
              availableQty: decimal(stockAnterior + item.quantity),
              averageCost: decimal(nuevoCosto),
            },
          });
        } else {
          await tx.productInventory.create({
            data: {
              organizationId: user.organizationId,
              productId: product.id,
              warehouseId: warehouse.id,
              availableQty: decimal(item.quantity),
              averageCost: decimal(item.unitCost),
            },
          });
        }

        await tx.product.update({
          where: { id: product.id },
          data: { costPrice: decimal(item.unitCost) },
        });
      }

      const grandTotal = subtotal + taxTotal;

      if (dto.paymentTerms === 'CREDIT') {
        await tx.payable.create({
          data: {
            organizationId: user.organizationId,
            supplierId: supplier.id,
            dueDate: new Date(dto.dueDate!),
            originalAmount: decimal(grandTotal),
            outstandingAmount: decimal(grandTotal),
            status: 'PENDING',
          },
        });
      }

      const accountCodes = [
        ACCOUNT_KEYS.INVENTORY,
        ACCOUNT_KEYS.VAT_RECEIVABLE,
        ACCOUNT_KEYS.AP_SUPPLIERS,
        ACCOUNT_KEYS.CASH,
      ];
      const accounts = await tx.account.findMany({
        where: {
          organizationId: user.organizationId,
          code: { in: accountCodes },
        },
      });
      const accountMap = new Map(accounts.map((a) => [a.code, a]));
      const inventoryAcc = accountMap.get(ACCOUNT_KEYS.INVENTORY);
      const vatAcc = accountMap.get(ACCOUNT_KEYS.VAT_RECEIVABLE);
      const apAcc = accountMap.get(ACCOUNT_KEYS.AP_SUPPLIERS);
      const cashAcc = accountMap.get(ACCOUNT_KEYS.CASH);

      if (!inventoryAcc || !apAcc || !cashAcc) {
        throw new BadRequestException(
          'Catálogo de cuentas incompleto. Vuelve a sembrar el plan contable.',
        );
      }

      const lines: Prisma.JournalEntryLineCreateWithoutJournalEntryInput[] = [
        {
          account: { connect: { id: inventoryAcc.id } },
          description: 'Entrada de inventario',
          debit: decimal(subtotal),
          credit: decimal(0),
        },
      ];
      if (taxTotal > 0 && vatAcc) {
        lines.push({
          account: { connect: { id: vatAcc.id } },
          description: 'IVA acreditable',
          debit: decimal(taxTotal),
          credit: decimal(0),
        });
      }
      lines.push({
        account: {
          connect: { id: (dto.paymentTerms === 'CREDIT' ? apAcc : cashAcc).id },
        },
        description:
          dto.paymentTerms === 'CREDIT'
            ? `Compra al crédito ${supplier.name}`
            : `Pago compra ${supplier.name}`,
        debit: decimal(0),
        credit: decimal(grandTotal),
      });

      const journalCount = await tx.journalEntry.count({
        where: { organizationId: user.organizationId },
      });

      await tx.journalEntry.create({
        data: {
          organizationId: user.organizationId,
          branchId: warehouse.branchId,
          number: `AS-${String(journalCount + 1).padStart(6, '0')}`,
          memo: dto.supplierInvoiceNumber
            ? `Compra ${supplier.name} ${dto.supplierInvoiceNumber}`
            : `Compra del proveedor ${supplier.name}`,
          sourceType: 'purchase',
          sourceId: referenceId,
          entryDate: new Date(),
          createdByMembershipId: user.membershipId,
          lines: { create: lines },
        },
      });

      return { referenceId, subtotal, taxTotal, grandTotal };
    });
  }

  async suppliers(user: JwtUser) {
    return this.prisma.supplier.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(user: JwtUser, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        taxIdentifier: dto.taxIdentifier,
        contactName: dto.contactName,
      },
    });
  }
}
