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
exports.PosController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const pos_dto_1 = require("./dto/pos.dto");
const pos_service_1 = require("./pos.service");
let PosController = class PosController {
    posService;
    constructor(posService) {
        this.posService = posService;
    }
    catalog(user, query) {
        return this.posService.catalog(user, query);
    }
    suspended(user) {
        return this.posService.suspended(user);
    }
    receipts(user, query) {
        return this.posService.receipts(user, query);
    }
    cashClose(user, query) {
        return this.posService.cashClose(user, query);
    }
    checkout(user, dto) {
        return this.posService.checkout(user, dto);
    }
};
exports.PosController = PosController;
__decorate([
    (0, common_1.Get)('catalog'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pos_dto_1.PosCatalogQueryDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "catalog", null);
__decorate([
    (0, common_1.Get)('suspended'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "suspended", null);
__decorate([
    (0, common_1.Get)('receipts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pos_dto_1.PosReceiptsQueryDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "receipts", null);
__decorate([
    (0, common_1.Get)('cash-close'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pos_dto_1.PosCashCloseQueryDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "cashClose", null);
__decorate([
    (0, common_1.Post)('checkout'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pos_dto_1.PosCheckoutDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "checkout", null);
exports.PosController = PosController = __decorate([
    (0, swagger_1.ApiTags)('POS'),
    (0, common_1.Controller)({ path: 'pos', version: '1' }),
    __metadata("design:paramtypes", [pos_service_1.PosService])
], PosController);
//# sourceMappingURL=pos.controller.js.map