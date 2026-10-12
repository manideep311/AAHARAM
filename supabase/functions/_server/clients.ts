import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Hosted functions expose the legacy SUPABASE_SERVICE_ROLE_KEY and/or the newer
// SUPABASE_SECRET_KEYS JSON dictionary (e.g. {"default":"sb_secret_..."}); accept either.
function firstKeyFromJson(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? firstKeyFromJson(Deno.env.get("SUPABASE_SECRET_KEYS"));
  if (!url || !key) throw new Error("SUPABASE_URL or the service key is not available to this function");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Returns the signed-in caller's user id, or null for anonymous/invalid tokens. */
export async function getCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
