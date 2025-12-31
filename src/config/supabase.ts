import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error("Supabase config eksik. SUPABASE_URL ve anahtar gerekli.");
  throw new Error("Supabase config eksik");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "users";

