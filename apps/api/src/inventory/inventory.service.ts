import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateProductDto, InventoryQueryDto } from './dto/inventory.dto';

const decimal = (value: number) => new Prisma.Decimal(value);
const numberValue = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async products(user: JwtUser, query: InventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const products = await this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        OR: query.search
          ? [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        category: true,
        brand: true,
        supplier: true,
        taxRate: true,
        inventory: {
          include: {
            warehouse: {
              include: { branch: true },
            },
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    const total = await this.prisma.product.count({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });

    return {
      data: products,
      meta: { page, pageSize, total },
    };
  }

  async createProduct(user: JwtUser, dto: CreateProductDto) {
    return this.prisma.$transaction(async (transaction) => {
      const taxRate = await transaction.taxRate.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          isDefault: true,
        },
      });

      const branch =
        (dto.branchId
          ? await transaction.branch.findFirst({
              where: {
                id: dto.branchId,
                organizationId: user.organizationId,
              },
            })
          : await transaction.branch.findFirst({
              where: {
                id: user.defaultBranchId ?? undefined,
                organizationId: user.organizationId,
              },
            })) ??
        (await transaction.branch.findFirst({
          where: {
            organizationId: user.organizationId,
            isPrimary: true,
          },
        }));

      if (!branch) {
        throw new NotFoundException('No encontramos una sucursal operativa.');
      }

      const warehouse = await transaction.warehouse.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          branchId: branch.id,
          isPrimary: true,
        },
      });

      const category = dto.categoryName
        ? await transaction.category.upsert({
            where: {
              organizationId_name: {
                organizationId: user.organizationId,
                name: dto.categoryName,
              },
            },
            update: {},
            create: {
              organizationId: user.organizationId,
              name: dto.categoryName,
            },
          })
        : null;

      const brand = dto.brandName
        ? await transaction.brand.upsert({
            where: {
              organizationId_name: {
                organizationId: user.organizationId,
                name: dto.brandName,
              },
            },
            update: {},
            create: {
              organizationId: user.organizationId,
              name: dto.brandName,
            },
          })
        : null;

      const supplier = dto.supplierName
        ? await transaction.supplier.create({
            data: {
              organizationId: user.organizationId,
              name: dto.supplierName,
            },
          })
        : null;

      const product = await transaction.product.create({
        data: {
          organizationId: user.organizationId,
          categoryId: category?.id,
          brandId: brand?.id,
          supplierId: supplier?.id,
          taxRateId: taxRate.id,
          sku: dto.sku.toUpperCase(),
          barcode: dto.barcode,
          name: dto.name,
          unit: dto.unit,
          salePrice: decimal(dto.salePrice),
          costPrice: decimal(dto.costPrice),
          minStock: decimal(dto.minStock),
          isTrackSerial: dto.isTrackSerial ?? false,
          isTrackExpiration: dto.isTrackExpiration ?? false,
        },
      });

      await transaction.productInventory.create({
        data: {
          organizationId: user.organizationId,
          productId: product.id,
          warehouseId: warehouse.id,
          availableQty: decimal(0),
          averageCost: decimal(dto.costPrice),
        },
      });

      return product;
    });
  }

  async alerts(user: JwtUser) {
    const [lowStock, expiring] = await Promise.all([
      this.prisma.productInventory.findMany({
        where: { organizationId: user.organizationId },
        include: {
          product: true,
          warehouse: { include: { branch: true } },
        },
      }),
      this.prisma.productBatch.findMany({
        where: {
          organizationId: user.organizationId,
          expiresAt: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          product: true,
          warehouse: { include: { branch: true } },
        },
      }),
    ]);

    return {
      stockBajo: lowStock
        .filter(
          (row) =>
            numberValue(row.availableQty) <= numberValue(row.product.minStock),
        )
        .map((row) => ({
          producto: row.product.name,
          disponible: numberValue(row.availableQty),
          minimo: numberValue(row.product.minStock),
          sucursal: row.warehouse.branch.name,
        })),
      proximosAVencer: expiring.map((row) => ({
        producto: row.product.name,
        lote: row.lotNumber,
        cantidad: numberValue(row.quantity),
        expira: row.expiresAt,
        sucursal: row.warehouse.branch.name,
      })),
    };
  }

  async movements(user: JwtUser) {
    return this.prisma.stockMovement.findMany({
      where: { organizationId: user.organizationId },
      include: {
        product: true,
        warehouse: { include: { branch: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
