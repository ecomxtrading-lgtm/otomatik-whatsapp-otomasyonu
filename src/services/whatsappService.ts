import { logger } from "../utils/logger";

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

const normalizePhone = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Varsayilan ulke kodu: TR (90)
  if (digits.startsWith("90") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    // 5xx... formatı → +90 ekle
    return `+90${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+90${digits.slice(1)}`;
  }
  if (digits.length >= 11) {
    return `+${digits}`;
  }
  return null;
};

const buildWelcomeMessage = (name?: string) => {
  const safeName = name ? ` ${name}` : "";
  return `Merhaba${safeName}! Kaydiniz icin tesekkur ederiz. Iletisim izinlerinle sana hizlica ulasacagiz.`;
};

type SendResult = { success: boolean; detail?: string };

export const sendWhatsAppMessage = async (
  to: string,
  message: string
): Promise<SendResult> => {
  if (!token || !phoneNumberId) {
    const detail = "WhatsApp bilgiler eksik (token/phone number id).";
    logger.warn(detail);
    return { success: false, detail };
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    const detail = "Telefon numarasi bos veya hatali.";
    logger.warn(detail, { to });
    return { success: false, detail };
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: normalized.replace("+", ""),
    type: "text",
    text: { body: message },
  };

  try {
    logger.info("WhatsApp gonderim denemesi", { to: normalized });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("WhatsApp mesaj gonderimi basarisiz", {
        status: response.status,
        body: errorText,
        to: normalized,
      });
      return { success: false, detail: `HTTP ${response.status}: ${errorText}` };
    }

    const json = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id: string }> }
      | null;

    const msgId = json?.messages?.[0]?.id;
    if (msgId) {
      logger.info("WhatsApp mesaj gonderimi basarili", { to: normalized, msgId });
      return { success: true, detail: msgId };
    }

    logger.info("WhatsApp mesaj gonderimi basarili (msgId yok)", {
      to: normalized,
    });
    return { success: true };
  } catch (error) {
    logger.error("WhatsApp mesaj gonderim hatasi", error);
    return { success: false, detail: String(error) };
  }
};

export const sendWelcomeWhatsApp = async (
  name: string | null,
  phone: string
): Promise<boolean> => {
  const message = buildWelcomeMessage(name || undefined);
  const result = await sendWhatsAppMessage(phone, message);
  return result.success;
};

export const sendTemplateWhatsApp = async (
  to: string,
  templateName: string,
  languageCode = "en_US",
  components: Array<Record<string, unknown>> = []
): Promise<SendResult> => {
  if (!token || !phoneNumberId) {
    const detail = "WhatsApp bilgiler eksik (token/phone number id).";
    logger.warn(detail);
    return { success: false, detail };
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    const detail = "Telefon numarasi bos veya hatali.";
    logger.warn(detail, { to });
    return { success: false, detail };
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: normalized.replace("+", ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  try {
    logger.info("WhatsApp template gonderim denemesi", {
      to: normalized,
      templateName,
      languageCode,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("WhatsApp template gonderimi basarisiz", {
        status: response.status,
        body: errorText,
        to: normalized,
      });
      return { success: false, detail: `HTTP ${response.status}: ${errorText}` };
    }

    const json = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id: string }> }
      | null;
    const msgId = json?.messages?.[0]?.id;
    if (msgId) {
      logger.info("WhatsApp template gonderimi basarili", {
        to: normalized,
        msgId,
        templateName,
      });
      return { success: true, detail: msgId };
    }

    logger.info("WhatsApp template gonderimi basarili (msgId yok)", {
      to: normalized,
      templateName,
    });
    return { success: true };
  } catch (error) {
    logger.error("WhatsApp template gonderim hatasi", error);
    return { success: false, detail: String(error) };
  }
};


