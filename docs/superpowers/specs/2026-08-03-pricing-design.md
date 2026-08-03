# Tarification SubResell — Spec produit

**Date:** 2026-08-03  
**Statut:** Validé (pas encore branché en code)

## Plans

| | Starter (Free) | Pro | Business |
|--|--|--|--|
| But | Tester | Revendeur actif | Agence / gros volume |
| Prix | 0 FCFA | **10 000 FCFA / mois** | **20–25 000 FCFA / mois** |
| Annuel (indicatif) | — | ~100 000 (2 mois offerts) | ~10 mois / 12 |
| Comptes provider | **2** | **15** + extras | Illimité* |
| Clients max / compte | **3** | **5** | Illimité* |
| Cap clients actifs | ~6 | **75** de base (+5 / compte extra) | Illimité* |
| Comptabilité | Lecture seule (KPIs / solde) | Complète + dépenses + CSV/PDF | + rapports avancés |
| Factures + logo | Facture basique (nom) | Logo + marque | Idem + multi-vendeurs plus tard |
| Rappels / push | Non | Oui | Oui |
| Support | Community | WhatsApp prioritaire | Dédié |

\*plafond soft anti-abus infra, pas marketing.

## Extras (Pro uniquement)

| Option | Prix / mois |
|--|--|
| +1 compte | **2 000 FCFA** |
| Pack +3 comptes | **5 000 FCFA** (économie 1 000 vs 3×2 000) |

Chaque compte extra ouvre **+5 clients** (même règle Pro).

Exemple : Pro + pack 3 = **15 000 FCFA/mois** → **18 comptes** × 5 clients.

## UX limite atteinte

Modal avec 3 choix :
1. Ajouter 1 compte (+2 000)
2. Ajouter 3 comptes (+5 000)
3. Passer Business

Pas de blocage silencieux.

## Données (implémentation future)

- `user_profiles.plan` : `free` | `pro` | `business`
- Compteur extras : ex. `extra_account_slots int default 0` (nombre de comptes au-delà du plafond plan)
- Ou table `plan_addons` (user_id, kind, quantity, price_fcfa)

## Hors scope immédiat

- Paiement MoMo / Wave
- Proration mid-cycle
- Facturation annuelle automatisée
