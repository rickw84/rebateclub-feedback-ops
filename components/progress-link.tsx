"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useNavigationProgress } from "@/components/navigation-progress";

type ProgressLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
};

export function ProgressLink({ children, className, href, ...props }: ProgressLinkProps) {
  const router = useRouter();
  const { beginNavigation } = useNavigationProgress();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    beginNavigation();
    router.push(typeof href === "string" ? href : String(href), { scroll: false });
  }

  return (
    <Link {...props} className={className} href={href} onClick={handleClick} scroll={false}>
      {children}
    </Link>
  );
}
