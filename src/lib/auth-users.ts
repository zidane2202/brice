import type { User } from "@supabase/supabase-js";
import type { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function listAllAuthUsers(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const users: User[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return users;
}
