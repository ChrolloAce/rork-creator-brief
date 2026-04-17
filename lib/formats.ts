import type { Format } from "./types";
import { rorkVideos } from "./rork-videos";

// 7 creator-facing formats. Each pulls its examples from the best-fit bucket
// in rork-videos.ts (ViewTrack Rork Research, sorted by views). Thumbnail =
// top-viewed example of that bucket.

const pick = (bucket: string) => rorkVideos[bucket] ?? [];
const topThumb = (bucket: string) =>
  rorkVideos[bucket]?.[0]?.thumbnail ?? undefined;

export const formats: Format[] = [
  {
    slug: "talking-head",
    title: "Talking Head",
    thumbnail: topThumb("talking-head"),
    tagline: "Your face, your hook, your voice — nothing else in the frame",
    description:
      "Pure creator-on-camera. You address the viewer, deliver a hook, and carry the whole video with your delivery. No screen-rec dependency. Lives or dies by the first 2 seconds.",
    bestFor: [
      "Creators with an existing audience that trusts their voice",
      "Regret-reveal and \"someone showed me\" hook types",
      "Story-driven accounts (founder journey, student building apps)",
    ],
    structure: [
      "0–2s: Hook. Face in frame, bold claim or curiosity gap. Text-on-screen reinforces the line.",
      "2–10s: Setup. Who you are, why this matters to the viewer.",
      "10–35s: The reveal. Brief B-roll of the Rork screen cut over your voice.",
      "35–50s: The result. A screenshot, number, or shipped App Store listing.",
      "50–60s: Closing line + soft CTA (link in bio, comment for link).",
    ],
    tips: [
      "Record the hook 5–10 times. Pick the take with the most energy.",
      "Eye contact with the lens, not the screen.",
      "One idea per video. Don't stack features + pricing + story.",
      "Keep B-roll to a supporting role — your face is the format.",
    ],
    hookCategorySlugs: ["regret-reveal", "someone-showed-me", "comparison"],
    examples: pick("talking-head"),
  },
  {
    slug: "snapchat-hook-reaction",
    title: "Snapchat Hook + Reaction",
    thumbnail: topThumb("snapchat-hook-reaction"),
    tagline: "Snapchat-style selfie hook → reveal → \"comment [keyword]\" CTA — 1.4M-view territory",
    description:
      "Shot in the Snapchat camera (or vertical selfie view) with a bold text-on-screen hook, then either a swap to the screen or a reveal of the product, closing with \"comment [keyword] and I'll send you the link.\" @ernestosoftware's format — his top post hit 1.4M views.",
    bestFor: [
      "Building a warm Rork DM list (comment-for-link converts)",
      "Creators with strong on-camera energy + Snapchat/iOS camera aesthetic",
      "Any post where Rork itself is the hook",
    ],
    structure: [
      "0–2s: Snapchat selfie frame. Big text-on-screen hook across your face. Energy high.",
      "2–6s: Say the hook out loud. Point at something off-screen to cue the swap.",
      "6–8s: Cut or swap to the Rork screen — prompt bar visible, already typing.",
      "8–22s: Rork building an app. Fast cuts, minimal narration.",
      "22–28s: Back to your face. \"Comment 'Rork' and I'll send you the link.\"",
      "28–30s: Repeat the keyword once more. End.",
    ],
    tips: [
      "The keyword has to be ONE word. \"Rork.\" Not \"AI app builder.\"",
      "Show the DM reply preview on camera — sets expectation + reduces bounce.",
      "Automate the DMs (ManyChat or similar) — manual replies break at scale.",
      "Reply to every comment publicly with \"check your DMs\" — threaded replies juice the algo.",
    ],
    hookCategorySlugs: ["curious-creator", "someone-showed-me"],
    examples: pick("snapchat-hook-reaction"),
  },
  {
    slug: "reaction-plus-demo",
    title: "Reaction + Demo",
    tagline: "You discover Rork in real time — the reaction carries the video",
    thumbnail: topThumb("reaction-plus-demo"),
    description:
      "You open Rork \"for the first time\" on camera. Type a prompt, wait, react to what it builds. The viewer rides your surprise with you. Low production, high trust.",
    bestFor: [
      "Warm audiences who trust your recommendations",
      "Follow-up content after a viral first-impression post",
      "Creators in the AI-tools / productivity niche",
    ],
    structure: [
      "0–3s: Low-energy intro. \"Okay I'm trying this thing people keep telling me about.\"",
      "3–10s: Screen on camera. Type a prompt you genuinely care about.",
      "10–25s: Cuts between your face (reactions) and the screen (Rork building).",
      "25–40s: Working app. Press buttons on the device. Show it's real.",
      "40–50s: Honest verdict. \"Not sponsored, I'm genuinely confused this works.\"",
    ],
    tips: [
      "Quiet energy beats hype here. Don't shout.",
      "Pick a prompt relevant to YOUR niche — not a generic \"build me Instagram.\"",
      "Show the wait. Don't cut out the thinking time — that's where the trust is.",
      "Name the tool clearly at the end. Link in bio.",
    ],
    hookCategorySlugs: ["unintentional-find", "someone-showed-me"],
    examples: pick("reaction-plus-demo"),
  },
  {
    slug: "split-screen",
    title: "Split Screen",
    tagline: "You on one side, Rork on the other — personality and proof at once",
    description:
      "Two frames simultaneously. Your face on the left (or top), Rork's screen recording on the right (or bottom). Viewers get your reactions AND the real-time build at the same time.",
    bestFor: [
      "Creators with expressive reactions",
      "Build-along content where face + screen both matter",
      "Longer forms where sustained engagement is the goal",
    ],
    structure: [
      "0–3s: Both frames live. Hook text across the top of both.",
      "3–15s: Your face narrates intent while Rork screen starts typing.",
      "15–35s: Screen side does the work. Your face reacts at key moments.",
      "35–50s: Both frames show the finished app — you holding a phone running it.",
      "50–60s: Reaction close. One line + CTA.",
    ],
    tips: [
      "Use Descript, CapCut, or Instagram's native split screen template.",
      "Keep ratios consistent — phones clip side-by-side frames awkwardly, try top/bottom.",
      "Your face needs to be doing SOMETHING the whole time. Static face = dead space.",
      "The screen side should hit the payoff right when you react — sync is the magic.",
    ],
    hookCategorySlugs: ["curious-creator", "impossible-claim"],
    examples: [],
  },
  {
    slug: "building-page",
    title: "Building Page",
    thumbnail: topThumb("building-page"),
    tagline: "Full-screen build-along. Prompt in, working app out.",
    description:
      "100% screen recording, minimal talking. Type a prompt, watch Rork build, show the working app on device. Speed-ramp the middle. The product IS the content — @alitrek0's 1.4M-view formula.",
    bestFor: [
      "Technical creators who'd rather show than talk",
      "SEO strategy — captions carrying the story",
      "YouTube Shorts + long-form versions",
    ],
    structure: [
      "0–3s: Hook frame. Timer appears. \"I'm going to build X in Y minutes.\"",
      "3–10s: Type the prompt on camera. No edit — raw typing is the authenticity.",
      "10–40s: Rork building. Speed up 2–3x. Keep the timer visible in the corner.",
      "40–55s: App running on a physical device. Press buttons. Demonstrate it works.",
      "55–60s: Timer stops. Display the final time. No voiceover needed.",
    ],
    tips: [
      "The prompt you type IS the hook. Make it specific and relatable.",
      "A visible running timer is non-negotiable — it's the proof.",
      "Don't cut out the wait. The tension during Rork's thinking is the payoff.",
      "Export at native vertical resolution. No letterboxing.",
    ],
    hookCategorySlugs: ["impossible-claim", "curious-creator"],
    examples: pick("building-page"),
  },
  {
    slug: "top-three-websites",
    title: "Top Three Websites",
    thumbnail: topThumb("top-three-websites"),
    tagline: "Numbered list, fast cuts — proven 400–700k view format",
    description:
      "Rapid-fire list of 3 tools, 5–8 seconds each. Put Rork in the #3 slot (highest conversion). Viewers commit because they know exactly how long it'll be. @1ukas.online has made this a 700k-per-video machine.",
    bestFor: [
      "College / productivity / study-hack niches",
      "Creators with a consistent weekly posting cadence",
      "Blending Rork with 2 adjacent tools so it doesn't feel like an ad",
    ],
    structure: [
      "0–3s: Hook: \"3 websites you need right now.\" No lead-up.",
      "3–10s: Website #1 — name on screen, one-liner value, 3s screen rec.",
      "10–17s: Website #2 — same exact rhythm. Pace is the hook.",
      "17–25s: Website #3 — the one you actually want to push. Rork goes here.",
      "25–30s: Summary card with all 3 names + save prompt.",
    ],
    tips: [
      "Always 3. Not 5, not 7. Three = best completion rate.",
      "Pick a niche and commit — \"for students\" beats \"for everyone.\"",
      "Reuse the same intro beat across the series — pattern recognition compounds.",
      "Slot #3 converts best — viewers stuck around for the reveal.",
    ],
    hookCategorySlugs: ["someone-showed-me", "impossible-claim"],
    examples: pick("top-three-websites"),
  },
  {
    slug: "visual-hook-plus-device",
    title: "Visual Hook + Device",
    thumbnail: topThumb("visual-hook-plus-device"),
    tagline: "Big on-screen hook + device in frame — @jakeezytech's 1.5M-view pattern",
    description:
      "A phone or laptop in frame showing the Rork output, paired with a strong visual hook overlay (arrows, text, shapes). Aesthetic, punchy, scroll-stopping. @jakeezytech's \"secret website\" format lives here.",
    bestFor: [
      "Creators who shoot clean product/device footage",
      "Repeatable weekly series (part 34, part 77 — numbers build retention)",
      "Niche-specific use cases (\"secret website to do X\")",
    ],
    structure: [
      "0–2s: Device in frame + big text-on-screen hook. \"Secret website to [do thing].\"",
      "2–6s: Tight on the device showing Rork's URL / prompt bar. Don't reveal the output yet.",
      "6–22s: Screen rec of Rork building. Intercut with device-in-hand shots.",
      "22–28s: Working app on the device. One clean line on why this is wild.",
      "28–30s: Save prompt. \"Save this for later.\"",
    ],
    tips: [
      "Specificity wins. \"Watch PS2 games in browser\" beats \"games website.\"",
      "Number your posts as a series — @jakeezytech's retention trick.",
      "Zoom in on the device — tiny screens read poorly in feed.",
      "Always close with a save/bookmark prompt — saves juice the algo.",
    ],
    hookCategorySlugs: ["curious-creator", "unintentional-find"],
    examples: pick("visual-hook-plus-device"),
  },
];
