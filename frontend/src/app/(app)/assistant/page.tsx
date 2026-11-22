"use client";

import { PageHeader } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    // Fills the viewport below the mobile top bar (none on desktop), so only the conversation scrolls.
    <div className="flex h-[calc(100dvh-var(--kk-topbar-height))] flex-col lg:h-dvh">
      <PageHeader
        title="Asystent"
        description="Pytania o zasady oceniania i przygotowanie rozmowy – z cytowaniem źródeł."
      />
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col page-x pb-4 pt-5 lg:py-8">
        <AssistantChat />
      </div>
    </div>
  );
}
