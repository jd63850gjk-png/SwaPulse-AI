import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { MiloError } from "@/lib/milo/errors";

export type DemoSession = {
  user: User;
  facility: string;
  facilityId: string;
};

/**
 * Establishes an anonymous Supabase session when the request has no session,
 * then joins that user to the seeded facility through the existing RPC.
 */
export async function ensureDemoSession(client: SupabaseClient): Promise<DemoSession> {
  const { data: userData } = await client.auth.getUser();
  let user = userData.user;

  if (!user) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      throw new MiloError("AUTHENTICATION_FAILED", 502, "A guest session could not be started.");
    }
    user = data.user;
  }

  const { data: facility, error } = await client.rpc("join_demo_facility");
  if (error) {
    throw new MiloError(
      "DEMO_FACILITY_JOIN_FAILED",
      502,
      "The demo facility could not be loaded.",
    );
  }

  if (typeof facility !== "string" || facility.trim().length === 0) {
    throw new MiloError(
      "DEMO_FACILITY_JOIN_FAILED",
      502,
      "The demo facility could not be loaded.",
    );
  }

  return { user, facility, facilityId: facility };
}
