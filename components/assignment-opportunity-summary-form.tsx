"use client";

import { useActionState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { updateAssignmentOpportunitySummaryAction } from "@/app/admin/actions";

type AssignmentOpportunitySummaryFormProps = {
  detail: any;
};

type UpdateSummaryState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

const initialState: UpdateSummaryState = {
  status: "idle"
};

const baseStatusOptions = [
  { value: "DRAFT", label: "Not Paid" },
  { value: "FAILED", label: "Assignment Not Completed (Block/Blacklist)" },
  { value: "SENT", label: "Product Payment Made" },
  { value: "PAID", label: "Assignment Completed (Review+Commission)" }
];

function asInputDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function asMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export function AssignmentOpportunitySummaryForm({ detail }: AssignmentOpportunitySummaryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction] = useActionState(updateAssignmentOpportunitySummaryAction, initialState);

  const statusOptions = useMemo(() => {
    if (baseStatusOptions.some((option) => option.value === detail.status)) {
      return baseStatusOptions;
    }

    return [...baseStatusOptions, { value: detail.status, label: detail.status }];
  }, [detail.status]);

  useEffect(() => {
    if (state.status === "success") {
      router.replace(state.redirectTo ?? pathname, { scroll: false });
      router.refresh();
    }
  }, [pathname, router, state.redirectTo, state.status]);

  return (
    <ActionForm action={formAction} className="rk-detail-form">
      <input name="participantId" type="hidden" value={detail.participantId ?? ""} />
      <input name="campaignId" type="hidden" value={detail.campaignId ?? ""} />
      <input name="assignmentIds" type="hidden" value={JSON.stringify(detail.assignmentRows.map((row: any) => row.id))} />
      <input name="payoutIds" type="hidden" value={JSON.stringify(detail.payoutRows.map((row: any) => row.id))} />

      <div className="rk-detail-grid rk-detail-grid--form">
        <label className="field rk-detail-field">
          <span>Request date</span>
          <input defaultValue={asInputDate(detail.requestDate)} name="requestDate" required type="date" />
        </label>
        <label className="field rk-detail-field">
          <span>Name</span>
          <input defaultValue={detail.participantName ?? ""} name="participantName" required />
        </label>
        <label className="field rk-detail-field">
          <span>Email</span>
          <input defaultValue={detail.email ?? ""} name="participantEmail" required type="email" />
        </label>
        <label className="field rk-detail-field">
          <span>PayPal</span>
          <input defaultValue={detail.paypalEmail ?? ""} name="paypalEmail" type="email" />
        </label>
        <label className="field rk-detail-field">
          <span>Newsletter campaign</span>
          <input defaultValue={detail.newsletterCampaign ?? ""} name="newsletterCampaign" required />
        </label>
        <label className="field rk-detail-field">
          <span>Status</span>
          <select defaultValue={detail.status ?? "DRAFT"} name="opportunityStatus">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field rk-detail-field">
          <span>Total product cost</span>
          <input defaultValue={asMoney(detail.totalProductCost)} inputMode="decimal" name="totalProductCost" />
        </label>
        <label className="field rk-detail-field">
          <span>Total cost + PP fee</span>
          <input defaultValue={asMoney(detail.totalCostWithFee)} inputMode="decimal" name="totalCostWithFee" />
        </label>
        <label className="field rk-detail-field">
          <span>Commission total</span>
          <input defaultValue={asMoney(detail.commissionTotal)} inputMode="decimal" name="commissionTotal" />
        </label>
        <label className="field rk-detail-field">
          <span>Full payment date</span>
          <input defaultValue={asInputDate(detail.fullPaymentDate)} name="fullPaymentDate" type="date" />
        </label>
      </div>

      {state.status === "error" ? <div className="rk-form-error">{state.message}</div> : null}

      <div className="rk-detail-actions">
        <SubmitButton className="hero-link primary" pendingLabel="Saving changes...">
          Save changes
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

