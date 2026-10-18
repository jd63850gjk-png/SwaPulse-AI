import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/server/env";

export type ServerSupabaseContext = {
  client: SupabaseClient;
  responseHeaders: Headers;
};

/**
 * Creates a new cookie-backed Supabase client for one request.
 * The anon key is intentionally the only Supabase key this server module reads.
 */
export async function createRequestSupabaseClient(): Promise<ServerSupabaseContext> {
  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  const cookieStore = await cookies();
  const responseHeaders = new Headers();

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route handlers can write cookies. This fallback keeps the client
          // usable if Next has already made the request cookie store readonly.
        }

        Object.entries(headers).forEach(([name, value]) => {
          responseHeaders.set(name, value);
        });
      },
    },
  });

  return { client, responseHeaders };
}
