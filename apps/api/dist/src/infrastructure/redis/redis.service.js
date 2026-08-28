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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = RedisService_1 = class RedisService {
    logger = new common_1.Logger(RedisService_1.name);
    client;
    connected = false;
    constructor(configService) {
        const url = configService.get('REDIS_URL') ?? 'redis://localhost:6379';
        this.client = new ioredis_1.default(url, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 3)
                    return null;
                return Math.min(times * 200, 1000);
            },
        });
        this.client.on('connect', () => {
            this.connected = true;
            this.logger.log('Redis conectado');
        });
        this.client.on('error', (err) => {
            if (this.connected) {
                this.logger.warn(`Redis desconectado: ${err.message}`);
            }
            this.connected = false;
        });
        this.client.on('end', () => {
            this.connected = false;
        });
        this.client.connect().catch(() => {
            this.logger.warn(`Redis no disponible en ${url} — features async (queues, cache) deshabilitados.`);
        });
    }
    getClient() {
        return this.client;
    }
    isAvailable() {
        return this.connected;
    }
    async onModuleDestroy() {
        try {
            await this.client.quit();
        }
        catch {
            this.client.disconnect();
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map