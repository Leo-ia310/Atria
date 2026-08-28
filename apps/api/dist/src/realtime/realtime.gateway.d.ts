import { OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection } from '@nestjs/websockets';
import type { Socket, Server } from 'socket.io';
import { AuthService } from "../auth/auth.service";
export declare class RealtimeGateway implements OnGatewayConnection, OnModuleInit {
    private readonly authService;
    server: Server;
    constructor(authService: AuthService);
    private getSocketData;
    onModuleInit(): void;
    handleConnection(client: Socket): Promise<void>;
    joinDashboard(client: Socket): Promise<{
        ok: boolean;
    }>;
    handleSalesCompleted(event: {
        organizationId: string;
        saleId: string;
        total: number;
    }): void;
}
