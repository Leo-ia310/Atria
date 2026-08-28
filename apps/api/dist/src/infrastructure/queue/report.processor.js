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
exports.ReportProcessor = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let ReportProcessor = class ReportProcessor extends bullmq_1.WorkerHost {
    prisma;
    configService;
    constructor(prisma, configService) {
        super();
        this.prisma = prisma;
        this.configService = configService;
    }
    async process(job) {
        const exportPath = this.configService.getOrThrow('REPORT_EXPORT_PATH');
        await (0, promises_1.mkdir)(exportPath, { recursive: true });
        const fileName = `${job.id}-${job.data.type}.${job.data.format}`;
        const fileKey = (0, node_path_1.join)(exportPath, fileName);
        await this.prisma.reportExport.update({
            where: { id: job.data.exportId },
            data: { status: 'PROCESSING' },
        });
        const payload = JSON.stringify({
            generatedAt: new Date().toISOString(),
            organizationId: job.data.organizationId,
            type: job.data.type,
            format: job.data.format,
            filters: job.data.filters,
        }, null, 2);
        await (0, promises_1.writeFile)(fileKey, payload, 'utf8');
        await this.prisma.reportExport.update({
            where: { id: job.data.exportId },
            data: {
                status: 'COMPLETED',
                fileKey,
            },
        });
    }
};
exports.ReportProcessor = ReportProcessor;
exports.ReportProcessor = ReportProcessor = __decorate([
    (0, bullmq_1.Processor)('reports'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], ReportProcessor);
//# sourceMappingURL=report.processor.js.map