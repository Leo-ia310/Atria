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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
let ReportsService = ReportsService_1 = class ReportsService {
    prisma;
    reportsQueue;
    logger = new common_1.Logger(ReportsService_1.name);
    constructor(prisma, reportsQueue) {
        this.prisma = prisma;
        this.reportsQueue = reportsQueue;
    }
    catalog() {
        return [
            {
                key: 'sales-summary',
                name: 'Resumen de ventas',
                formats: ['json', 'pdf', 'xlsx'],
            },
            {
                key: 'inventory-aging',
                name: 'Inventario por antigüedad',
                formats: ['json', 'xlsx'],
            },
            {
                key: 'branch-performance',
                name: 'Rendimiento por sucursal',
                formats: ['json', 'pdf'],
            },
            {
                key: 'financial-overview',
                name: 'Resumen financiero',
                formats: ['json', 'pdf'],
            },
        ];
    }
    async exports(user) {
        return this.prisma.reportExport.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async createExport(user, dto) {
        const exportRecord = await this.prisma.reportExport.create({
            data: {
                organizationId: user.organizationId,
                type: dto.type,
                format: dto.format,
                filters: dto.filters,
                requestedByMembershipId: user.membershipId,
            },
        });
        if (this.reportsQueue) {
            await this.reportsQueue.add('generate', {
                exportId: exportRecord.id,
                organizationId: user.organizationId,
                type: dto.type,
                format: dto.format,
                filters: dto.filters,
            });
        }
        else {
            this.logger.warn(`Reporte ${exportRecord.id} no encolado: BullMQ inactivo (QUEUES_ENABLED=false).`);
        }
        return exportRecord;
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, bullmq_1.InjectQueue)('reports')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], ReportsService);
//# sourceMappingURL=reports.service.js.map