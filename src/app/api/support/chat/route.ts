import Anthropic from "@anthropic-ai/sdk";
import { buildSupportSystemPrompt } from "@/lib/support-prompt";
import { createSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 2000;

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!await consumeRateLimit(`${user.id}:${requestIp(request)}`, "support-chat", 30, 60)) {
    return NextResponse.json({ error: "Trop de messages. Réessayez dans une minute." }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Le support est temporairement indisponible." },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages = raw
    .filter(
      (m): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_CONTENT_LEN),
    }));

  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Message utilisateur requis" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: buildSupportSystemPrompt(),
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Réponse vide" }, { status: 502 });
    }

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("[support/chat]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Le support a rencontré une erreur. Veuillez réessayer dans quelques instants." },
      { status: 502 }
    );
  }
}
