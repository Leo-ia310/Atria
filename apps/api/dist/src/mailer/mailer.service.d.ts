import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from "../infrastructure/logger/logger.service";
type Driver = 'resend' | 'smtp' | 'log';
export declare class MailerService {
    private readonly configService;
    private readonly logger;
    private readonly driver;
    private readonly resend;
    private readonly transporter;
    private readonly defaultFrom;
    constructor(configService: ConfigService, logger: StructuredLoggerService);
    sendVerificationEmail(email: string, organizationName: string, link: string): Promise<void>;
    sendPasswordResetEmail(email: string, link: string): Promise<void>;
    send(opciones: {
        to: string | string[];
        subject: string;
        html: string;
        text?: string;
        from?: string;
    }): Promise<void>;
    private sendMail;
    getDriver(): Driver;
}
export {};
