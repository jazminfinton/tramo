import { getTranslations } from "next-intl/server";

import { LoadingStatus, Skeleton } from "@/components/common/skeleton";

/** Settings while they load: the title and the theme picker. */
export default async function Loading() {
  const t = await getTranslations("nav");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <LoadingStatus label={t("loading")} />
      <header aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </header>
      <section aria-hidden className="panel grain flex flex-col gap-4 p-5">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((swatch) => (
            <Skeleton key={swatch} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-48" />
      </section>
    </main>
  );
}
