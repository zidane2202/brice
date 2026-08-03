# Company Branding + App Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher nom + logo entreprise (live) sur sidebar et facture ; upload Storage prioritaire sinon URL ; favicon navigateur = S subresell.

**Architecture:** Colonne `user_profiles.logo_url` + bucket public `logos`. Actions `uploadCompanyLogo` / `removeCompanyLogo` / `updateProfile` enrichi. Layout passe marque a `Sidebar` ; `/facture/[code]` charge le profil du vendeur. `src/app/icon.tsx` genere le favicon S.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres + Storage, Server Actions

## Global Constraints

- UI francaise ; devise FCFA inchangee
- Upload prioritaire sur URL manuelle ; max 2 Mo ; types png/jpeg/webp
- Affichage live depuis profil (pas de snapshot logo sur invoices)
- Favicon = marque app S, jamais le logo entreprise
- AdminSidebar reste subresell + S
- Travailler sur main (demande utilisateur)
- Appliquer SQL + creer bucket dans Supabase dashboard en plus du fichier schema.sql

---

## File Map

**Create:**
- `src/app/icon.tsx`
- `src/lib/branding.ts`
- `src/lib/branding.test.ts`
- `src/components/BrandMark.tsx`

**Modify:**
- `supabase/schema.sql`
- `src/lib/types.ts`
- `src/app/actions/profile.ts`
- `src/components/profil/ProfilView.tsx`
- `src/components/Sidebar.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/facture/[code]/page.tsx`

---

### Task 1: Schema + types + helpers

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/types.ts`
- Create: `src/lib/branding.ts`
- Create: `src/lib/branding.test.ts`

**Interfaces:**
- Produces: `UserProfile` with `company_name`, `logo_url`, profile fields ; `resolveBrandName` ; `resolveBrandLogoUrl` ; `LOGO_MAX_BYTES` ; `isAllowedLogoMime` ; `logoObjectPath` ; `LOGO_BUCKET`

- [ ] **Step 1: Add migration in schema.sql**

```sql
alter table public.user_profiles add column if not exists logo_url text;
```

Also document near it: create public Storage bucket `logos`, path `{user_id}/logo.{ext}`, owner-only write, public read.

- [ ] **Step 2: Extend UserProfile in types.ts**

```ts
export type UserProfile = {
  id: string;
  user_id: string;
  role: UserRole;
  plan: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  city: string | null;
  logo_url: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Write failing tests in branding.test.ts**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedLogoMime, resolveBrandLogoUrl, resolveBrandName } from "./branding";

test("resolveBrandName prefers company_name", () => {
  assert.equal(resolveBrandName({ company_name: " Acme " }, "subresell"), "Acme");
});

test("resolveBrandName fallback", () => {
  assert.equal(resolveBrandName({ company_name: null }, "SnapFacture"), "SnapFacture");
  assert.equal(resolveBrandName({ company_name: "  " }, null), "subresell");
});

test("resolveBrandLogoUrl", () => {
  assert.equal(resolveBrandLogoUrl({ logo_url: "https://x/a.png" }), "https://x/a.png");
  assert.equal(resolveBrandLogoUrl({ logo_url: "  " }), null);
  assert.equal(resolveBrandLogoUrl({ logo_url: null }), null);
});

test("isAllowedLogoMime", () => {
  assert.equal(isAllowedLogoMime("image/png"), true);
  assert.equal(isAllowedLogoMime("image/jpeg"), true);
  assert.equal(isAllowedLogoMime("image/webp"), true);
  assert.equal(isAllowedLogoMime("application/pdf"), false);
});
```

- [ ] **Step 4: Run tests expect FAIL**

Run: `npx --yes tsx --test src/lib/branding.test.ts`

- [ ] **Step 5: Implement branding.ts**

```ts
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_BUCKET = "logos";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAllowedLogoMime(mime: string): boolean {
  return ALLOWED.has(mime);
}

export function resolveBrandName(
  profile: { company_name?: string | null } | null | undefined,
  fallback?: string | null
): string {
  const name = profile?.company_name?.trim();
  if (name) return name;
  const fb = fallback?.trim();
  if (fb) return fb;
  return "subresell";
}

export function resolveBrandLogoUrl(
  profile: { logo_url?: string | null } | null | undefined
): string | null {
  const url = profile?.logo_url?.trim();
  return url || null;
}

