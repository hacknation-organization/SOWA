import { Card } from "@/components/ui/card";
import { LoadingRegion, ProgressLine, Skeleton } from "@/components/ui/skeleton";

/** First paint while the session is restored: brand mark and an indeterminate progress line. */
export function BootScreen() {
  return (
    <LoadingRegion label="Wczytywanie aplikacji" className="flex min-h-screen items-center justify-center">
      <div className="flex w-48 flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sowa-logo.svg" alt="" width={182} height={185} className="h-12 w-auto" />
        <ProgressLine className="w-full" />
      </div>
    </LoadingRegion>
  );
}

/** Mirrors a "Do dokończenia" card: avatar, name, step progress, deadline, action. */
export function ActiveCardSkeleton() {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:gap-8 xl:px-6">
      <div className="flex items-center gap-3 xl:w-[240px] xl:shrink-0 2xl:w-[300px]">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-1 w-full max-w-[212px]" />
      </div>
      <div className="flex items-end justify-between gap-3 xl:contents">
        <div className="flex flex-col gap-2 xl:w-[140px] 2xl:w-[160px]">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-[39px] w-40" />
      </div>
    </Card>
  );
}

/** Table body placeholder: header strip plus rows with avatar and a few text cells. */
export function TableSkeleton({ rows = 3, columns = 3 }: { rows?: number; columns?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-subtle px-6 py-3">
        <Skeleton className="h-2.5 w-24 bg-border/70" />
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b px-4 py-4 last:border-0 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 md:w-[320px] md:shrink-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-36" />
            </div>
          </div>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-3 flex-1 max-md:hidden" style={{ maxWidth: 160 - c * 30 }} />
          ))}
          <div className="ml-auto flex gap-2 max-sm:hidden">
            <Skeleton className="size-9" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Wizard page while the assessment loads: header, stepper and the step card outline. */
export function WizardSkeleton() {
  return (
    <LoadingRegion label="Wczytywanie oceny" className="flex flex-col gap-5 page-x pb-12 pt-6 lg:gap-6 lg:px-8 lg:pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-full max-w-96" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-[39px] w-36" />
        </div>
      </div>
      <Card className="flex items-center gap-2.5 px-5 py-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2.5 last:flex-none">
            <Skeleton className="size-[22px] shrink-0 rounded-full" />
            <Skeleton className="h-3 w-20 max-md:hidden" />
            {i < 5 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </Card>
      <StepCardSkeleton />
    </LoadingRegion>
  );
}

export function StepCardSkeleton() {
  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3.5 w-full max-w-xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[43px] w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="h-px bg-border" />
      <div className="flex justify-between">
        <Skeleton className="h-[39px] w-24" />
        <Skeleton className="h-[39px] w-40" />
      </div>
    </Card>
  );
}

/** Summary step: competency cards with the suggestion panel and level scale. */
export function SummarySkeleton() {
  return (
    <LoadingRegion label="Wyliczanie sugerowanych poziomów" className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex justify-between">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border bg-subtle px-3.5 py-3">
            <Skeleton className="h-3.5 w-64" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, j) => (
                <Skeleton key={j} className="h-1 flex-1" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-[43px]" />
            <Skeleton className="h-[84px]" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

/** Simple list placeholder, e.g. suggested interview questions. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-3">
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${90 - i * 12}%` }} />
        </div>
      ))}
    </div>
  );
}
