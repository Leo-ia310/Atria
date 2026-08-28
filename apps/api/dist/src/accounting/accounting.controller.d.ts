import type { JwtUser } from "../auth/auth.types";
import { AccountingService } from './accounting.service';
import { CreateJournalEntryDto, JournalEntriesQueryDto, VoidJournalEntryDto } from './dto/accounting.dto';
export declare class AccountingController {
    private readonly accountingService;
    constructor(accountingService: AccountingService);
    summary(user: JwtUser): Promise<{
        cashFlow: number;
        cuentasPorCobrar: number;
        cuentasPorPagar: number;
        gastosAcumulados: number;
    }>;
    accounts(user: JwtUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        organizationId: string;
        code: string;
        parentId: string | null;
        type: import("@prisma/client").$Enums.AccountType;
        allowsPosting: boolean;
        level: number;
    }[]>;
    trialBalance(user: JwtUser): Promise<{
        activos: {
            code: string;
            name: string;
            balance: number;
        }[];
        pasivos: {
            code: string;
            name: string;
            balance: number;
        }[];
        patrimonio: {
            code: string;
            name: string;
            balance: number;
        }[];
        ingresos: {
            code: string;
            name: string;
            balance: number;
        }[];
        gastos: {
            code: string;
            name: string;
            balance: number;
        }[];
        totalDebit: number;
        totalCredit: number;
        balanceado: boolean;
    }>;
    entries(user: JwtUser, query: JournalEntriesQueryDto): Promise<{
        data: ({
            lines: ({
                account: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    organizationId: string;
                    code: string;
                    parentId: string | null;
                    type: import("@prisma/client").$Enums.AccountType;
                    allowsPosting: boolean;
                    level: number;
                };
            } & {
                id: string;
                description: string | null;
                accountId: string;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                journalEntryId: string;
            })[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            branchId: string | null;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdByMembershipId: string | null;
            sourceType: string;
            memo: string;
            entryDate: Date;
            sourceId: string | null;
        })[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
        };
    }>;
    createEntry(user: JwtUser, dto: CreateJournalEntryDto): Promise<{
        number: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        branchId: string | null;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdByMembershipId: string | null;
        sourceType: string;
        memo: string;
        entryDate: Date;
        sourceId: string | null;
    }>;
    voidEntry(user: JwtUser, id: string, dto: VoidJournalEntryDto): Promise<{
        reversed: boolean;
        reverso: {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            branchId: string | null;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdByMembershipId: string | null;
            sourceType: string;
            memo: string;
            entryDate: Date;
            sourceId: string | null;
        };
        reason: string | undefined;
    }>;
}
