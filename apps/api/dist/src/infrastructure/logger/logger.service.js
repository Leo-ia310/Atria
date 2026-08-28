"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLoggerService = void 0;
const common_1 = require("@nestjs/common");
let StructuredLoggerService = class StructuredLoggerService {
    write(level, message, meta) {
        const extra = typeof meta === 'string'
            ? { context: meta }
            : meta && typeof meta === 'object'
                ? meta
                : {};
        const payload = {
            level,
            message: typeof message === 'string' ? message : String(message),
            timestamp: new Date().toISOString(),
            ...extra,
        };
        process.stdout.write(`${JSON.stringify(payload)}\n`);
    }
    log(message, meta) {
        this.write('info', message, meta);
    }
    error(message, meta) {
        this.write('error', message, meta);
    }
    warn(message, meta) {
        this.write('warn', message, meta);
    }
    debug(message, meta) {
        this.write('debug', message, meta);
    }
    verbose(message, meta) {
        this.write('verbose', message, meta);
    }
    audit(message, meta) {
        this.write('audit', message, meta);
    }
};
exports.StructuredLoggerService = StructuredLoggerService;
exports.StructuredLoggerService = StructuredLoggerService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.DEFAULT })
], StructuredLoggerService);
//# sourceMappingURL=logger.service.js.map