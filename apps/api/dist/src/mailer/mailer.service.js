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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
const resend_1 = require("resend");
const logger_service_1 = require("../infrastructure/logger/logger.service");
let MailerService = class MailerService {
    configService;
    logger;
    driver;
    resend;
    transporter;
    defaultFrom;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const resendKey = this.configService.get('RESEND_API_KEY');
        const host = this.configService.get('SMTP_HOST');
        const port = this.configService.get('SMTP_PORT');
        const user = this.configService.get('SMTP_USER');
        const pass = this.configService.get('SMTP_PASS');
        if (resendKey) {
            this.driver = 'resend';
            this.resend = new resend_1.Resend(resendKey);
            this.transporter = null;
            this.defaultFrom =
                this.configService.get('RESEND_FROM') ??
                    this.configService.get('SMTP_FROM') ??
                    'onboarding@resend.dev';
        }
        else if (host && port && user && pass) {
            this.driver = 'smtp';
            this.resend = null;
            this.transporter = nodemailer_1.default.createTransport({
                host,
                port,
                auth: { user, pass },
            });
            this.defaultFrom =
                this.configService.get('SMTP_FROM') ?? 'no-reply@atria.local';
        }
        else {
            this.driver = 'log';
            this.resend = null;
            this.transporter = null;
            this.defaultFrom =
                this.configService.get('SMTP_FROM') ?? 'no-reply@atria.local';
        }
    }
    async sendVerificationEmail(email, organizationName, link) {
        await this.sendMail(email, `Verifica tu acceso a ${organizationName}`, `
        <p>Hola,</p>
        <p>Confirma tu correo para activar la cuenta de <strong>${organizationName}</strong>.</p>
        <p><a href="${link}">Verificar correo</a></p>
      `);
    }
    async sendPasswordResetEmail(email, link) {
        await this.sendMail(email, 'Restablece tu contraseña de Atria', `
        <p>Recibimos una solicitud para cambiar tu contraseña.</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
      `);
    }
    async send(opciones) {
        await this.sendMail(opciones.to, opciones.subject, opciones.html, opciones.text, opciones.from);
    }
    async sendMail(to, subject, html, text, fromOverride) {
        const from = fromOverride ?? this.defaultFrom;
        const recipients = Array.isArray(to) ? to : [to];
        if (this.driver === 'log') {
            this.logger.log('Email queued without transport', {
                to: recipients,
                subject,
                driver: this.driver,
            });
            return;
        }
        try {
            if (this.driver === 'resend' && this.resend) {
                const { error } = await this.resend.emails.send({
                    from,
                    to: recipients,
                    subject,
                    html,
                    text,
                });
                if (error) {
                    throw new Error(error.message);
                }
                this.logger.log('Email sent via Resend', {
                    to: recipients,
                    subject,
                });
                return;
            }
            if (this.driver === 'smtp' && this.transporter) {
                await this.transporter.sendMail({
                    from,
                    to: recipients.join(','),
                    subject,
                    html,
                    text,
                });
                this.logger.log('Email sent via SMTP', { to: recipients, subject });
                return;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            this.logger.warn?.('Email send failed', {
                to: recipients,
                subject,
                driver: this.driver,
                error: message,
            });
        }
    }
    getDriver() {
        return this.driver;
    }
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.StructuredLoggerService])
], MailerService);
//# sourceMappingURL=mailer.service.js.map