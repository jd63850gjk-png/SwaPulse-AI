import "server-only";

import { MiloError } from "@/lib/milo/errors";

type ServerEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey?: string;
};

function requiredEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new MiloError(
      "CONFIGURATION_ERROR",
      503,
      "The SwaPulse data service is not configured.",
      { variable: name },
    );
  }

  return value;
}

export function getServerEnv(options: { requireGemini?: boolean } = {}): ServerEnv {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  if (options.requireGemini && !geminiApiKey) {
    throw new MiloError(
      "CONFIGURATION_ERROR",
      503,
      "Text command processing is not configured.",
      { variable: "GEMINI_API_KEY" },
    );
  }

  return { supabaseUrl, supabaseAnonKey, geminiApiKey };
}
