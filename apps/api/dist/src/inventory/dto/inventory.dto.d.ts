import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class InventoryQueryDto extends PaginationQueryDto {
    branchId?: string;
    categoryId?: string;
    supplierId?: string;
    warehouseId?: string;
    stockLevel?: 'LOW' | 'OUT';
}
export declare class CreateProductDto {
    name: string;
    sku: string;
    barcode?: string;
    categoryName?: string;
    brandName?: string;
    supplierName?: string;
    unit: string;
    salePrice: number;
    costPrice: number;
    minStock: number;
    branchId?: string;
    isTrackSerial?: boolean;
    isTrackExpiration?: boolean;
}
export declare class UpdateProductDto {
    name?: string;
    barcode?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    minStock?: number;
    isActive?: boolean;
    isTrackSerial?: boolean;
    isTrackExpiration?: boolean;
}
