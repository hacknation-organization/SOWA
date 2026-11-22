"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Employee } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICON = { absoluteStrokeWidth: true, strokeWidth: 1.6, "aria-hidden": true } as const;

/** Searchable employee picker (ARIA combobox pattern with a listbox popup). */
export function EmployeeCombobox({
  id,
  employees,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = employees.find((e) => e.id === value);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const options = useMemo(() => {
    const q = text.trim().toLocaleLowerCase("pl-PL");
    if (!q) return employees;
    return employees.filter((e) =>
      [e.full_name, e.position, e.unit].some((s) => s.toLocaleLowerCase("pl-PL").includes(q)),
    );
  }, [employees, text]);

  function choose(e: Employee) {
    onChange(e.id);
    setText("");
    setOpen(false);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setOpen(true);
      const delta = ev.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (options.length ? (h + delta + options.length) % options.length : 0));
    } else if (ev.key === "Enter" && open && options[highlight]) {
      ev.preventDefault();
      choose(options[highlight]);
    } else if (ev.key === "Escape") {
      setOpen(false);
      setText("");
    }
  }

  const display = open ? text : selected ? `${selected.full_name} — ${selected.position}` : text;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-[43px] items-center gap-2.5 rounded-md border bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15",
          invalid ? "border-destructive" : "border-input hover:border-faint-foreground",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Search {...ICON} className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[highlight] ? `${listId}-${options[highlight].id}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={display}
          placeholder="Wybierz z listy lub wpisz nazwisko"
          onChange={(e) => {
            setText(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
        />
        <ChevronDown
          {...ICON}
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Pracownicy"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-card p-1 shadow-[0_8px_24px_rgb(23_24_27/0.08)]"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">Brak pracowników dla „{text}”.</li>
          ) : (
            options.map((e, i) => (
              <li
                key={e.id}
                id={`${listId}-${e.id}`}
                role="option"
                aria-selected={e.id === value}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(e)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2",
                  i === highlight && "bg-muted",
                  e.id === value && "bg-primary-soft",
                )}
              >
                <span className="block text-[13px] font-medium">{e.full_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.position} · {e.unit}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
