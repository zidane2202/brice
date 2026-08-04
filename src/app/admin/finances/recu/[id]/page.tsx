import { notFound } from "next/navigation";
import { PrintButton } from "@/components/comptabilite/PrintButton";
import { PLATFORM_PAYMENT_KIND_LABELS, type PlatformPaymentKind } from "@/lib/platform-payments";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PlatformReceiptPage({ params }: { params: Promise<{ id:string }> }) {
  const { id } = await params; const db=createSupabaseAdmin();
  const { data:payment }=await db.from("platform_payments").select("id,reseller_user_id,amount,kind,note,occurred_on,recorded_by,applied_plan,applied_extras,created_at").eq("id",id).maybeSingle();
  if(!payment)notFound();
  const [{data:profile},{data:resellerAuth},{data:adminAuth},{data:reversal}]=await Promise.all([
    db.from("user_profiles").select("first_name,last_name,company_name,phone,city").eq("user_id",payment.reseller_user_id).maybeSingle(),
    db.auth.admin.getUserById(payment.reseller_user_id),db.auth.admin.getUserById(payment.recorded_by),
    db.from("platform_payment_reversals").select("reason,created_at").eq("payment_id",payment.id).maybeSingle(),
  ]);
  const reseller=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||profile?.company_name||resellerAuth.user?.email||"Vendeur";
  const reference=`SR-${payment.id.slice(0,8).toUpperCase()}`; const kind=PLATFORM_PAYMENT_KIND_LABELS[payment.kind as PlatformPaymentKind]??payment.kind;
  return <main className="platform-receipt-page"><div className="platform-receipt-toolbar print-hide"><a href="/admin/finances" className="secondary">← Retour aux finances</a><PrintButton/></div><article className="platform-receipt"><header><div><p className="eyebrow">SubResell</p><h1>Reçu d’encaissement</h1><span>{reference}</span></div><div className={`receipt-status${reversal?" receipt-status--cancelled":""}`}>{reversal?"ANNULÉ":"PAYÉ"}</div></header><section className="receipt-parties"><div><small>REÇU DE</small><strong>Plateforme SubResell</strong><span>{adminAuth.user?.email??"Administration"}</span></div><div><small>REÇU POUR</small><strong>{reseller}</strong><span>{resellerAuth.user?.email}</span>{profile?.phone&&<span>{profile.phone}</span>}</div></section><section className="receipt-line"><div><small>MOTIF</small><strong>{kind}</strong>{payment.applied_plan&&<span>Plan appliqué : {payment.applied_plan}</span>}{payment.kind==="extra_accounts"&&<span>Comptes extras après paiement : {payment.applied_extras??0}</span>}</div><div><small>DATE</small><strong>{new Date(payment.occurred_on+"T12:00:00").toLocaleDateString("fr-FR",{dateStyle:"long"})}</strong></div><div className="receipt-amount"><small>MONTANT</small><strong>{Number(payment.amount).toLocaleString("fr-FR")} FCFA</strong></div></section>{payment.note&&<div className="receipt-note"><small>NOTE / RÉFÉRENCE DE PAIEMENT</small><p>{payment.note}</p></div>}{reversal&&<div className="receipt-cancelled"><strong>Encaissement annulé</strong><p>{reversal.reason}</p></div>}<footer><span>Merci pour votre confiance.</span><span>Généré le {new Date().toLocaleDateString("fr-FR")}</span></footer></article></main>;
}
