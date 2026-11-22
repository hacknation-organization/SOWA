import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

// The dashboard has no layout of its own, so this title is the fallback for the (app) group;
// nested routes override it with their own names. A plain string here would drop the root template.
export const metadata: Metadata = { title: { default: "Pulpit", template: "%s · SOWA" } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
