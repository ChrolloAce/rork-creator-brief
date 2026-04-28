import { redirect } from "next/navigation";
import { DEFAULT_BRIEF_SLUG } from "@/lib/db";

export default function Home() {
  redirect(`/b/${DEFAULT_BRIEF_SLUG}`);
}
