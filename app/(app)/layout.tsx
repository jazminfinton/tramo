import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/global/app-header";
import { NavigationProgress } from "@/components/global/navigation-progress";
import { HelpButton } from "@/features/guide/components/help-button";
import { TourProvider } from "@/features/guide/components/tour-provider";
import { getTourStep } from "@/features/guide/queries";
import { tourSteps } from "@/features/guide/tour";
import { isAdmin } from "@/lib/access/permissions";
import { getAccess, getProjectAccess } from "@/lib/dal";

/**
 * The signed-in app's chrome. The header lives here, not in each page, so it
 * stays mounted while pages change and every route's loading.tsx skeleton
 * shows right under it the moment a link is clicked. So does the guided tour,
 * which walks across pages.
 *
 * It only READS who is signed in, to draw the chrome. Layouts don't re-render
 * on client-side navigation, so they never guard anything: every page still
 * runs its own access check (requireMember / requireAdmin) and redirects.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const access = await getAccess();
  const member = access?.member;
  if (!access || !member) return children;

  const admin = isAdmin(member);
  const [projectAccess, tourStep] = await Promise.all([
    getProjectAccess(access.user.id, member.workspace.id),
    getTourStep(access.user.id),
  ]);

  return (
    <TourProvider steps={tourSteps({ persona: projectAccess.persona, isAdmin: admin })} saved={tourStep}>
      {/* It reads the URL's search params, which want a Suspense boundary. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <AppHeader
        userName={access.user.name}
        workspaceName={member.workspace.name}
        isAdmin={admin}
        help={<HelpButton />}
      />
      {children}
    </TourProvider>
  );
}
