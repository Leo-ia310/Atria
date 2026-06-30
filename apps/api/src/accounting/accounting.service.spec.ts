import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { AccountingService } from './accounting.service';

type PrismaMock = {
  journalEntry: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

const buildPrismaMock = (): PrismaMock => ({
  journalEntry: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

const buildUser = (): JwtUser =>
  ({
    sub: 'user-1',
    organizationId: 'org-1',
    membershipId: 'mem-1',
    roleKey: 'admin',
    permissions: ['accounting:manage'],
    defaultBranchId: 'branch-1',
  }) as unknown as JwtUser;

describe('AccountingService.createEntry', () => {
  let service: AccountingService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AccountingService);
  });

  it('rechaza un asiento desbalanceado', async () => {
    const user = buildUser();
    await expect(
      service.createEntry(user, {
        memo: 'Desbalance',
        entryDate: '2026-06-30',
        lines: [
          { accountId: 'a1', description: 'd', debit: 100, credit: 0 },
          { accountId: 'a2', description: 'c', debit: 0, credit: 50 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('acepta un asiento balanceado y genera número correlativo', async () => {
    const user = buildUser();
    prisma.journalEntry.count.mockResolvedValue(41);
    prisma.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      number: 'AS-000042',
    });

    const result = await service.createEntry(user, {
      memo: 'Venta manual',
      entryDate: '2026-06-30',
      lines: [
        { accountId: 'a-cash', description: 'Cobro', debit: 200, credit: 0 },
        { accountId: 'a-rev', description: 'Ingreso', debit: 0, credit: 200 },
      ],
    });

    expect(result.number).toBe('AS-000042');
    expect(prisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          number: 'AS-000042',
          sourceType: 'manual',
          memo: 'Venta manual',
          createdByMembershipId: 'mem-1',
        }),
      }),
    );
  });

  it('admite asientos con varias líneas siempre que el total cuadre', async () => {
    const user = buildUser();
    prisma.journalEntry.count.mockResolvedValue(0);
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-2', number: 'AS-000001' });

    await expect(
      service.createEntry(user, {
        memo: 'Compra mixta',
        entryDate: '2026-06-30',
        lines: [
          { accountId: 'a-inv', description: 'Inv', debit: 80, credit: 0 },
          { accountId: 'a-vat', description: 'IVA', debit: 20, credit: 0 },
          { accountId: 'a-ap', description: 'CxP', debit: 0, credit: 100 },
        ],
      }),
    ).resolves.toBeDefined();
  });

  it('rechaza por diferencias mayores a la tolerancia 0.001', async () => {
    const user = buildUser();
    await expect(
      service.createEntry(user, {
        memo: 'Diferencia',
        entryDate: '2026-06-30',
        lines: [
          { accountId: 'a1', description: 'd', debit: 100.005, credit: 0 },
          { accountId: 'a2', description: 'c', debit: 0, credit: 100 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
