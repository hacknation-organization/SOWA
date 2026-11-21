"use client";

import { PageHeader } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Asystent"
        description="Pytania o zasady oceniania i przygotowanie rozmowy – z cytowaniem źródeł."
      />
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-8">
        <AssistantChat />
      </div>
    </div>
  );
}
