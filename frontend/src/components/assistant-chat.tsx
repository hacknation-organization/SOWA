"use client";

import { useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { api, type AskResponse, type ChatMode, type Citation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  question: string;
  mode: ChatMode;
  response?: AskResponse;
  error?: string;
}

const MODE_LABELS: Record<ChatMode, string> = {
  formal: "Zasady i przepisy",
  interview: "Przygotowanie rozmowy",
};

const EXAMPLES: Record<ChatMode, string[]> = {
  formal: [
    "Jakie są kryteria obowiązkowe w arkuszu C?",
    "Ile punktów daje poziom „powyżej oczekiwań”?",
    "Co zrobić, gdy nie było okazji zaobserwować zachowania?",
  ],
  interview: ["Zaproponuj pytania i plan rozwoju na rozmowę oceniającą."],
};

export function AssistantChat({
  processId,
  defaultMode = "formal",
  allowModeSwitch = true,
  compact = false,
  onAnswer,
}: {
  processId?: string;
  defaultMode?: ChatMode;
  allowModeSwitch?: boolean;
  compact?: boolean;
  onAnswer?: (res: AskResponse) => void;
}) {
  const [mode, setMode] = useState<ChatMode>(defaultMode);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const id = `m${Date.now()}`;
    setMessages((m) => [...m, { id, question: text, mode }]);
    setQuestion("");
    setBusy(true);
    try {
      const response = await api.ask({ question: text, mode, process_id: processId });
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, response } : x)));
      onAnswer?.(response);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Asystent jest niedostępny";
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, error } : x)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }),
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {allowModeSwitch && (
        <div role="group" aria-label="Tryb asystenta" className="mb-3 flex gap-1">
          {(Object.keys(MODE_LABELS) as ChatMode[]).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? "default" : "outline"}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </Button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Asystent odpowiada wyłącznie na podstawie bazy wiedzy (ustawa, rozporządzenia, poradniki,
              model kompetencji) i wskazuje źródła. Gdy nie zna odpowiedzi – mówi o tym wprost.
            </p>
            <p className="mb-1">Przykładowe pytania:</p>
            <ul className="flex flex-col gap-1">
              {EXAMPLES[mode].map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    className="text-left text-primary underline underline-offset-2 hover:no-underline"
                    onClick={() => ask(ex)}
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol ref={listRef} className="flex flex-col gap-4">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-2">
                <p className="self-end rounded-md bg-primary-soft px-3 py-2 text-sm">
                  <span className="sr-only">Pytanie: </span>
                  {m.question}
                </p>
                {m.error && <Alert variant="danger">{m.error}</Alert>}
                {!m.response && !m.error && (
                  <p className="text-sm text-muted-foreground">Szukam w źródłach…</p>
                )}
                {m.response && <Answer id={m.id} res={m.response} compact={compact} />}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Label htmlFor={inputId}>Twoje pytanie</Label>
        <Textarea
          id={inputId}
          rows={compact ? 2 : 3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          placeholder="Np. kiedy należy przeprowadzić rozmowę oceniającą?"
          aria-describedby={`${inputId}-hint`}
        />
        <div className="flex items-center justify-between gap-2">
          <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            Enter – wyślij, Shift+Enter – nowa linia
          </span>
          <Button type="submit" size="sm" disabled={busy || !question.trim()}>
            Zapytaj
          </Button>
        </div>
      </form>
    </div>
  );
}

const CONFIDENCE_NOTE: Record<AskResponse["confidence"], string | null> = {
  high: null,
  partial: "Odpowiedź częściowa – źródła nie obejmują całego pytania. Zweryfikuj ją w dokumentach.",
  none: "Brak informacji w bazie wiedzy. Asystent nie udziela odpowiedzi bez oparcia w źródłach.",
};

function Answer({ id, res, compact }: { id: string; res: AskResponse; compact: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const note = CONFIDENCE_NOTE[res.confidence];

  const parts = res.answer.split(/(\[\d+\])/g);
  const anchor = (marker: string) => `${id}-cit-${marker.replace(/\D/g, "")}`;

  return (
    <div className="flex flex-col gap-2">
      {note && (
        <Alert variant={res.confidence === "none" ? "warning" : "info"}>
          <span className="font-semibold">
            {res.confidence === "none" ? "Nie wiem. " : "Uwaga. "}
          </span>
          {note}
        </Alert>
      )}
      <div className="whitespace-pre-line rounded-md border bg-card px-3 py-2 text-sm">
        {parts.map((part, i) => {
          const cit = res.citations.find((c) => c.marker === part);
          if (!cit) return <span key={i}>{part}</span>;
          return (
            <a
              key={i}
              href={`#${anchor(cit.marker)}`}
              className="mx-0.5 font-medium text-primary underline underline-offset-2"
              aria-label={`Źródło ${cit.marker}: ${cit.source}`}
              onClick={() => setOpen(cit.marker)}
            >
              {part}
            </a>
          );
        })}
      </div>
      {res.citations.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Źródła</p>
          <ul className="flex flex-col gap-1">
            {res.citations.map((c) => (
              <CitationItem
                key={c.marker}
                id={anchor(c.marker)}
                citation={c}
                open={open === c.marker}
                onToggle={() => setOpen(open === c.marker ? null : c.marker)}
                compact={compact}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitationItem({
  id,
  citation,
  open,
  onToggle,
  compact,
}: {
  id: string;
  citation: Citation;
  open: boolean;
  onToggle: () => void;
  compact: boolean;
}) {
  const isUrl = /^https?:\/\//.test(citation.path);
  return (
    <li id={id} className={cn("rounded-md border text-sm", open && "border-primary")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-muted"
      >
        <span className="font-medium text-primary">{citation.marker}</span>
        <span className="flex-1">
          {citation.source}
          {citation.page != null && <span className="text-muted-foreground">, s. {citation.page}</span>}
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          <blockquote className="border-l-2 border-primary pl-2 italic">„{citation.excerpt}”</blockquote>
          <p className={cn("mt-1 break-all text-xs text-muted-foreground", compact && "hidden")}>
            {citation.path}
          </p>
          {isUrl && (
            <a
              href={citation.path}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-primary underline"
            >
              Otwórz źródło
            </a>
          )}
        </div>
      )}
    </li>
  );
}
