import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { JwtUser } from '@/auth/auth.types';
import { AuditService } from '@/audit/audit.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/employees.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: JwtUser) {
    return this.prisma.employeeProfile.findMany({
      where: { organizationId: user.organizationId },
      include: {
        membership: {
          include: {
            user: true,
            role: true,
          },
        },
        branch: true,
      },
      orderBy: { hireDate: 'asc' },
    });
  }

  async create(user: JwtUser, dto: CreateEmployeeDto) {
    const role = await this.prisma.role.findFirst({
      where: {
        organizationId: user.organizationId,
        key: dto.roleKey,
      },
    });

    if (!role) {
      throw new NotFoundException('No encontramos el rol seleccionado.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const created = await this.prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.upsert({
        where: { email: dto.email.toLowerCase() },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
        },
        create: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
        },
      });

      const membership = await transaction.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: createdUser.id,
          },
        },
        update: {
          roleId: role.id,
          defaultBranchId: dto.branchId,
        },
        create: {
          organizationId: user.organizationId,
          userId: createdUser.id,
          roleId: role.id,
          defaultBranchId: dto.branchId,
        },
      });

      const employeeCount = await transaction.employeeProfile.count({
        where: { organizationId: user.organizationId },
      });

      const profile = await transaction.employeeProfile.upsert({
        where: { membershipId: membership.id },
        update: {
          branchId: dto.branchId,
          jobTitle: dto.jobTitle ?? 'Operación',
        },
        create: {
          organizationId: user.organizationId,
          membershipId: membership.id,
          branchId: dto.branchId,
          employeeCode: `EMP-${String(employeeCount + 1).padStart(3, '0')}`,
          jobTitle: dto.jobTitle ?? 'Operación',
          hireDate: new Date(),
        },
      });

      await transaction.subscription.update({
        where: { organizationId: user.organizationId },
        data: {
          seatsUsed: { increment: 1 },
        },
      });

      return profile;
    });

    await this.auditService.log({
      organizationId: user.organizationId,
      actorId: user.sub,
      module: 'employees',
      action: 'create',
      entityType: 'employee_profile',
      entityId: created.id,
    });

    return created;
  }

  async attendance(user: JwtUser) {
    return this.prisma.attendanceRecord.findMany({
      where: { organizationId: user.organizationId },
      include: {
        employeeProfile: {
          include: {
            membership: { include: { user: true } },
          },
        },
        branch: true,
      },
      orderBy: { checkInAt: 'desc' },
      take: 50,
    });
  }

  async activity(user: JwtUser) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
