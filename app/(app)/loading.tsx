import { getTranslations } from "next-intl/server";

import { LoadingStatus, Skeleton, SkeletonList } from "@/components/common/skeleton";

/** Home while it loads: the timer panel and the latest blocks, in shape. */
export default async function Loading() {
  const t = await getTranslations("nav");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <LoadingStatus label={t("loading")} />
      <section aria-hidden className="panel grain flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 sm:w-56" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="ml-auto size-14 rounded-full" />
        </div>
      </section>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <SkeletonList rows={4} />
      </div>
    </main>
  );
}
