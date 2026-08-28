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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadProcessor = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const bullmq_1 = require("@nestjs/bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let UploadProcessor = class UploadProcessor extends bullmq_1.WorkerHost {
    prisma;
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const asset = await this.prisma.fileAsset.findUnique({
            where: { id: job.data.fileAssetId },
        });
        if (!asset) {
            return;
        }
        const buffer = await (0, promises_1.readFile)(asset.storageKey);
        const checksum = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
        await this.prisma.fileAsset.update({
            where: { id: asset.id },
            data: {
                checksum,
                status: 'SCANNED_SAFE',
            },
        });
    }
};
exports.UploadProcessor = UploadProcessor;
exports.UploadProcessor = UploadProcessor = __decorate([
    (0, bullmq_1.Processor)('uploads'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UploadProcessor);
//# sourceMappingURL=upload.processor.js.map