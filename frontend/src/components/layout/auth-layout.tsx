// Frame for sign up, log in, set/change password, verify email, forgot/reset password
// (P-01 to P-04, P-08 to P-10). Centered card; So3ad waves beside it on large screens.
// <AuthLayout title="Welcome back" description="Log in to book and plan your trips.">
//   ...form...
// </AuthLayout>
import type { ReactNode } from "react";
import { So3ad } from "@/components/app/so3ad";
import { SkipLink } from "@/components/layout/skip-link";
import { Wordmark } from "@/components/layout/wordmark";

type AuthLayoutProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Links under the card, e.g. "No account? Sign up". */
  footer?: ReactNode;
};

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="px-4 py-5 sm:px-8">
        <Wordmark />
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pb-16 outline-none">
        <div className="flex w-full max-w-4xl items-center justify-center gap-12">
          <div className="w-full max-w-[440px]">
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              {description && <p className="mt-2 text-muted-foreground">{description}</p>}
              <div className="mt-6">{children}</div>
            </div>
            {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
          <So3ad pose="wave" size={220} className="hidden lg:block" />
        </div>
      </main>
    </div>
  );
}
