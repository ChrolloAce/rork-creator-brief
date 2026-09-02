import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  briefName?: string;
  formatTitle?: string;
  formatTagline?: string;
  formatDescription?: string;
  structure?: string[];
  tips?: string[];
  hooks?: string[];
  currentScript?: string;
  userPrompt?: string;
  // A finished script in the shape the output should match. The single
  // strongest lever on quality — structure alone tells the model what to say
  // but not how it should sound.
  example?: string;
  // Real videos that are working right now, pulled from ViewTrack in the
  // Research tab. These are evidence, not templates: they tell the model what
  // angle and pacing the audience is currently rewarding.
  research?: ResearchVideo[];
};

type ResearchVideo = {
  creator?: string;
  platform?: string;
  views?: number;
  url?: string;
  caption?: string;
  hook?: string;
  transcript?: string;
  whatWorked?: string[];
};

const SYSTEM_PROMPT = `You are a short-form video script writer for TikTok, Instagram Reels, and YouTube Shorts. You write scripts for creators promoting products to founder/builder audiences.

Output format — MANDATORY:
- One beat per line.
- Each line starts with a timestamp like "00:00", "00:03", "00:08".
- No markdown, no labels, no "Hook:" / "Scene:" prefixes, no stage directions in brackets — just timestamp + the line the creator says or the on-screen text.
- Total length 15–45 seconds unless the user asks otherwise.
- Punchy, conversational, no corporate phrasing. Sound like a real person, not an ad.
- Write in the same language as the format's description/current script (e.g. if the brief content is Spanish, the script must be Spanish) unless the user asks for a specific language.
- When reference videos are supplied, treat them as evidence of what the audience is responding to right now. Borrow the angle, the pacing, and the kind of hook that is working. Never lift their sentences, their specific claims, or their product details.

Output ONLY the script. No preamble, no commentary, no "Here's your script:".`;

function bulletList(items?: string[]): string {
  if (!items || items.length === 0) return "(none provided)";
  return items.map((t) => `- ${t}`).join("\n");
}

function compactNumber(n?: number): string {
  if (!n || n < 1000) return String(n ?? 0);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Reference videos, trimmed so a dozen of them can't crowd out the brief
// itself. Transcripts are the expensive part, so they are the part capped.
function researchBlock(videos?: ResearchVideo[]): string {
  const list = (videos ?? []).slice(0, 12);
  if (list.length === 0) return "";
  const entries = list.map((v, i) => {
    const head = [
      `### Reference ${i + 1}`,
      v.creator ? `Creator: @${v.creator.replace(/^@/, "")}` : null,
      v.platform ? `Platform: ${v.platform}` : null,
      v.views ? `Views: ${compactNumber(v.views)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const body = [
      v.hook?.trim() ? `Hook: ${v.hook.trim()}` : null,
      v.caption?.trim() ? `Caption: ${v.caption.trim().slice(0, 300)}` : null,
      v.whatWorked?.length ? `What worked:\n${bulletList(v.whatWorked)}` : null,
      v.transcript?.trim()
        ? `Transcript:\n${v.transcript.trim().slice(0, 1800)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    return `${head}\n${body}`;
  });
  return `\n## What is working right now
These are real videos from this niche with their live view counts. Study the angle and the shape of the hooks, then write something new in that vein. Do not copy their lines.

${entries.join("\n\n")}\n`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart.",
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const userPrompt = (body.userPrompt ?? "").trim();
  if (!userPrompt) {
    return new Response("userPrompt is required", { status: 400 });
  }

  const formatContext = `## Brief
${body.briefName ?? "(unnamed)"}

## Format
Title: ${body.formatTitle ?? "(unknown)"}
Tagline: ${body.formatTagline ?? ""}

Description:
${body.formatDescription ?? "(no description)"}

## Shot-by-shot structure
${bulletList(body.structure)}

## Tips
${bulletList(body.tips)}

## Proven hooks for this format
${bulletList(body.hooks)}`;

  const currentScriptBlock = body.currentScript?.trim()
    ? `\n## Current script (edit this)\n${body.currentScript.trim()}\n`
    : "";

  const research = researchBlock(body.research);

  const exampleBlock = body.example?.trim()
    ? `\n## Worked example
A finished script written to the structure above. Match its shape: same beats, same rhythm, same line lengths, same level of specificity. Match the shape, never the content — do not reuse its lines, its angle, or its details.

${body.example.trim()}\n`
    : "";

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: formatContext,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `${research}${exampleBlock}${currentScriptBlock}\n## Request\n${userPrompt}\n\nWrite the script now. Timestamps only, one beat per line, no preamble.`,
          },
        ],
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        await stream.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? `\n\n[Claude error ${err.status}: ${err.message}]`
            : `\n\n[Stream error: ${(err as Error).message}]`;
        controller.enqueue(encoder.encode(msg));
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
