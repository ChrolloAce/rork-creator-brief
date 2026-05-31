// Shared list of verse-card styles (keys + labels). The actual visual
// definitions live in app/api/verse-card/route.tsx; the public picker only
// needs the keys/labels.
export const VERSE_STYLES: { key: string; label: string }[] = [
  { key: "light", label: "Clean" },
  { key: "pink", label: "Pink" },
  { key: "girly", label: "Girly" },
  { key: "boy", label: "Boyish" },
  { key: "gold", label: "Gold" },
  { key: "dark", label: "Dark" },
  { key: "photo", label: "Photo bg" },
];
