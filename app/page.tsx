import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentCreator } from "@/lib/brief-gate";
import { briefsForCreator } from "@/lib/db";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your briefs — SuperBrief",
};

export default async function Home() {
  // Not signed in → send to login/create-account.
  const user = await currentCreator();
  if (!user) redirect("/login");

  // Signed in → dashboard of the briefs they've been approved for.
  const briefs = await briefsForCreator(user.id);
  return (
    <Dashboard
      user={{ name: user.name, email: user.email }}
      briefs={briefs.map((b) => ({
        slug: b.slug,
        name: b.name,
        logoUrl: b.logoUrl,
      }))}
    />
  );
}
