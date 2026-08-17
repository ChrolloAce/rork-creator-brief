import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLang, type Lang } from "./i18n";

// Server-side: the language the visitor picked with the EN/ES toggle.
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return normalizeLang(c.get(LANG_COOKIE)?.value);
}
