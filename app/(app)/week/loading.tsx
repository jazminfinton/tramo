import { getTranslations } from "next-intl/server";

import { LoadingStatus, Skeleton, SkeletonList } from "@/components/common/skeleton";

/** The week while it loads: header, total, the projects × days table and the blocks. */
export default async function Loading() {
  const t = await getTranslations("nav");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <LoadingStatus label={t("loading")} />
      <header aria-hidden className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="ml-auto flex gap-1">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </header>
      <section aria-hidden className="panel-accent flex items-center justify-between p-5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-20" />
      </section>
      <div aria-hidden className="panel grain p-4">
        <Skeleton className="h-36 w-full" />
      </div>
      <SkeletonList rows={4} />
    </main>
  );
}
