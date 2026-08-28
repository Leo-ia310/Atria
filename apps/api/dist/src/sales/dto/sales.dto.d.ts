import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
declare class QuotationItemDto {
    productId: string;
    quantity: number;
    unitPrice: number;
}
export declare class SalesQueryDto extends PaginationQueryDto {
    status?: string;
}
export declare class CreateCustomerDto {
    fullName: string;
    email?: string;
    phone?: string;
    documentId?: string;
}
export declare class UpdateCustomerDto {
    fullName?: string;
    email?: string;
    phone?: string;
    documentId?: string;
}
export declare class VoidSaleDto {
    reason?: string;
}
export declare class CreateQuotationDto {
    customerId?: string;
    validUntil?: string;
    items: QuotationItemDto[];
}
export {};
