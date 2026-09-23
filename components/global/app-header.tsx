import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Avatar } from "@/components/common/avatar";
import { AppNav, type NavLink } from "@/components/global/app-nav";
import { signOut } from "@/features/auth/actions";

type AppHeaderProps = {
  userName: string;
  workspaceName: string;
  /** Shows the admin entry. Navigation only: every admin page checks access itself. */
  isAdmin?: boolean;
  /** The help button, which belongs to the guide feature. */
  help?: ReactNode;
};

/** The app chrome: links for this person, plus who's signed in and the way out. */
export async function AppHeader({ userName, workspaceName, isAdmin = false, help }: AppHeaderProps) {
  const t = await getTranslations("nav");

  const links: NavLink[] = [
    { href: "/", label: t("home") },
    { href: "/week", label: t("week") },
    { href: "/metrics", label: t("metrics") },
    ...(isAdmin ? [{ href: "/admin/members" as const, label: t("admin"), match: "/admin" }] : []),
    { href: "/settings", label: t("settings") },
  ];

  return (
    <AppNav
      links={links}
      workspaceName={workspaceName}
      actions={
        <>
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={userName} />
            <span className="truncate text-sm md:hidden">{userName}</span>
          </span>
          {help}
          <form action={signOut}>
            <button
              type="submit"
              aria-label={t("signOut")}
              className="flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              <LogOut className="icon size-4" aria-hidden />
            </button>
          </form>
        </>
      }
    />
  );
}
