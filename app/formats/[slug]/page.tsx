import { redirect } from "next/navigation";
import { DEFAULT_BRIEF_SLUG } from "@/lib/db";

type Params = { slug: string };

export default async function LegacyFormatRedirect({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  redirect(`/b/${DEFAULT_BRIEF_SLUG}/formats/${slug}`);
}
