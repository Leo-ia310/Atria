import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Socket, Server } from 'socket.io';
import type { JwtUser } from '@/auth/auth.types';
import { AuthService } from '@/auth/auth.service';
import { extractBearerToken } from '@/common/utils/request.utils';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly authService: AuthService) {}

  private getSocketData(client: Socket): { user?: JwtUser } {
    return client.data as { user?: JwtUser };
  }

  onModuleInit(): void {
    void this.server?.engine?.on('connection_error', () => undefined);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const handshakeAuth = client.handshake.auth as
        | { token?: unknown }
        | undefined;
      const authToken =
        handshakeAuth?.token ??
        extractBearerToken(client.handshake.headers.authorization);

      if (!authToken || typeof authToken !== 'string') {
        client.disconnect();
        return;
      }

      const payload = await this.authService.verifyAccessToken(authToken);
      this.getSocketData(client).user = payload;
      await client.join(`tenant:${payload.organizationId}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('dashboard:join')
  async joinDashboard(
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean }> {
    const organizationId = this.getSocketData(client).user?.organizationId;

    if (organizationId) {
      await client.join(`dashboard:${organizationId}`);
    }

    return { ok: true };
  }

  @OnEvent('sales.completed')
  handleSalesCompleted(event: {
    organizationId: string;
    saleId: string;
    total: number;
  }): void {
    void this.server
      .to(`dashboard:${event.organizationId}`)
      .emit('dashboard.updated', event);
  }
}
