import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
export type NotificationItem = {
    id: string;
    tipo: 'stock_bajo' | 'factura_vencida' | 'venta_en_espera';
    severidad: 'error' | 'warning' | 'info';
    titulo: string;
    descripcion: string;
    href: string;
    fecha: string | null;
};
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(user: JwtUser): Promise<{
        total: number;
        items: NotificationItem[];
    }>;
}
