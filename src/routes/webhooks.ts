import { Router } from "express";
import { supabase, SUPABASE_TABLE } from "../config/supabase";
import {
  sendTemplateWhatsApp,
  sendWelcomeWhatsApp,
} from "../services/whatsappService";
import { sendWelcomeEmail } from "../services/mailService";
import { logger } from "../utils/logger";

type IncomingRecord = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  kvkk_accepted?: boolean | null;
  comms_accepted?: boolean | null;
  welcome_sent?: boolean | null;
};

const router = Router();

const extractRecord = (body: any): IncomingRecord | null => {
  if (!body) return null;
  return body.record || body.new || body;
};

router.post("/new-user", async (req, res) => {
  const record = extractRecord(req.body);
  if (!record) {
    return res.status(400).json({ message: "Kayit bulunamadi" });
  }

  const { name, email, phone, kvkk_accepted, comms_accepted } = record;

  if (!kvkk_accepted || !comms_accepted) {
    logger.info("Izin yok, mesaj gonderimi atlandi.", {
      email,
      phone,
      kvkk_accepted,
      comms_accepted,
    });
    return res
      .status(200)
      .json({ message: "Izin verilmedi, gonderim atlandi." });
  }

  let whatsappSuccess = false;
  let mailSuccess = false;

  if (phone) {
    // Onaylı template kullan (isim parametresi ile)
    const templateName =
      process.env.WHATSAPP_TEMPLATE_NAME || "jaspers_market_order_confirmation_v1";
    const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";
    const headerImage = process.env.WHATSAPP_TEMPLATE_HEADER_IMAGE;
    const useBodyName =
      (process.env.WHATSAPP_TEMPLATE_USE_NAME || "false").toLowerCase() ===
      "true";

    const headerComponent = headerImage
      ? [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: { link: headerImage },
              },
            ],
          },
        ]
      : [];

    // Önce header+body (isim) isteniyorsa dene, değilse doğrudan headersız/body'siz gönder
    const componentsWithName: Array<Record<string, unknown>> = useBodyName
      ? [
          ...headerComponent,
          {
            type: "body",
            parameters: [{ type: "text", text: name || "Misafir" }],
          },
        ]
      : headerComponent;

    // İlk deneme (body dahilse body'li, yoksa sadece header ya da boş)
    let templateResult = await sendTemplateWhatsApp(
      phone,
      templateName,
      templateLanguage,
      componentsWithName
    );

    // Parametre uyuşmazlığında (132000) body'yi çıkarıp tekrar dene
    if (!templateResult.success && useBodyName) {
      const componentsWithoutBody = headerComponent;
      templateResult = await sendTemplateWhatsApp(
        phone,
        templateName,
        templateLanguage,
        componentsWithoutBody
      );
    }

    // Şablon hâlâ başarısızsa fallback'e gitme; sadece template sonucu döndür
    whatsappSuccess = templateResult.success;
  }
  if (email) {
    mailSuccess = await sendWelcomeEmail(email, name || null);
  }

  if (whatsappSuccess || mailSuccess) {
    const identifier = record.id
      ? { id: record.id }
      : email
      ? { email }
      : phone
      ? { phone }
      : null;

    if (identifier) {
      const { error } = await supabase
        .from(SUPABASE_TABLE)
        .update({ welcome_sent: true })
        .match(identifier);
      if (error) {
        logger.error("welcome_sent guncellenemedi", error);
      }
    }
  }

  return res.status(200).json({
    message: "Islem tamamlandi",
    whatsapp: whatsappSuccess,
    email: mailSuccess,
  });
});

export default router;



