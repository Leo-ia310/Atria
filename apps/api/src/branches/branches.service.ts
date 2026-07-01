import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

const amount = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser) {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: {
        warehouses: true,
        _count: { select: { memberships: true, sales: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });

    return branches;
  }

  async analytics(user: JwtUser) {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: {
        sales: {
          where: { status: 'COMPLETED' },
          select: { grandTotal: true },
        },
        warehouses: {
          include: {
            inventory: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      ventas: branch.sales.reduce(
        (acc, sale) => acc + amount(sale.grandTotal),
        0,
      ),
      valorInventario: branch.warehouses
        .flatMap((warehouse) => warehouse.inventory)
        .reduce(
          (acc, row) =>
            acc + amount(row.availableQty) * amount(row.product.costPrice),
          0,
        ),
      bodegas: branch.warehouses.length,
    }));
  }

  async create(user: JwtUser, dto: CreateBranchDto) {
    return this.prisma.$transaction(async (transaction) => {
      const branch = await transaction.branch.create({
        data: {
          organizationId: user.organizationId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          addressLine1: dto.addressLine1,
          city: dto.city,
          countryCode: dto.countryCode.toUpperCase(),
        },
      });

      const warehouse = await transaction.warehouse.create({
        data: {
          organizationId: user.organizationId,
          branchId: branch.id,
          code: `BOD-${dto.code.toUpperCase()}`,
          name: dto.warehouseName,
          isPrimary: true,
        },
      });

      await transaction.subscription.update({
        where: { organizationId: user.organizationId },
        data: { branchesUsed: { increment: 1 } },
      });

      return { branch, warehouse };
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateBranchDto) {
    const existing = await this.prisma.branch.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Sucursal no encontrada.');
    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        addressLine1: dto.addressLine1 ?? undefined,
        city: dto.city ?? undefined,
        countryCode: dto.countryCode?.toUpperCase() ?? undefined,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    const existing = await this.prisma.branch.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: { _count: { select: { sales: true, memberships: true } } },
    });
    if (!existing) throw new NotFoundException('Sucursal no encontrada.');
    if (existing.isPrimary) {
      throw new BadRequestException(
        'No puedes eliminar la sucursal principal.',
      );
    }
    if (existing._count.sales > 0) {
      throw new BadRequestException(
        `Esta sucursal tiene ${existing._count.sales} ventas registradas. Anúlalas antes de eliminar.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.branch.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.subscription.update({
        where: { organizationId: user.organizationId },
        data: { branchesUsed: { decrement: 1 } },
      });
      return { deleted: true, id };
    });
  }
}
