import { LandingPage } from "@/components/landing/LandingPage";
import { getUser } from "@/lib/supabase-server";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  const locale = await getLocale();
  return <LandingPage locale={locale} />;
}
