# Support chatbot Claude — Design Spec

**Date:** 2026-08-03  
**Statut:** Validé

## Objectif

Aide in-app pour les vendeurs connectés : chatbot Claude + passage humain WhatsApp + contact.

## V1

- Widget flottant dans le layout app vendeur `(app)`
- `POST /api/support/chat` (auth session requise)
- Contexte produit en system prompt (plans, limites, features)
- Historique messages en mémoire client uniquement
- Boutons **Parler à un humain** / **Nous contacter** → WhatsApp (`NEXT_PUBLIC_SUPPORT_WHATSAPP`)
- Si le bot ne sait pas → propose le handoff

## Hors V1

- Chatbot landing
- Inbox admin / tickets
- RAG fichiers / embeddings
- Persistance conversations en DB

## Env

- `ANTHROPIC_API_KEY` (server only)
- `NEXT_PUBLIC_SUPPORT_WHATSAPP` (déjà en place)

## Fichiers

| Fichier | Rôle |
|--|--|
| `src/components/SupportChat.tsx` | Widget UI |
| `src/app/api/support/chat/route.ts` | Claude |
| `src/lib/support-prompt.ts` | System prompt produit |
| `src/app/(app)/layout.tsx` | Monte le widget |
| `src/proxy.ts` | Exclure `/api/support` du redirect auth HTML |
