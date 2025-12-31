import { Router } from "express";
import { supabase, SUPABASE_TABLE } from "../config/supabase";
import {
  sendWhatsAppMessage,
  sendWelcomeWhatsApp,
  sendTemplateWhatsApp,
} from "../services/whatsappService";
import { sendWelcomeEmail } from "../services/mailService";
import { logger } from "../utils/logger";

const router = Router();

type UserRow = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  kvkk_accepted?: boolean | null;
  comms_accepted?: boolean | null;
  welcome_sent?: boolean | null;
};

const buildFilter = (filter: string) => {
  const rules: Array<{ column: keyof UserRow; value: boolean }> = [];

  if (filter === "marketing") {
    rules.push({ column: "comms_accepted", value: true });
  } else if (filter === "contact") {
    rules.push({ column: "kvkk_accepted", value: true });
  }

  return rules;
};

router.get("/users", async (req, res) => {
  const filter = (req.query.filter as string) || "all";

  let query = supabase
    .from(SUPABASE_TABLE)
    .select(
      "id, name, email, phone, kvkk_accepted, comms_accepted, welcome_sent"
    );

  const rules = buildFilter(filter);
  rules.forEach((rule) => {
    query = query.eq(rule.column as string, rule.value);
  });

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    logger.error("Kullanicilar cekilemedi", error);
    return res
      .status(500)
      .json({ message: "Kullanicilar cekilemedi", detail: error.message });
  }

  return res.json({ users: data || [] });
});

router.post("/messages", async (req, res) => {
  const filter = (req.body?.filter as string) || "all";
  const message = (req.body?.message as string) || "";
  const selectedIds = Array.isArray(req.body?.selectedIds)
    ? (req.body.selectedIds as Array<string | number>)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
    : [];
  const templateName = (req.body?.templateName as string) || "";
  const templateLanguage = (req.body?.templateLanguage as string) || "en_US";
  const templateHeaderImage =
    (req.body?.templateHeaderImage as string) || undefined;

  if (!message.trim()) {
    return res.status(400).json({ message: "Mesaj metni gerekli" });
  }

  logger.info("Mesaj gonderim istegi alindi", {
    filter,
    selectedIds,
    messagePreview: message.slice(0, 80),
    templateName: templateName || undefined,
    templateLanguage: templateName ? templateLanguage : undefined,
    templateHeaderImage,
  });

  let query = supabase
    .from(SUPABASE_TABLE)
    .select("id, name, phone, email, kvkk_accepted, comms_accepted");

  if (selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  } else {
    const rules = buildFilter(filter);
    rules.forEach((rule) => {
      query = query.eq(rule.column as string, rule.value);
    });
    // Iletisim ve KVKK korumasi
    query = query.eq("kvkk_accepted", true);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("Alıcılar cekilemedi", error);
    return res
      .status(500)
      .json({ message: "Alıcılar cekilemedi", detail: error.message });
  }

  const recipients = data || [];
  let sent = 0;
  const failures: Array<{ id?: string; reason: string }> = [];
  const results: Array<{ id?: string; success: boolean; detail?: string }> = [];

  for (const user of recipients) {
    if (!user.phone) {
      failures.push({ id: user.id, reason: "Telefon yok" });
      results.push({ id: user.id, success: false, detail: "Telefon yok" });
      continue;
    }

    const result = templateName
      ? await sendTemplateWhatsApp(
          user.phone,
          templateName,
          templateLanguage || "en_US",
          templateHeaderImage
            ? [
                {
                  type: "header",
                  parameters: [
                    {
                      type: "image",
                      image: { link: templateHeaderImage },
                    },
                  ],
                },
              ]
            : []
        )
      : await sendWhatsAppMessage(user.phone, message);
    if (result.success) {
      sent += 1;
      results.push({ id: user.id, success: true, detail: result.detail });
    } else {
      failures.push({
        id: user.id,
        reason: result.detail || "Gonderim hatasi",
      });
      results.push({
        id: user.id,
        success: false,
        detail: result.detail || "Gonderim hatasi",
      });
    }
  }

  logger.info("Mesaj gonderim sonucu", {
    total: recipients.length,
    sent,
    failures,
  });

  return res.json({
    total: recipients.length,
    sent,
    failures,
    results,
  });
});

router.post("/manual-welcome", async (req, res) => {
  const { email, phone, name } = req.body as {
    email?: string;
    phone?: string;
    name?: string;
  };

  if (!email && !phone) {
    return res
      .status(400)
      .json({ message: "Email veya telefon bilgisi gerekli" });
  }

  const whatsapp = phone ? await sendWelcomeWhatsApp(name || null, phone) : false;
  const mail = email ? await sendWelcomeEmail(email, name || null) : false;

  return res.json({ whatsapp, mail });
});

export default router;

