# Support chatbot — Implementation Plan

**Goal:** Widget in-app + Claude API + WhatsApp handoff.

## Tasks

1. Install `@anthropic-ai/sdk`
2. `src/lib/support-prompt.ts` — system prompt produit
3. `POST /api/support/chat` — auth + Claude
4. `SupportChat.tsx` — UI widget
5. Mount in `(app)/layout.tsx`
6. Exclude `api/support` in `proxy.ts`
7. Build verify
