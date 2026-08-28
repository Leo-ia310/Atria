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
exports.SalesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const sales_dto_1 = require("./dto/sales.dto");
const sales_service_1 = require("./sales.service");
let SalesController = class SalesController {
    salesService;
    constructor(salesService) {
        this.salesService = salesService;
    }
    sales(user, query) {
        return this.salesService.sales(user, query);
    }
    analytics(user) {
        return this.salesService.analytics(user);
    }
    customers(user) {
        return this.salesService.customers(user);
    }
    createCustomer(user, dto) {
        return this.salesService.createCustomer(user, dto);
    }
    updateCustomer(user, id, dto) {
        return this.salesService.updateCustomer(user, id, dto);
    }
    deleteCustomer(user, id) {
        return this.salesService.deleteCustomer(user, id);
    }
    quotations(user) {
        return this.salesService.quotations(user);
    }
    createQuotation(user, dto) {
        return this.salesService.createQuotation(user, dto);
    }
    deleteQuotation(user, id) {
        return this.salesService.deleteQuotation(user, id);
    }
    findOne(user, id) {
        return this.salesService.findOne(user, id);
    }
    voidSale(user, id, dto) {
        return this.salesService.voidSale(user, id, dto);
    }
};
exports.SalesController = SalesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SalesQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "sales", null);
__decorate([
    (0, common_1.Get)('analytics'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)('customers'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "customers", null);
__decorate([
    (0, common_1.Post)('customers'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createCustomer", null);
__decorate([
    (0, common_1.Patch)('customers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "updateCustomer", null);
__decorate([
    (0, common_1.Delete)('customers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "deleteCustomer", null);
__decorate([
    (0, common_1.Get)('quotations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "quotations", null);
__decorate([
    (0, common_1.Post)('quotations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateQuotationDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createQuotation", null);
__decorate([
    (0, common_1.Delete)('quotations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "deleteQuotation", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.VoidSaleDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "voidSale", null);
exports.SalesController = SalesController = __decorate([
    (0, swagger_1.ApiTags)('Ventas'),
    (0, common_1.Controller)({ path: 'sales', version: '1' }),
    __metadata("design:paramtypes", [sales_service_1.SalesService])
], SalesController);
//# sourceMappingURL=sales.controller.js.map