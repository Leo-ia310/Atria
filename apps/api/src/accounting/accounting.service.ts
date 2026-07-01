import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import {
  CreateJournalEntryDto,
  JournalEntriesQueryDto,
  VoidJournalEntryDto,
} from './dto/accounting.dto';

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

  async trialBalance(user: JwtUser) {
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { organizationId: user.organizationId, status: 'POSTED' },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const porCuenta = new Map<
      string,
      { code: string; name: string; type: string; debit: number; credit: number }
    >();

    for (const line of lines) {
      const acc = line.account;
      const actual = porCuenta.get(acc.id) ?? {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: 0,
        credit: 0,
      };
      actual.debit += toNumber(line.debit);
      actual.credit += toNumber(line.credit);
      porCuenta.set(acc.id, actual);
    }

    const deudoras = new Set(['ASSET', 'EXPENSE', 'COST_OF_SALES']);
    const cuentas = Array.from(porCuenta.values())
      .map((c) => ({
        ...c,
        balance: deudoras.has(c.type) ? c.debit - c.credit : c.credit - c.debit,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const porTipo = (tipos: string[]) =>
      cuentas
        .filter((c) => tipos.includes(c.type))
        .map((c) => ({ code: c.code, name: c.name, balance: c.balance }));

    const totalDebit = cuentas.reduce((acc, c) => acc + c.debit, 0);
    const totalCredit = cuentas.reduce((acc, c) => acc + c.credit, 0);

    return {
      activos: porTipo(['ASSET']),
      pasivos: porTipo(['LIABILITY']),
      patrimonio: porTipo(['EQUITY']),
      ingresos: porTipo(['REVENUE']),
      gastos: porTipo(['EXPENSE', 'COST_OF_SALES']),
      totalDebit,
      totalCredit,
      balanceado: Math.abs(totalDebit - totalCredit) < 0.01,
    };
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

  /**
   * Anula un asiento contable: lo marca como REVERSED y crea un asiento
   * contrario con las mismas líneas invertidas. No permite anular un asiento
   * ya reversado, ni tocar directamente asientos con sourceType != 'manual'
   * (para esos, usar la operación semántica: voidSale, voidPurchase, etc.).
   */
  async voidEntry(user: JwtUser, id: string, dto: VoidJournalEntryDto) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundException('Asiento no encontrado.');
    if (entry.status === 'REVERSED') {
      throw new BadRequestException('El asiento ya fue reversado.');
    }
    if (entry.sourceType && entry.sourceType !== 'manual') {
      throw new BadRequestException(
        `Este asiento es automático (origen: ${entry.sourceType}). Usa el endpoint específico para anular la operación de origen.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.journalEntry.count({
        where: { organizationId: user.organizationId },
      });
      const reverso = await tx.journalEntry.create({
        data: {
          organizationId: user.organizationId,
          branchId: entry.branchId,
          number: `AS-${String(count + 1).padStart(6, '0')}`,
          memo: `Reverso: ${entry.memo}${dto.reason ? ' — ' + dto.reason : ''}`,
          sourceType: 'reversal',
          sourceId: entry.id,
          entryDate: new Date(),
          status: 'POSTED',
          createdByMembershipId: user.membershipId,
          lines: {
            create: entry.lines.map((l) => ({
              accountId: l.accountId,
              description: `Reverso: ${l.description ?? ''}`,
              debit: l.credit,
              credit: l.debit,
            })),
          },
        },
      });
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: 'REVERSED' },
      });
      return { reversed: true, reverso, reason: dto.reason };
    });
  }
}
