"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ActionFormProps = ComponentProps<"form"> & {
  children: ReactNode;
};

function PendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="pending-form-overlay" aria-live="polite" aria-busy="true">
      <div className="global-spinner" />
      <span>Working...</span>
    </div>
  );
}

export function ActionForm({ children, className, ...props }: ActionFormProps) {
  return (
    <form className={`pending-form ${className ?? ""}`.trim()} {...props}>
      <PendingOverlay />
      {children}
    </form>
  );
}
