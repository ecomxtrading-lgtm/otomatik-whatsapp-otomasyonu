import cron from "node-cron";
import { supabase, SUPABASE_TABLE } from "../config/supabase";
import { sendWelcomeWhatsApp } from "../services/whatsappService";
import { sendWelcomeEmail } from "../services/mailService";
import { logger } from "../utils/logger";

export const registerRetryJob = () => {
  if (process.env.ENABLE_RETRY_CRON !== "true") {
    logger.info(
      "Retry cron pasif. ENABLE_RETRY_CRON=true yaparak aktiflestirilebilir."
    );
    return;
  }

  const expression = process.env.RETRY_CRON_EXPRESSION || "0 * * * *";

  cron.schedule(
    expression,
    async () => {
      logger.info("welcome_sent=false kullanicilar icin tekrar gonderim basladi");
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select("id, name, email, phone, kvkk_accepted, comms_accepted")
        .eq("welcome_sent", false)
        .limit(200);

      if (error) {
        logger.error("Cron: veri cekilemedi", error);
        return;
      }

      const users = data || [];
      for (const user of users) {
        if (!user.kvkk_accepted || !user.comms_accepted) continue;
        if (!user.phone && !user.email) continue;

        const whatsapp = user.phone
          ? await sendWelcomeWhatsApp(user.name || null, user.phone)
          : false;
        const mail = user.email
          ? await sendWelcomeEmail(user.email, user.name || null)
          : false;

        if (whatsapp || mail) {
          await supabase
            .from(SUPABASE_TABLE)
            .update({ welcome_sent: true })
            .match(user.id ? { id: user.id } : { email: user.email });
        }
      }
      logger.info("Cron: tekrar gonderim tamamlandi");
    },
    { timezone: "Europe/Istanbul" }
  );
};


