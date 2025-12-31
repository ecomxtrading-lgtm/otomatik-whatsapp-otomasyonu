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
      process.env.WHATSAPP_TEMPLATE_NAME || "jaspers_market_image_cta_v1";
    const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANG || "tr";
    const headerImage = process.env.WHATSAPP_TEMPLATE_HEADER_IMAGE;

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

    // Önce body parametresi (isim) ile dene, hata alırsan paramsız tekrar dene
    const componentsWithName: Array<Record<string, unknown>> = [
      ...headerComponent,
      {
        type: "body",
        parameters: [{ type: "text", text: name || "Misafir" }],
      },
    ];

    let templateResult = await sendTemplateWhatsApp(
      phone,
      templateName,
      templateLanguage,
      componentsWithName
    );

    if (!templateResult.success) {
      // Parametre uyumsuzluk hatalarında paramsız dene
      const componentsWithoutBody = headerComponent;
      if (componentsWithoutBody.length) {
        templateResult = await sendTemplateWhatsApp(
          phone,
          templateName,
          templateLanguage,
          componentsWithoutBody
        );
      }
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



