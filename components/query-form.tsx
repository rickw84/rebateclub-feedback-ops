"use client";

import type { ComponentProps, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNavigationProgress } from "@/components/navigation-progress";

type QueryFormProps = Omit<ComponentProps<"form">, "action"> & {
  action?: string;
  children: ReactNode;
};

export function QueryForm({ action, children, method = "get", ...props }: QueryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { beginNavigation } = useNavigationProgress();

  if (String(method).toLowerCase() !== "get") {
    throw new Error("QueryForm only supports GET submissions.");
  }

  return (
    <form
      {...props}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const next = new URLSearchParams(searchParams.toString());

        Array.from(formData.entries()).forEach(([key, value]) => {
          if (typeof value !== "string" || !value.trim()) {
            next.delete(key);
            return;
          }
          next.set(key, value);
        });

        if (!next.has("page")) {
          next.set("page", "1");
        }

        beginNavigation();
        const basePath = action || pathname;
        const qs = next.toString();
        router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      }}
    >
      {children}
    </form>
  );
}
