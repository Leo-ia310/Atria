import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { StructuredLoggerService } from '@/infrastructure/logger/logger.service';

@Injectable()
export class MailerService {
  private readonly transporter: Transporter | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter =
      host && port && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            auth: { user, pass },
          })
        : null;
  }

  async sendVerificationEmail(
    email: string,
    organizationName: string,
    link: string,
  ): Promise<void> {
    await this.sendMail(
      email,
      `Verifica tu acceso a ${organizationName}`,
      `
        <p>Hola,</p>
        <p>Confirma tu correo para activar la cuenta de <strong>${organizationName}</strong>.</p>
        <p><a href="${link}">Verificar correo</a></p>
      `,
    );
  }

  async sendPasswordResetEmail(email: string, link: string): Promise<void> {
    await this.sendMail(
      email,
      'Restablece tu contraseña de Atria',
      `
        <p>Recibimos una solicitud para cambiar tu contraseña.</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
      `,
    );
  }

  private async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const from = this.configService.getOrThrow<string>('SMTP_FROM');

    if (!this.transporter) {
      this.logger.log('Email queued without SMTP transport', { to, subject });
      return;
    }

    await this.transporter.sendMail({ from, to, subject, html });
  }
}
