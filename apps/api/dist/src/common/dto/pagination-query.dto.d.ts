export declare class PaginationQueryDto {
    page: number;
    pageSize: number;
    search?: string;
    order: 'asc' | 'desc';
    sortBy?: string;
}
