import { Clock, UserX } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requestAccessAgain, signOut } from "@/features/auth/actions";
import { getAccess } from "@/lib/dal";

/** Where signed-in people without an active membership land. */
export default async function PendingPage() {
  const access = await getAccess();
  if (!access) redirect("/sign-in");
  if (access.member) redirect("/");

  const t = await getTranslations("pending");
  const state = access.status === "rejected" ? "rejected" : access.status === "pending" ? "pending" : "none";
  const Icon = state === "rejected" ? UserX : Clock;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <section className="panel grain flex flex-col gap-4 p-6">
        <span className="tile size-10" aria-hidden>
          <Icon className="icon size-5 text-accent" />
        </span>
        <h1 className="poster text-5xl uppercase">{t(`${state}.title`)}</h1>
        <p className="text-sm text-ink-muted">{t(`${state}.body`, { email: access.user.email })}</p>

        <div className="flex flex-wrap gap-2 pt-2">
          {state !== "pending" && (
            <form action={requestAccessAgain}>
              <button
                type="submit"
                className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
              >
                {t("requestAgain")}
              </button>
            </form>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-tile px-4 py-2.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              {t("signOut")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
