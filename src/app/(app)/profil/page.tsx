import { updateProfile } from "@/app/actions/profile";
import { ProfileForm } from "@/components/ProfileForm";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = createSupabaseAdmin();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Compte</p>
          <h1>Mon profil</h1>
        </div>
      </div>

      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="panel">
          <div>
            <p className="eyebrow">Informations</p>
            <h2>Mes informations</h2>
          </div>
          <ProfileForm profile={profile} email={user.email ?? ""} action={updateProfile} />
        </div>

        <div className="panel">
          <div>
            <p className="eyebrow">Compte</p>
            <h2>Détails du compte</h2>
          </div>
          <div className="fields">
            <div>
              <label style={{ marginBottom: 4 }}>Email</label>
              <p style={{ fontWeight: 600 }}>{user.email}</p>
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Plan</label>
              <span className="status active">{profile?.plan ?? "free"}</span>
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Membre depuis</label>
              <p style={{ fontWeight: 600 }}>
                {new Date(user.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <label style={{ marginBottom: 4 }}>Rôle</label>
              <span className="status active">{profile?.role ?? "reseller"}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
