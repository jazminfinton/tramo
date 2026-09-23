import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/global/logo";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { signInErrorKey } from "@/features/auth/errors";
import { getSession } from "@/lib/dal";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/");

  const [t, { error }] = await Promise.all([getTranslations("signIn"), searchParams]);
  const errorKey = signInErrorKey(typeof error === "string" ? error : undefined);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header className="flex flex-col gap-4">
        <h1>
          <Logo name={t("title")} size="lg" />
        </h1>
        <p className="text-sm text-ink-muted">{t("subtitle")}</p>
      </header>

      <section className="panel grain flex flex-col gap-4 p-5">
        {errorKey && (
          <p role="alert" className="text-sm text-warn">
            {t(`errors.${errorKey}`)}
          </p>
        )}
        <GoogleSignInButton />
      </section>
    </main>
  );
}
