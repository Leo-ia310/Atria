import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
declare class PurchaseItemDto {
    productId: string;
    quantity: number;
    unitCost: number;
    taxAmount?: number;
}
export declare class PurchasesQueryDto extends PaginationQueryDto {
    supplierId?: string;
}
export declare class CreatePurchaseDto {
    supplierId: string;
    warehouseId?: string;
    supplierInvoiceNumber?: string;
    paymentTerms: 'CASH' | 'CREDIT';
    dueDate?: string;
    note?: string;
    items: PurchaseItemDto[];
}
export declare class CreateSupplierDto {
    name: string;
    email?: string;
    phone?: string;
    taxIdentifier?: string;
    contactName?: string;
}
export declare class UpdateSupplierDto {
    name?: string;
    email?: string;
    phone?: string;
    taxIdentifier?: string;
    contactName?: string;
}
export {};
