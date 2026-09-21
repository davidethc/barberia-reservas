"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StaffHeader({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOut();
      if (result.success) {
        router.push("/login");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-1">
            <Link
              href="/agenda"
              className={cn(
                "flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                pathname?.startsWith("/agenda")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Agenda
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  pathname?.startsWith("/admin")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <Button
          variant="ghost"
          className="h-11 shrink-0 px-3"
          onClick={handleSignOut}
          disabled={isPending}
        >
          {isPending ? "Saliendo…" : "Salir"}
        </Button>
      </div>
    </header>
  );
}
