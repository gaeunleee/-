import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../config/env.js";
import { EmailError } from "../errors.js";

export function createTransporter(env: Env): Transporter {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new EmailError("SMTP 설정이 완전하지 않습니다 (SMTP_HOST/SMTP_USER/SMTP_PASS 확인 필요)");
  }
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

export async function verifyTransporter(transporter: Transporter): Promise<void> {
  try {
    await transporter.verify();
  } catch (err) {
    throw new EmailError(`SMTP 연결 확인 실패: ${err instanceof Error ? err.message : err}`, err);
  }
}
