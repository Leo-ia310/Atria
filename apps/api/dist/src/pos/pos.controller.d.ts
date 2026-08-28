import type { JwtUser } from "../auth/auth.types";
import { PosCashCloseQueryDto, PosCatalogQueryDto, PosCheckoutDto, PosReceiptsQueryDto } from './dto/pos.dto';
import { PosService } from './pos.service';
export declare class PosController {
    private readonly posService;
    constructor(posService: PosService);
    catalog(user: JwtUser, query: PosCatalogQueryDto): Promise<{
        stockDisponible: number;
        inventory: {
            id: string;
            updatedAt: Date;
            organizationId: string;
            warehouseId: string;
            productId: string;
            averageCost: import("@prisma/client/runtime/library").Decimal;
            availableQty: import("@prisma/client/runtime/library").Decimal;
            reservedQty: import("@prisma/client/runtime/library").Decimal;
        }[];
        taxRate: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            code: string;
            rate: import("@prisma/client/runtime/library").Decimal;
            scope: import("@prisma/client").$Enums.TaxScope;
            isDefault: boolean;
        } | null;
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            description: string | null;
        } | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        organizationId: string;
        isActive: boolean;
        description: string | null;
        categoryId: string | null;
        brandId: string | null;
        supplierId: string | null;
        taxRateId: string | null;
        sku: string;
        barcode: string | null;
        unit: string;
        salePrice: import("@prisma/client/runtime/library").Decimal;
        costPrice: import("@prisma/client/runtime/library").Decimal;
        minStock: import("@prisma/client/runtime/library").Decimal;
        isTrackSerial: boolean;
        isTrackExpiration: boolean;
    }[]>;
    suspended(user: JwtUser): Promise<({
        customer: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            organizationId: string;
            code: string;
            phone: string | null;
            email: string | null;
            fullName: string;
            documentId: string | null;
            creditLimit: import("@prisma/client/runtime/library").Decimal;
            balance: import("@prisma/client/runtime/library").Decimal;
        } | null;
        items: {
            id: string;
            productId: string;
            quantity: import("@prisma/client/runtime/library").Decimal;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            discountAmount: import("@prisma/client/runtime/library").Decimal;
            lineTotal: import("@prisma/client/runtime/library").Decimal;
            saleId: string;
            unitCost: import("@prisma/client/runtime/library").Decimal;
        }[];
    } & {
        number: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        branchId: string;
        status: import("@prisma/client").$Enums.SaleStatus;
        type: import("@prisma/client").$Enums.SaleType;
        warehouseId: string;
        customerId: string | null;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        taxTotal: import("@prisma/client/runtime/library").Decimal;
        discountTotal: import("@prisma/client/runtime/library").Decimal;
        grandTotal: import("@prisma/client/runtime/library").Decimal;
        createdByMembershipId: string | null;
        paidTotal: import("@prisma/client/runtime/library").Decimal;
        note: string | null;
        soldAt: Date;
        returnedFromSaleId: string | null;
    })[]>;
    receipts(user: JwtUser, query: PosReceiptsQueryDto): Promise<{
        resumen: {
            totalRecibos: number;
            montoTotal: number;
            porMetodo: {
                metodo: string;
                count: number;
                monto: number;
            }[];
            porEstado: {
                estado: string;
                count: number;
            }[];
        };
        recibos: {
            id: string;
            numero: string;
            fecha: Date;
            estado: import("@prisma/client").$Enums.SaleStatus;
            cliente: any;
            sucursal: any;
            total: number;
            metodos: unknown[];
            snapshot: any;
        }[];
    }>;
    cashClose(user: JwtUser, query: PosCashCloseQueryDto): Promise<{
        date: string;
        range: {
            from: Date;
            to: Date;
        };
        branch: {
            id: string;
            name: string;
        } | null;
        salesCount: number;
        totals: {
            subtotal: number;
            discountTotal: number;
            taxTotal: number;
            grossTotal: number;
            paidTotal: number;
            creditOutstanding: number;
        };
        byMethod: {
            method: import("@prisma/client").$Enums.PaymentMethod;
            count: number;
            amount: number;
        }[];
    }>;
    checkout(user: JwtUser, dto: PosCheckoutDto): Promise<{
        sale: {
            items: {
                id: string;
                productId: string;
                quantity: import("@prisma/client/runtime/library").Decimal;
                unitPrice: import("@prisma/client/runtime/library").Decimal;
                taxAmount: import("@prisma/client/runtime/library").Decimal;
                discountAmount: import("@prisma/client/runtime/library").Decimal;
                lineTotal: import("@prisma/client/runtime/library").Decimal;
                saleId: string;
                unitCost: import("@prisma/client/runtime/library").Decimal;
            }[];
        } & {
            number: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            branchId: string;
            status: import("@prisma/client").$Enums.SaleStatus;
            type: import("@prisma/client").$Enums.SaleType;
            warehouseId: string;
            customerId: string | null;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            taxTotal: import("@prisma/client/runtime/library").Decimal;
            discountTotal: import("@prisma/client/runtime/library").Decimal;
            grandTotal: import("@prisma/client/runtime/library").Decimal;
            createdByMembershipId: string | null;
            paidTotal: import("@prisma/client/runtime/library").Decimal;
            note: string | null;
            soldAt: Date;
            returnedFromSaleId: string | null;
        };
        branch: {
            id: string;
            name: string;
        };
        customer: {
            id: string;
            fullName: string;
            documentId: string | null;
        } | null;
        receipt: {
            emisor: {
                nombre: string;
                ruc: string;
                direccion: string;
                telefono: string;
                correo: string;
                caja: string;
                piePagina: string;
            };
            moneda: string;
            numero: string;
            fecha: string;
            sucursal: string;
            cajero: string;
            cliente: {
                nombre: string;
                documento: string | null;
            } | null;
            items: {
                descripcion: string;
                cantidad: number;
                precioUnit: number;
                subtotal: number;
            }[];
            subtotal: number;
            descuento: number;
            impuesto: number;
            total: number;
            pagos: {
                metodo: string;
                monto: number;
                referencia: string | null;
            }[];
            montoRecibido: number;
            cambio: number;
            saldoPendiente: number;
            observacion: string | null;
            estado: string;
        };
        totals: {
            subtotal: number;
            discountTotal: number;
            taxTotal: number;
            grandTotal: number;
            paidTotal: number;
        };
    }>;
}
