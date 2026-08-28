"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QueueModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const report_processor_1 = require("./report.processor");
const upload_processor_1 = require("./upload.processor");
let QueueModule = class QueueModule {
    static { QueueModule_1 = this; }
    static logger = new common_1.Logger(QueueModule_1.name);
    static register() {
        const enabled = process.env.QUEUES_ENABLED === 'true';
        if (!enabled) {
            QueueModule_1.logger.warn('QUEUES_ENABLED=false — BullMQ desactivado (sin Redis).');
            return { module: QueueModule_1, global: true };
        }
        return {
            module: QueueModule_1,
            global: true,
            imports: [
                config_1.ConfigModule,
                bullmq_1.BullModule.forRootAsync({
                    imports: [config_1.ConfigModule],
                    inject: [config_1.ConfigService],
                    useFactory: (configService) => ({
                        connection: {
                            url: configService.getOrThrow('REDIS_URL'),
                        },
                    }),
                }),
                bullmq_1.BullModule.registerQueue({ name: 'reports' }, { name: 'uploads' }),
            ],
            providers: [report_processor_1.ReportProcessor, upload_processor_1.UploadProcessor],
            exports: [bullmq_1.BullModule],
        };
    }
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = QueueModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], QueueModule);
//# sourceMappingURL=queue.module.js.map