import nodemailer from 'nodemailer';
import { AppError, authCodes } from '../utils/response.util.js';
import { buildPasswordResetEmail, buildVerificationEmail } from '../utils/email.util.js';

export class EmailService {
  constructor(config) {
    this.config = config.smtp;
    this.transporter = null;
  }

  canSend() {
    return Boolean(
      this.config?.host &&
        this.config?.fromEmail &&
        this.config?.user &&
        this.config?.pass,
    );
  }

  getTransporter() {
    if (!this.canSend()) {
      throw new AppError(
        'Email delivery is not configured',
        authCodes.EMAIL_DELIVERY_UNAVAILABLE,
        503,
      );
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });
    }

    return this.transporter;
  }

  async sendMail({ to, subject, text }) {
    try {
      await this.getTransporter().sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to,
        subject,
        text,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Email delivery failed safely', authCodes.EMAIL_DELIVERY_UNAVAILABLE, 503);
    }
  }

  async sendVerificationOtp({ to, name, otp }) {
    const email = buildVerificationEmail({ name, otp });
    await this.sendMail({ to, ...email });
  }

  async sendPasswordResetOtp({ to, name, otp }) {
    const email = buildPasswordResetEmail({ name, otp });
    await this.sendMail({ to, ...email });
  }
}
