import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
declare class PosItemDto {
    productId: string;
    quantity: number;
    discount?: number;
}
declare class PosPaymentDto {
    method: string;
    amount: number;
    reference?: string;
}
export declare class PosCatalogQueryDto extends PaginationQueryDto {
    categoryId?: string;
}
export declare class PosCashCloseQueryDto {
    date?: string;
    branchId?: string;
}
export declare class PosReceiptsQueryDto {
    from?: string;
    to?: string;
    method?: string;
    status?: string;
    search?: string;
    branchId?: string;
}
export declare class PosCheckoutDto {
    branchId?: string;
    customerId?: string;
    items: PosItemDto[];
    payments: PosPaymentDto[];
    amountReceived?: number;
    note?: string;
}
export {};
