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
exports.CompleteOnboardingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class TaxDto {
    code;
    name;
    rate;
    scope;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TaxDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TaxDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TaxDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['SALE', 'PURCHASE', 'BOTH'] }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['SALE', 'PURCHASE', 'BOTH']),
    __metadata("design:type", String)
], TaxDto.prototype, "scope", void 0);
class InitialUserDto {
    firstName;
    lastName;
    email;
    password;
    roleKey;
    jobTitle;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['owner', 'admin', 'worker', 'accountant'] }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "roleKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialUserDto.prototype, "jobTitle", void 0);
class InitialProductDto {
    name;
    sku;
    salePrice;
    costPrice;
    minStock;
    categoryName;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialProductDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialProductDto.prototype, "sku", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InitialProductDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InitialProductDto.prototype, "costPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InitialProductDto.prototype, "minStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InitialProductDto.prototype, "categoryName", void 0);
class CompleteOnboardingDto {
    businessType;
    countryCode;
    currencyCode;
    timezone;
    primaryBranchName;
    taxes;
    initialUsers;
    initialProducts;
}
exports.CompleteOnboardingDto = CompleteOnboardingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "businessType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "countryCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "currencyCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "primaryBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TaxDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TaxDto),
    __metadata("design:type", Array)
], CompleteOnboardingDto.prototype, "taxes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [InitialUserDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => InitialUserDto),
    __metadata("design:type", Array)
], CompleteOnboardingDto.prototype, "initialUsers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [InitialProductDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => InitialProductDto),
    __metadata("design:type", Array)
], CompleteOnboardingDto.prototype, "initialProducts", void 0);
//# sourceMappingURL=onboarding.dto.js.map