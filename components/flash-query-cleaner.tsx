"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FlashQueryCleanerProps = {
  queryKey: string;
  delayMs?: number;
};

export function FlashQueryCleaner({ queryKey, delayMs = 5000 }: FlashQueryCleanerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const currentValue = searchParams.get(queryKey);
    if (!currentValue) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete(queryKey);
      const nextQuery = nextParams.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, pathname, queryKey, router, searchParams]);

  return null;
}