export function logoObjectPath(userId: string, mime: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${userId}/logo.${ext}`;
}
```

- [ ] **Step 6: Run tests expect PASS**

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts src/lib/branding.ts src/lib/branding.test.ts
git commit -m "feat(branding): add logo_url schema and brand helpers"
```

---

### Task 2: Profile server actions

**Files:**
- Modify: `src/app/actions/profile.ts`

**Interfaces:**
- Consumes: LOGO_BUCKET, LOGO_MAX_BYTES, isAllowedLogoMime, logoObjectPath
- Produces: updateProfile also saves logo_url ; uploadCompanyLogo ; removeCompanyLogo

- [ ] **Step 1: Enrich updateProfile** to read `logo_url` from FormData (trim, empty -> null), include in update, revalidate `/profil` and `revalidatePath("/", "layout")`.

- [ ] **Step 2: Add uploadCompanyLogo**

Validate file present, mime, size <= LOGO_MAX_BYTES. Upload to Storage path via createSupabaseAdmin with upsert. getPublicUrl + cache-bust `?v=timestamp`. Update user_profiles.logo_url. Return `{ success, logoUrl }` or `{ error }`.

- [ ] **Step 3: Add removeCompanyLogo**

Best-effort remove `{userId}/logo.png|jpg|webp`. Set logo_url null. Revalidate profil + layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/profile.ts
git commit -m "feat(branding): add logo upload and profile logo_url update"
```

---

### Task 3: Profil UI brand section

**Files:**
- Modify: `src/components/profil/ProfilView.tsx`

**Interfaces:**
- Consumes: uploadCompanyLogo, removeCompanyLogo, updateProfile ; profile.logo_url

- [ ] **Step 1: Extend local profile type with logo_url**

- [ ] **Step 2: Update company_name hint** to: `Apparait sur les factures et dans la barre laterale.`

- [ ] **Step 3: Add Marque section** near company_name: preview 48x48, file input calling uploadCompanyLogo, logo_url field in updateProfile form, remove button, note that upload overrides manual URL. Match FormRow/panel styles.

- [ ] **Step 4: Smoke on /profil after bucket exists**

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfilView.tsx
git commit -m "feat(branding): add brand section on profile"
```

---

### Task 4: BrandMark + Sidebar + layout

**Files:**
- Create: `src/components/BrandMark.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Produces: BrandMark({ logoUrl, name, size? })
- Sidebar props: companyName?, logoUrl?

- [ ] **Step 1: Create BrandMark** client component: img with onError fallback to S gradient badge (same look as current sidebar S).

- [ ] **Step 2: Sidebar** use BrandMark; eyebrow = companyName trim or `subresell`.

- [ ] **Step 3: layout** pass companyName={profile?.company_name} logoUrl={profile?.logo_url}.

- [ ] **Step 4: Commit**

```bash
git add src/components/BrandMark.tsx src/components/Sidebar.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(branding): show company mark in operator sidebar"
```

---

### Task 5: Invoice live branding

**Files:**
- Modify: `src/app/facture/[code]/page.tsx`

**Interfaces:**
- Consumes: resolveBrandName, resolveBrandLogoUrl

- [ ] **Step 1: After getInvoice**, select user_profiles company_name, logo_url for invoice.user_id.

- [ ] **Step 2: Header + De party** use brandName and optional img logo (40x40). Fallback reseller_name / subresell via resolveBrandName.

- [ ] **Step 3: Commit**

```bash
git add "src/app/facture/[code]/page.tsx"
git commit -m "feat(branding): show live company brand on invoice"
```

---

### Task 6: Favicon S

**Files:**
- Create: `src/app/icon.tsx`

- [ ] **Step 1: Create icon.tsx** with next/og ImageResponse, 32x32, mint gradient, letter S.

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
          color: "#042f2e",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 6,
        }}
      >
        S
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Verify browser tab shows S**

- [ ] **Step 3: Commit**

```bash
git add src/app/icon.tsx
git commit -m "feat(branding): add subresell S favicon"
```

---

### Task 7: Build + smoke

- [ ] **Step 1:** `npx --yes tsx --test src/lib/branding.test.ts` — all PASS
- [ ] **Step 2:** `npm run build` — OK
- [ ] **Step 3: Checklist** after remote SQL + bucket `logos`: company name, upload, remove, manual URL, favicon S, admin sidebar unchanged, broken image fallback
- [ ] **Step 4: Commit fixes only if needed**

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| logo_url column | 1 |
| Storage upload / URL | 2, 3 |
| Sidebar brand | 4 |
| Invoice live | 5 |
| Favicon S | 6 |
| Admin unchanged | 4 (no AdminSidebar edit) |
| Build / smoke | 7 |
