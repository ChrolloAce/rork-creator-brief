import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Book table: bolls.life book id + English/Spanish names. Lookup accepts
// either language (accent-insensitive); Spanish fetches return the Spanish
// display name so verse cards read "Marcos 16:15", not "Mark 16:15".
const BOOKS: [number, string, string][] = [
  [1, "Genesis", "Génesis"],
  [2, "Exodus", "Éxodo"],
  [3, "Leviticus", "Levítico"],
  [4, "Numbers", "Números"],
  [5, "Deuteronomy", "Deuteronomio"],
  [6, "Joshua", "Josué"],
  [7, "Judges", "Jueces"],
  [8, "Ruth", "Rut"],
  [9, "1 Samuel", "1 Samuel"],
  [10, "2 Samuel", "2 Samuel"],
  [11, "1 Kings", "1 Reyes"],
  [12, "2 Kings", "2 Reyes"],
  [13, "1 Chronicles", "1 Crónicas"],
  [14, "2 Chronicles", "2 Crónicas"],
  [15, "Ezra", "Esdras"],
  [16, "Nehemiah", "Nehemías"],
  [17, "Esther", "Ester"],
  [18, "Job", "Job"],
  [19, "Psalms", "Salmos"],
  [20, "Proverbs", "Proverbios"],
  [21, "Ecclesiastes", "Eclesiastés"],
  [22, "Song of Solomon", "Cantares"],
  [23, "Isaiah", "Isaías"],
  [24, "Jeremiah", "Jeremías"],
  [25, "Lamentations", "Lamentaciones"],
  [26, "Ezekiel", "Ezequiel"],
  [27, "Daniel", "Daniel"],
  [28, "Hosea", "Oseas"],
  [29, "Joel", "Joel"],
  [30, "Amos", "Amós"],
  [31, "Obadiah", "Abdías"],
  [32, "Jonah", "Jonás"],
  [33, "Micah", "Miqueas"],
  [34, "Nahum", "Nahúm"],
  [35, "Habakkuk", "Habacuc"],
  [36, "Zephaniah", "Sofonías"],
  [37, "Haggai", "Hageo"],
  [38, "Zechariah", "Zacarías"],
  [39, "Malachi", "Malaquías"],
  [40, "Matthew", "Mateo"],
  [41, "Mark", "Marcos"],
  [42, "Luke", "Lucas"],
  [43, "John", "Juan"],
  [44, "Acts", "Hechos"],
  [45, "Romans", "Romanos"],
  [46, "1 Corinthians", "1 Corintios"],
  [47, "2 Corinthians", "2 Corintios"],
  [48, "Galatians", "Gálatas"],
  [49, "Ephesians", "Efesios"],
  [50, "Philippians", "Filipenses"],
  [51, "Colossians", "Colosenses"],
  [52, "1 Thessalonians", "1 Tesalonicenses"],
  [53, "2 Thessalonians", "2 Tesalonicenses"],
  [54, "1 Timothy", "1 Timoteo"],
  [55, "2 Timothy", "2 Timoteo"],
  [56, "Titus", "Tito"],
  [57, "Philemon", "Filemón"],
  [58, "Hebrews", "Hebreos"],
  [59, "James", "Santiago"],
  [60, "1 Peter", "1 Pedro"],
  [61, "2 Peter", "2 Pedro"],
  [62, "1 John", "1 Juan"],
  [63, "2 John", "2 Juan"],
  [64, "3 John", "3 Juan"],
  [65, "Jude", "Judas"],
  [66, "Revelation", "Apocalipsis"],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

const ALIASES: Record<string, number> = {
  psalm: 19,
  salmo: 19,
  "song of songs": 22,
  "cantar de los cantares": 22,
  revelations: 66,
};

function findBook(name: string): [number, string, string] | null {
  const n = norm(name);
  for (const b of BOOKS) {
    if (norm(b[1]) === n || norm(b[2]) === n) return b;
  }
  if (ALIASES[n]) return BOOKS.find((b) => b[0] === ALIASES[n]) ?? null;
  return null;
}

// Parse "Marcos 16:15" / "1 John 3:16-18" → { book, chapter, from, to }.
function parseRef(ref: string) {
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  const from = Number(m[3]);
  const to = m[4] ? Number(m[4]) : from;
  if (to < from || to - from > 9) return null;
  return { book, chapter, from, to };
}

// Spanish (Reina-Valera 1960) via bolls.life — bible-api.com has no Spanish.
async function fetchSpanish(ref: string) {
  const p = parseRef(ref);
  if (!p) {
    return NextResponse.json(
      { ok: false, error: "Couldn't parse that reference. Use e.g. \"Marcos 16:15\" or \"Mark 16:15\"." },
      { status: 404 }
    );
  }
  const parts: string[] = [];
  for (let v = p.from; v <= p.to; v++) {
    const r = await fetch(
      `https://bolls.life/get-verse/RV1960/${p.book[0]}/${p.chapter}/${v}/`,
      { cache: "no-store" }
    );
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Couldn't find that reference." },
        { status: 404 }
      );
    }
    const j = await r.json();
    const t = String(j?.text ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (t) parts.push(t);
  }
  if (parts.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No text found for that reference." },
      { status: 404 }
    );
  }
  const refOut = `${p.book[2]} ${p.chapter}:${p.from}${p.to > p.from ? `-${p.to}` : ""}`;
  return NextResponse.json({
    ok: true,
    reference: refOut,
    text: parts.join(" "),
    translation: "RVR1960",
  });
}

// Fetch a Bible verse by reference. English via the free bible-api.com;
// Spanish (translation=rvr1960 or es) via bolls.life.
// GET /api/bible?ref=John%203:16[&translation=web|rvr1960]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get("ref") ?? "").trim();
  const translation = (searchParams.get("translation") || "web").trim().toLowerCase();
  if (!ref) {
    return NextResponse.json({ ok: false, error: "missing reference" }, { status: 400 });
  }
  try {
    if (translation === "rvr1960" || translation === "es") {
      return await fetchSpanish(ref);
    }
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${encodeURIComponent(translation)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Couldn't find that reference." },
        { status: 404 }
      );
    }
    const j = await r.json();
    const text = (j?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "No text found for that reference." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      reference: j.reference ?? ref,
      text,
      translation: (j.translation_id ?? translation).toUpperCase(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
