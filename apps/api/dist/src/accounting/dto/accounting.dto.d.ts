import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class JournalEntriesQueryDto extends PaginationQueryDto {
    sourceType?: string;
    from?: string;
    to?: string;
    status?: 'DRAFT' | 'POSTED' | 'REVERSED';
}
declare class EntryLineDto {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
}
export declare class CreateJournalEntryDto {
    memo: string;
    entryDate: string;
    lines: EntryLineDto[];
}
export declare class VoidJournalEntryDto {
    reason?: string;
}
export {};
