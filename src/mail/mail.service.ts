import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY')!);
    this.from =
      this.config.get<string>('RESEND_FROM_EMAIL') || 'noreply@example.com';
  }

  /** 发送邮箱验证码 */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: '您的注册验证码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">邮箱验证码</h2>
          <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6;">
            您好，您正在注册账号，请使用以下验证码完成注册：
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">
              ${code}
            </span>
          </div>
          <p style="color: #71717a; font-size: 12px; line-height: 1.6;">
            验证码有效期为 5 分钟，请勿将此验证码泄露给他人。<br/>
            如果您没有进行注册操作，请忽略此邮件。
          </p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error);
      throw new Error('邮件发送失败，请稍后重试');
    }

    this.logger.log(`Verification code sent to ${to}`);
  }
}
