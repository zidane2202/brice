import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const prefix = "enc:v1:";
const secret = process.env.PROVIDER_CREDENTIALS_KEY;
if (!secret || secret.length < 32) throw new Error("PROVIDER_CREDENTIALS_KEY manquante ou trop courte");
const key = createHash("sha256").update(secret).digest();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: accounts, error } = await supabase.from("provider_accounts").select("id, account_password").not("account_password", "is", null);
if (error) throw error;
let migrated = 0;
for (const account of accounts ?? []) {
  if (!account.account_password || account.account_password.startsWith(prefix)) continue;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(account.account_password, "utf8"), cipher.final()]);
  const value = `${prefix}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
  const { error: updateError } = await supabase.from("provider_accounts").update({ account_password: value }).eq("id", account.id);
  if (updateError) throw updateError;
  migrated++;
}
console.log(`${migrated} identifiant(s) fournisseur chiffré(s).`);
