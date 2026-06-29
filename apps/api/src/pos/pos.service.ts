import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentMethod, Prisma, SaleStatus, SaleType } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { PosCatalogQueryDto, PosCheckoutDto } from './dto/pos.dto';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const toNumber = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async catalog(user: JwtUser, query: PosCatalogQueryDto) {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        deletedAt: null,
        categoryId: query.categoryId,
        OR: query.search
          ? [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        inventory: true,
        taxRate: true,
        category: true,
      },
      take: query.pageSize ?? 40,
      orderBy: [{ name: 'asc' }],
    });

    return products.map((product) => ({
      ...product,
      stockDisponible: product.inventory.reduce(
        (acc, row) => acc + toNumber(row.availableQty),
        0,
      ),
    }));
  }

  async suspended(user: JwtUser) {
    return this.prisma.sale.findMany({
      where: {
        organizationId: user.organizationId,
        status: SaleStatus.SUSPENDED,
      },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkout(user: JwtUser, dto: PosCheckoutDto) {
    if (dto.items.length === 0) {
      throw new BadRequestException('El carrito no puede estar vacío.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const branch =
        (dto.branchId
          ? await transaction.branch.findFirst({
              where: { id: dto.branchId, organizationId: user.organizationId },
            })
          : await transaction.branch.findFirst({
              where: {
                id: user.defaultBranchId ?? undefined,
                organizationId: user.organizationId,
              },
            })) ??
        (await transaction.branch.findFirst({
          where: { organizationId: user.organizationId, isPrimary: true },
        }));

      if (!branch) {
        throw new NotFoundException('No encontramos la sucursal seleccionada.');
      }

      const warehouse = await transaction.warehouse.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          branchId: branch.id,
          isPrimary: true,
        },
      });

      const products = await transaction.product.findMany({
        where: {
          organizationId: user.organizationId,
          id: { in: dto.items.map((item) => item.productId) },
        },
        include: {
          taxRate: true,
          inventory: {
            where: { warehouseId: warehouse.id },
          },
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      const items = dto.items.map((item) => {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado.`,
          );
        }

        const inventory = product.inventory[0];
        const quantity = item.quantity;

        if (!inventory || toNumber(inventory.availableQty) < quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}.`,
          );
        }

        const base = toNumber(product.salePrice) * quantity;
        const discount = item.discount ?? 0;
        const taxable = base - discount;
        const taxRate = toNumber(product.taxRate?.rate);
        const tax = taxable * (taxRate / 100);
        const total = taxable + tax;

        return {
          product,
          inventory,
          quantity,
          discount,
          tax,
          total,
        };
      });

      const subtotal = items.reduce(
        (acc, item) => acc + toNumber(item.product.salePrice) * item.quantity,
        0,
      );
      const discountTotal = items.reduce((acc, item) => acc + item.discount, 0);
      const taxTotal = items.reduce((acc, item) => acc + item.tax, 0);
      const grandTotal = items.reduce((acc, item) => acc + item.total, 0);
      const paidTotal = dto.payments.reduce(
        (acc, payment) => acc + payment.amount,
        0,
      );
      const saleCount = await transaction.sale.count({
        where: { organizationId: user.organizationId },
      });
      const saleNumber = `POS-${String(saleCount + 1).padStart(6, '0')}`;

      const sale = await transaction.sale.create({
        data: {
          organizationId: user.organizationId,
          branchId: branch.id,
          warehouseId: warehouse.id,
          customerId: dto.customerId,
          number: saleNumber,
          type: SaleType.POS,
          status:
            paidTotal >= grandTotal
              ? SaleStatus.COMPLETED
              : SaleStatus.SUSPENDED,
          subtotal: toDecimal(subtotal),
          taxTotal: toDecimal(taxTotal),
          discountTotal: toDecimal(discountTotal),
          paidTotal: toDecimal(paidTotal),
          grandTotal: toDecimal(grandTotal),
          note: dto.note,
          createdByMembershipId: user.membershipId,
          items: {
            create: items.map((item) => ({
              productId: item.product.id,
              quantity: toDecimal(item.quantity),
              unitPrice: item.product.salePrice,
              unitCost: item.product.costPrice,
              taxAmount: toDecimal(item.tax),
              discountAmount: toDecimal(item.discount),
              lineTotal: toDecimal(item.total),
            })),
          },
        },
        include: { items: true },
      });

      if (sale.status === SaleStatus.COMPLETED) {
        for (const payment of dto.payments) {
          await transaction.payment.create({
            data: {
              organizationId: user.organizationId,
              saleId: sale.id,
              branchId: branch.id,
              method: payment.method as PaymentMethod,
              amount: toDecimal(payment.amount),
              reference: payment.reference,
            },
          });
        }

        for (const item of items) {
          await transaction.productInventory.update({
            where: {
              warehouseId_productId: {
                warehouseId: warehouse.id,
                productId: item.product.id,
              },
            },
            data: {
              availableQty: {
                decrement: toDecimal(item.quantity),
              },
            },
          });

          await transaction.stockMovement.create({
            data: {
              organizationId: user.organizationId,
              productId: item.product.id,
              warehouseId: warehouse.id,
              branchId: branch.id,
              actorMembershipId: user.membershipId,
              type: 'SALE',
              quantity: toDecimal(item.quantity),
              unitCost: item.product.costPrice,
              referenceType: 'sale',
              referenceId: sale.id,
              note: `Salida por venta ${sale.number}`,
            },
          });
        }

        if (paidTotal < grandTotal && dto.customerId) {
          await transaction.receivable.create({
            data: {
              organizationId: user.organizationId,
              customerId: dto.customerId,
              saleId: sale.id,
              dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
              originalAmount: toDecimal(grandTotal),
              outstandingAmount: toDecimal(grandTotal - paidTotal),
              status: 'PARTIAL',
            },
          });
        }

        const accounts = await transaction.account.findMany({
          where: {
            organizationId: user.organizationId,
            code: { in: ['1101', '1301', '4101', '5101', '1201'] },
          },
        });

        const accountMap = new Map(
          accounts.map((account) => [account.code, account]),
        );
        const receivableAmount = Math.max(grandTotal - paidTotal, 0);
        const cogs = items.reduce(
          (acc, item) => acc + toNumber(item.product.costPrice) * item.quantity,
          0,
        );
        const journalCount = await transaction.journalEntry.count({
          where: { organizationId: user.organizationId },
        });

        await transaction.journalEntry.create({
          data: {
            organizationId: user.organizationId,
            branchId: branch.id,
            number: `AS-${String(journalCount + 1).padStart(6, '0')}`,
            memo: `Venta POS ${sale.number}`,
            sourceType: 'sale',
            sourceId: sale.id,
            entryDate: new Date(),
            createdByMembershipId: user.membershipId,
            lines: {
              create: [
                {
                  accountId: (paidTotal > 0
                    ? accountMap.get('1101')?.id
                    : accountMap.get('1201')?.id)!,
                  description: 'Cobro venta',
                  debit: toDecimal(paidTotal > 0 ? paidTotal : grandTotal),
                  credit: toDecimal(0),
                },
                ...(receivableAmount > 0 && accountMap.get('1201')
                  ? [
                      {
                        accountId: accountMap.get('1201')!.id,
                        description: 'Saldo pendiente',
                        debit: toDecimal(receivableAmount),
                        credit: toDecimal(0),
                      },
                    ]
                  : []),
                {
                  accountId: accountMap.get('4101')!.id,
                  description: 'Ingreso por venta',
                  debit: toDecimal(0),
                  credit: toDecimal(grandTotal),
                },
                {
                  accountId: accountMap.get('5101')!.id,
                  description: 'Costo de venta',
                  debit: toDecimal(cogs),
                  credit: toDecimal(0),
                },
                {
                  accountId: accountMap.get('1301')!.id,
                  description: 'Salida de inventario',
                  debit: toDecimal(0),
                  credit: toDecimal(cogs),
                },
              ],
            },
          },
        });

        this.eventEmitter.emit('sales.completed', {
          organizationId: user.organizationId,
          saleId: sale.id,
          total: grandTotal,
        });
      }

      return {
        sale,
        totals: {
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          paidTotal,
        },
      };
    });
  }
}
