"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
let EmployeesService = class EmployeesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async list(user) {
        return this.prisma.employeeProfile.findMany({
            where: { organizationId: user.organizationId },
            include: {
                membership: {
                    include: {
                        user: true,
                        role: true,
                    },
                },
                branch: true,
            },
            orderBy: { hireDate: 'asc' },
        });
    }
    async create(user, dto) {
        const role = await this.prisma.role.findFirst({
            where: {
                organizationId: user.organizationId,
                key: dto.roleKey,
            },
        });
        if (!role) {
            throw new common_1.NotFoundException('No encontramos el rol seleccionado.');
        }
        const passwordHash = await argon2.hash(dto.password);
        const created = await this.prisma.$transaction(async (transaction) => {
            const createdUser = await transaction.user.upsert({
                where: { email: dto.email.toLowerCase() },
                update: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    passwordHash,
                },
                create: {
                    email: dto.email.toLowerCase(),
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    passwordHash,
                },
            });
            const membership = await transaction.membership.upsert({
                where: {
                    organizationId_userId: {
                        organizationId: user.organizationId,
                        userId: createdUser.id,
                    },
                },
                update: {
                    roleId: role.id,
                    defaultBranchId: dto.branchId,
                },
                create: {
                    organizationId: user.organizationId,
                    userId: createdUser.id,
                    roleId: role.id,
                    defaultBranchId: dto.branchId,
                },
            });
            const employeeCount = await transaction.employeeProfile.count({
                where: { organizationId: user.organizationId },
            });
            const profile = await transaction.employeeProfile.upsert({
                where: { membershipId: membership.id },
                update: {
                    branchId: dto.branchId,
                    jobTitle: dto.jobTitle ?? 'Operación',
                },
                create: {
                    organizationId: user.organizationId,
                    membershipId: membership.id,
                    branchId: dto.branchId,
                    employeeCode: `EMP-${String(employeeCount + 1).padStart(3, '0')}`,
                    jobTitle: dto.jobTitle ?? 'Operación',
                    hireDate: new Date(),
                },
            });
            await transaction.subscription.update({
                where: { organizationId: user.organizationId },
                data: {
                    seatsUsed: { increment: 1 },
                },
            });
            return profile;
        });
        await this.auditService.log({
            organizationId: user.organizationId,
            actorId: user.sub,
            module: 'employees',
            action: 'create',
            entityType: 'employee_profile',
            entityId: created.id,
        });
        return created;
    }
    async attendance(user) {
        return this.prisma.attendanceRecord.findMany({
            where: { organizationId: user.organizationId },
            include: {
                employeeProfile: {
                    include: {
                        membership: { include: { user: true } },
                    },
                },
                branch: true,
            },
            orderBy: { checkInAt: 'desc' },
            take: 50,
        });
    }
    async activity(user) {
        return this.prisma.auditLog.findMany({
            where: { organizationId: user.organizationId },
            include: { actor: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async update(user, id, dto) {
        const profile = await this.prisma.employeeProfile.findFirst({
            where: { id, organizationId: user.organizationId },
            include: { membership: { include: { user: true } } },
        });
        if (!profile)
            throw new common_1.NotFoundException('Empleado no encontrado.');
        return this.prisma.$transaction(async (tx) => {
            if (dto.firstName || dto.lastName) {
                await tx.user.update({
                    where: { id: profile.membership.userId },
                    data: {
                        firstName: dto.firstName ?? undefined,
                        lastName: dto.lastName ?? undefined,
                    },
                });
            }
            if (dto.roleKey) {
                const role = await tx.role.findFirst({
                    where: { organizationId: user.organizationId, key: dto.roleKey },
                });
                if (!role)
                    throw new common_1.NotFoundException('Rol no encontrado.');
                await tx.membership.update({
                    where: { id: profile.membershipId },
                    data: { roleId: role.id },
                });
            }
            if (dto.branchId) {
                await tx.membership.update({
                    where: { id: profile.membershipId },
                    data: { defaultBranchId: dto.branchId },
                });
            }
            return tx.employeeProfile.update({
                where: { id },
                data: {
                    branchId: dto.branchId ?? undefined,
                    jobTitle: dto.jobTitle ?? undefined,
                },
            });
        });
    }
    async remove(user, id) {
        const profile = await this.prisma.employeeProfile.findFirst({
            where: { id, organizationId: user.organizationId },
            include: { membership: true },
        });
        if (!profile)
            throw new common_1.NotFoundException('Empleado no encontrado.');
        return this.prisma.$transaction(async (tx) => {
            await tx.membership.update({
                where: { id: profile.membershipId },
                data: { deletedAt: new Date(), status: 'SUSPENDED' },
            });
            await tx.subscription.update({
                where: { organizationId: user.organizationId },
                data: { seatsUsed: { decrement: 1 } },
            });
            return { deleted: true, id };
        });
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map