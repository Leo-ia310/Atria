import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import {
  CreateProductDto,
  InventoryQueryDto,
  UpdateProductDto,
} from './dto/inventory.dto';

const decimal = (value: number) => new Prisma.Decimal(value);
const numberValue = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async products(user: JwtUser, query: InventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      organizationId: user.organizationId,
      deletedAt: null,
      categoryId: query.categoryId,
      supplierId: query.supplierId,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
            { barcode: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
      inventory:
        query.warehouseId || query.branchId
          ? {
              some: {
                warehouseId: query.warehouseId,
                warehouse: query.branchId
                  ? { branchId: query.branchId }
                  : undefined,
              },
            }
          : undefined,
    };

    const include = {
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
    } satisfies Prisma.ProductInclude;

    if (query.stockLevel) {
      const candidates = await this.prisma.product.findMany({
        where,
        include,
        orderBy: { name: 'asc' },
        take: 500,
      });

      const filtered = candidates.filter((product) => {
        const disponible = product.inventory.reduce(
          (acc, row) => acc + numberValue(row.availableQty),
          0,
        );
        return query.stockLevel === 'OUT'
          ? disponible <= 0
          : disponible <= numberValue(product.minStock);
      });

      const skip = (page - 1) * pageSize;
      return {
        data: filtered.slice(skip, skip + pageSize),
        meta: { page, pageSize, total: filtered.length },
      };
    }

    const skip = (page - 1) * pageSize;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { page, pageSize, total },
    };
  }

  async filters(user: JwtUser) {
    const [categories, suppliers, warehouses] = await Promise.all([
      this.prisma.category.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true, branch: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { categories, suppliers, warehouses };
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

  async productDetail(user: JwtUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: {
        category: true,
        brand: true,
        supplier: true,
        taxRate: true,
        inventory: { include: { warehouse: { include: { branch: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado.');
    return product;
  }

  async updateProduct(user: JwtUser, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Producto no encontrado.');

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        barcode: dto.barcode ?? undefined,
        unit: dto.unit ?? undefined,
        salePrice:
          dto.salePrice !== undefined ? decimal(dto.salePrice) : undefined,
        costPrice:
          dto.costPrice !== undefined ? decimal(dto.costPrice) : undefined,
        minStock:
          dto.minStock !== undefined ? decimal(dto.minStock) : undefined,
        isActive: dto.isActive ?? undefined,
        isTrackSerial: dto.isTrackSerial ?? undefined,
        isTrackExpiration: dto.isTrackExpiration ?? undefined,
      },
    });
  }

  async deleteProduct(user: JwtUser, id: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Producto no encontrado.');

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { deleted: true, id };
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

  async movements(user: JwtUser, productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: { organizationId: user.organizationId, productId },
      include: {
        product: true,
        warehouse: { include: { branch: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: productId ? 10 : 50,
    });
  }
}
