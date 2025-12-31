import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../utils/logger";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT
  ? Number(process.env.SMTP_PORT)
  : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    logger.warn("SMTP ayarlari eksik, mail gonderimi atlandi.");
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return transporter;
};

export const sendMail = async (
  to: string,
  subject: string,
  text: string
): Promise<boolean> => {
  const activeTransporter = getTransporter();
  if (!activeTransporter) return false;

  try {
    await activeTransporter.sendMail({
      from: mailFrom || smtpUser,
      to,
      subject,
      text,
    });
    return true;
  } catch (error) {
    logger.error("Mail gonderim hatasi", error);
    return false;
  }
};

export const sendWelcomeEmail = async (
  to: string,
  name: string | null
): Promise<boolean> => {
  const safeName = name || "Misafir";
  const subject = "Hos geldin!";
  const body =
    `Merhaba ${safeName},\n\n` +
    "Kaydini aldik. Iletisim izinlerin ile seni bilgilendirmeye devam edecegiz.\n\n" +
    "Sevgiler,\nWhatsApp Otomasyon Takimi";

  return sendMail(to, subject, body);
};



