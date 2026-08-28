import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    overview(user: JwtUser): Promise<{
        kpis: {
            ventasHoy: {
                total: number;
                transacciones: number;
            };
            ingresosMes: {
                total: number;
                cobrados: number;
                transacciones: number;
                delta: number;
            };
            alertasInventario: number;
            cuentasPorCobrar: number;
            margenBruto: number;
        };
        ventasSerie: {
            fecha: string;
            total: number;
        }[];
        stockCritico: {
            id: string;
            producto: string;
            disponible: number;
            minimo: number;
            sucursal: string;
        }[];
        rendimientoEquipo: {
            miembroId: string | null;
            nombre: string;
            transacciones: number;
            total: number;
        }[];
        rendimientoSucursales: {
            sucursalId: string;
            nombre: string;
            ingresosMes: number;
            transacciones: number;
        }[];
        accionRequerida: {
            id: string;
            tipo: "factura_vencida";
            cliente: string;
            venta: string;
            monto: number;
            diasVencido: number;
        }[];
        actividadReciente: {
            id: string;
            actor: string;
            modulo: string;
            accion: string;
            entidad: string;
            fecha: Date;
        }[];
    }>;
}
