"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const websockets_1 = require("@nestjs/websockets");
const auth_service_1 = require("../auth/auth.service");
const request_utils_1 = require("../common/utils/request.utils");
function extractCookie(cookieHeader, name) {
    if (!cookieHeader)
        return null;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
        const [key, ...rest] = cookie.split('=');
        if (key === name)
            return decodeURIComponent(rest.join('='));
    }
    return null;
}
let RealtimeGateway = class RealtimeGateway {
    authService;
    server;
    constructor(authService) {
        this.authService = authService;
    }
    getSocketData(client) {
        return client.data;
    }
    onModuleInit() {
        void this.server?.engine?.on('connection_error', () => undefined);
    }
    async handleConnection(client) {
        try {
            const handshakeAuth = client.handshake.auth;
            const cookieToken = extractCookie(client.handshake.headers.cookie, request_utils_1.cookieNames.access);
            const authToken = handshakeAuth?.token ??
                (0, request_utils_1.extractBearerToken)(client.handshake.headers.authorization) ??
                cookieToken;
            if (!authToken || typeof authToken !== 'string') {
                client.disconnect();
                return;
            }
            const payload = await this.authService.verifyAccessToken(authToken);
            this.getSocketData(client).user = payload;
            await client.join(`tenant:${payload.organizationId}`);
        }
        catch {
            client.disconnect();
        }
    }
    async joinDashboard(client) {
        const organizationId = this.getSocketData(client).user?.organizationId;
        if (organizationId) {
            await client.join(`dashboard:${organizationId}`);
        }
        return { ok: true };
    }
    handleSalesCompleted(event) {
        void this.server
            .to(`dashboard:${event.organizationId}`)
            .emit('dashboard.updated', event);
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('dashboard:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "joinDashboard", null);
__decorate([
    (0, event_emitter_1.OnEvent)('sales.completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handleSalesCompleted", null);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, common_1.Injectable)(),
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: true,
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map