import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentCreator } from "@/lib/brief-gate";
import { AuthForm } from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — SuperBrief",
};

export default async function LoginPage() {
  // Already signed in? Skip straight to the dashboard.
  if (await currentCreator()) redirect("/");
  return <AuthForm />;
}
