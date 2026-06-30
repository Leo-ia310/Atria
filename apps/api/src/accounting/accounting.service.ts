import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateJournalEntryDto, JournalEntriesQueryDto } from './dto/accounting.dto';

const currency = (value: number) => new Prisma.Decimal(value);
const toNumber = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: JwtUser) {
    const [receivables, payables, expenses, payments] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: {
          organizationId: user.organizationId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.payable.aggregate({
        where: {
          organizationId: user.organizationId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId: user.organizationId },
        _sum: { total: true },
      }),
      this.prisma.payment.aggregate({
        where: { organizationId: user.organizationId },
        _sum: { amount: true },
      }),
    ]);

    return {
      cashFlow: toNumber(payments._sum.amount) - toNumber(expenses._sum.total),
      cuentasPorCobrar: toNumber(receivables._sum.outstandingAmount),
      cuentasPorPagar: toNumber(payables._sum.outstandingAmount),
      gastosAcumulados: toNumber(expenses._sum.total),
    };
  }

  async accounts(user: JwtUser) {
    return this.prisma.account.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async entries(user: JwtUser, query: JournalEntriesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.JournalEntryWhereInput = {
      organizationId: user.organizationId,
      ...(query.sourceType && { sourceType: query.sourceType }),
      ...(query.status && { status: query.status as never }),
      ...(query.from || query.to
        ? {
            entryDate: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { memo: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: { lines: { include: { account: true } } },
        orderBy: { entryDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total } };
  }

  async createEntry(user: JwtUser, dto: CreateJournalEntryDto) {
    const debitTotal = dto.lines.reduce((acc, line) => acc + line.debit, 0);
    const creditTotal = dto.lines.reduce((acc, line) => acc + line.credit, 0);

    if (Math.abs(debitTotal - creditTotal) > 0.001) {
      throw new BadRequestException(
        'La partida contable debe estar balanceada.',
      );
    }

    const count = await this.prisma.journalEntry.count({
      where: { organizationId: user.organizationId },
    });

    return this.prisma.journalEntry.create({
      data: {
        organizationId: user.organizationId,
        branchId: user.defaultBranchId,
        number: `AS-${String(count + 1).padStart(6, '0')}`,
        memo: dto.memo,
        sourceType: 'manual',
        entryDate: new Date(dto.entryDate),
        createdByMembershipId: user.membershipId,
        lines: {
          create: dto.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            debit: currency(line.debit),
            credit: currency(line.credit),
          })),
        },
      },
    });
  }
}
