import { getTranslations } from "next-intl/server";

import { LoadingStatus, Skeleton } from "@/components/common/skeleton";

/** Metrics while they load: filters, the headline, the chart and the two tables. */
export default async function Loading() {
  const t = await getTranslations("nav");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <LoadingStatus label={t("loading")} />
      <header aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </header>
      <div aria-hidden className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 sm:w-64" />
      </div>
      <section aria-hidden className="panel-accent flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-3 w-44" />
      </section>
      <section aria-hidden className="panel grain flex flex-col gap-4 p-4 sm:p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="aspect-[640/240] w-full" />
      </section>
      <div aria-hidden className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <section key={card} className="panel grain flex flex-col gap-4 p-4 sm:p-5">
            <Skeleton className="h-3 w-32" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-6 w-full" />
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
