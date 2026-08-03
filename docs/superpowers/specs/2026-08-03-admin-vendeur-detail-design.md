# Fiche vendeur admin — Design Spec

**Date:** 2026-08-03  
**Route:** `/admin/vendeurs/[id]` (`id` = `user_id`)

## Objectif

Page admin lecture complète d’un revendeur + actions plan / rôle.

## Architecture

- Guard admin via `proxy.ts` existant
- Data: `createSupabaseAdmin` — profil, email auth, subscriptions, clients, provider_accounts, transactions, invoices, solde
- Actions: `src/app/actions/admin.ts` — `updateResellerPlanRole(formData)` (ou deux actions)
- Plan: `free` | `pro` ; Role: `reseller` | `admin`
- Interdit: admin qui retire son propre rôle admin

## UI

1. Header (nom, entreprise, email, ville, inscrit) + retour liste  
2. KPIs: clients actifs, comptes actifs, solde, income total, nb factures  
3. Panel réglages: plan + rôle + enregistrer  
4. Tables: comptes provider, abonnements, txs (20), factures (10) avec lien facture  

## Hors V1

Suspension, impersonation, edit métier vendeur.
