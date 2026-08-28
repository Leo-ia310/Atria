export interface SaleJournalInput {
    grandTotal: number;
    taxTotal: number;
    paidTotal: number;
    cogs: number;
    cuentaId: (code: string) => string;
}
export interface JournalLineDraft {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
}
export declare function construirLineasAsientoVenta(input: SaleJournalInput): JournalLineDraft[];
