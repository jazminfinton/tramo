import { getTranslations } from "next-intl/server";

import { LoadingStatus, Skeleton, SkeletonList } from "@/components/common/skeleton";

/** Any admin section while it loads: the tabs, the title, a form and a list. */
export default async function Loading() {
  const t = await getTranslations("nav");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <LoadingStatus label={t("loading")} />
      <Skeleton className="h-10 w-72" />
      <header aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <section aria-hidden className="panel grain flex flex-col gap-4 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-44" />
      </section>
      <SkeletonList rows={3} />
    </main>
  );
}
