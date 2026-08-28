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
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const allowedMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
let UploadsService = UploadsService_1 = class UploadsService {
    prisma;
    configService;
    uploadsQueue;
    logger = new common_1.Logger(UploadsService_1.name);
    constructor(prisma, configService, uploadsQueue) {
        this.prisma = prisma;
        this.configService = configService;
        this.uploadsQueue = uploadsQueue;
    }
    async upload(user, module, file) {
        if (!file) {
            throw new common_1.BadRequestException('Debes adjuntar un archivo.');
        }
        if (!allowedMimeTypes.has(file.mimetype)) {
            throw new common_1.BadRequestException('Tipo de archivo no permitido.');
        }
        const maxBytes = this.configService.get('UPLOAD_MAX_BYTES') ?? 10 * 1024 * 1024;
        if (file.size > maxBytes) {
            throw new common_1.BadRequestException('El archivo excede el tamaño permitido.');
        }
        const uploadDir = (0, node_path_1.join)(process.cwd(), 'uploads', 'pending');
        await (0, promises_1.mkdir)(uploadDir, { recursive: true });
        const storageKey = (0, node_path_1.join)(uploadDir, `${(0, node_crypto_1.randomUUID)()}${(0, node_path_1.extname)(file.originalname)}`);
        await (0, promises_1.writeFile)(storageKey, file.buffer);
        const asset = await this.prisma.fileAsset.create({
            data: {
                organizationId: user.organizationId,
                uploadedById: user.sub,
                module,
                originalName: file.originalname,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                storageKey,
            },
        });
        if (this.uploadsQueue) {
            await this.uploadsQueue.add('scan', {
                fileAssetId: asset.id,
            });
        }
        else {
            this.logger.warn(`Archivo ${asset.id} no encolado para escaneo: BullMQ inactivo.`);
        }
        return asset;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, bullmq_1.InjectQueue)('uploads')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        bullmq_2.Queue])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map