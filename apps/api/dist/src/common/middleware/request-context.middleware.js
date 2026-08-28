"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContextMiddleware = void 0;
const common_1 = require("@nestjs/common");
const request_utils_1 = require("../utils/request.utils");
let RequestContextMiddleware = class RequestContextMiddleware {
    use(request, response, next) {
        request.requestId = (0, request_utils_1.createRequestId)();
        request.tenantSlug = (0, request_utils_1.extractTenantSlug)(request);
        request.ipAddress = (0, request_utils_1.getRequestIp)(request);
        request.userAgent = request.headers['user-agent'] ?? null;
        response.setHeader('x-request-id', request.requestId);
        next();
    }
};
exports.RequestContextMiddleware = RequestContextMiddleware;
exports.RequestContextMiddleware = RequestContextMiddleware = __decorate([
    (0, common_1.Injectable)()
], RequestContextMiddleware);
//# sourceMappingURL=request-context.middleware.js.map