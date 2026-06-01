// Verse-card backgrounds. Each verse card is white text centered over a
// darkened photo; the only choice is which photo. The picker (public page)
// and the renderer (app/api/verse-card/route.tsx) both read this list, so
// keys stay in sync. Pass a key as ?style= to the verse-card route.
export type VerseBackground = { key: string; label: string; url: string };

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1080&h=720&q=70`;

export const VERSE_BACKGROUNDS: VerseBackground[] = [
  { key: "mountains", label: "Mountains", url: photo("1506905925346-21bda4d32df4") },
  { key: "forest", label: "Misty Forest", url: photo("1470071459604-3b5ec3a7fe05") },
  { key: "sky", label: "Starry Sky", url: photo("1419242902214-272b3f66ee7a") },
  { key: "sunlight", label: "Forest Light", url: photo("1441974231531-c6227db76b6e") },
  { key: "beach", label: "Beach", url: photo("1507525428034-b723cf961d3e") },
  { key: "clouds", label: "Clouds", url: photo("1444703686981-a3abbc4d4fe3") },
  { key: "valley", label: "Valley", url: photo("1497436072909-60f360e1d4b1") },
  { key: "golden", label: "Golden Hour", url: photo("1490730141103-6cac27aaab94") },
];

// Resolve a background key to its definition; unknown/legacy keys fall back to
// the first background so old stored verses still render.
export function verseBackground(key: string): VerseBackground {
  return VERSE_BACKGROUNDS.find((b) => b.key === key) ?? VERSE_BACKGROUNDS[0];
}

// Pick a random background key (used by the "Random" button in the picker).
export function randomBackgroundKey(): string {
  return VERSE_BACKGROUNDS[Math.floor(Math.random() * VERSE_BACKGROUNDS.length)].key;
}
