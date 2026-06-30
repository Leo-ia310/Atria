import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { StructuredLoggerService } from '@/infrastructure/logger/logger.service';

type Driver = 'resend' | 'smtp' | 'log';

@Injectable()
export class MailerService {
  private readonly driver: Driver;
  private readonly resend: Resend | null;
  private readonly transporter: Transporter | null;
  private readonly defaultFrom: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (resendKey) {
      this.driver = 'resend';
      this.resend = new Resend(resendKey);
      this.transporter = null;
      this.defaultFrom =
        this.configService.get<string>('RESEND_FROM') ??
        this.configService.get<string>('SMTP_FROM') ??
        'onboarding@resend.dev';
    } else if (host && port && user && pass) {
      this.driver = 'smtp';
      this.resend = null;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
      });
      this.defaultFrom =
        this.configService.get<string>('SMTP_FROM') ?? 'no-reply@atria.local';
    } else {
      this.driver = 'log';
      this.resend = null;
      this.transporter = null;
      this.defaultFrom =
        this.configService.get<string>('SMTP_FROM') ?? 'no-reply@atria.local';
    }
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

  /**
   * Envío genérico — útil para notificaciones operativas (alertas de stock,
   * resúmenes de cierre, etc.) sin tener que escribir un método dedicado.
   */
  async send(opciones: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): Promise<void> {
    await this.sendMail(
      opciones.to,
      opciones.subject,
      opciones.html,
      opciones.text,
      opciones.from,
    );
  }

  private async sendMail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    fromOverride?: string,
  ): Promise<void> {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.warn?.('Email send failed', {
        to: recipients,
        subject,
        driver: this.driver,
        error: message,
      });
      // No relanzamos: el flujo de auth no debe romperse por un email caído.
    }
  }

  /** Útil para diagnóstico desde un health check o ruta de administración. */
  getDriver(): Driver {
    return this.driver;
  }
}
