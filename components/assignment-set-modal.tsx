"use client";

import { useActionState, useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import {
  AssignmentSetLineItem,
  initialAssignmentSetActionState,
  sumCommission
} from "@/lib/assignment-set";
import { createAssignmentSetAction } from "@/app/admin/actions";

type AssignmentSetModalProps = {
  campaignSuggestions: string[];
};

type AssignmentDetails = {
  opportunityStatus: string;
  requestDate: string;
  participantName: string;
  participantEmail: string;
  paypalEmail: string;
  newsletterCampaign: string;
  fullPaymentDate: string;
  commissionPaymentDate: string;
};

function emptyLineItem(): AssignmentSetLineItem {
  return {
    brand: "",
    productTitle: "",
    productCost: "",
    productLink: "",
    ppFee: "",
    totalProductCost: "",
    totalCostWithFee: "",
    commission: "",
    reviewProductLink: ""
  };
}

function defaultDetails(): AssignmentDetails {
  return {
    opportunityStatus: "DRAFT",
    requestDate: "",
    participantName: "",
    participantEmail: "",
    paypalEmail: "",
    newsletterCampaign: "",
    fullPaymentDate: "",
    commissionPaymentDate: ""
  };
}

export function AssignmentSetModal({ campaignSuggestions }: AssignmentSetModalProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<AssignmentDetails>(defaultDetails);
  const [lineItems, setLineItems] = useState<AssignmentSetLineItem[]>([emptyLineItem()]);
  const [state, formAction, pending] = useActionState(
    createAssignmentSetAction,
    initialAssignmentSetActionState
  );

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      setDetails(defaultDetails());
      setLineItems([emptyLineItem()]);
    }
  }, [state.status]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  const updateDetail = (key: keyof AssignmentDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [key]: value
    }));
  };

  const updateLineItem = (index: number, key: keyof AssignmentSetLineItem, value: string) => {
    setLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value
            }
          : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems((current) => [...current, emptyLineItem()]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  return (
    <>
      <button className="button-link rk-queue-action" onClick={() => setOpen(true)} type="button">
        <span aria-hidden="true" className="rk-queue-action__icon">+</span>
        <span>Add Assignments</span>
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="rk-modal-backdrop"
          onClick={() => {
            if (!pending) {
              setOpen(false);
            }
          }}
          role="dialog"
        >
          <div className="rk-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="rk-modal-header">
              <div>
                <div className="eyebrow">Assignment Set</div>
                <h3>Add one assignment with one or many products</h3>
                <p className="muted">
                  Enter the assignment-level details once, then add as many product rows as you need.
                </p>
              </div>
              <button
                aria-label="Close assignment form"
                className="button-link"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <ActionForm action={formAction} className="rk-modal-form">
              <div className="rk-modal-section">
                <div className="rk-modal-section-title">Assignment details</div>
                <div className="rk-modal-grid rk-modal-grid--assignment">
                  <label className="field">
                    Status
                    <select
                      name="opportunityStatus"
                      onChange={(event) => updateDetail("opportunityStatus", event.target.value)}
                      value={details.opportunityStatus}
                    >
                      <option value="DRAFT">Needs approval</option>
                      <option value="SENT">Sent</option>
                      <option value="PAID">Paid</option>
                      <option value="FAILED">Failed</option>
                      <option value="CANCELED">Canceled</option>
                    </select>
                  </label>
                  <label className="field">
                    Request Date
                    <input
                      name="requestDate"
                      onChange={(event) => updateDetail("requestDate", event.target.value)}
                      type="date"
                      value={details.requestDate}
                    />
                  </label>
                  <label className="field">
                    Name
                    <input
                      name="participantName"
                      onChange={(event) => updateDetail("participantName", event.target.value)}
                      placeholder="Jessica Stull"
                      required
                      value={details.participantName}
                    />
                  </label>
                  <label className="field">
                    Email
                    <input
                      name="participantEmail"
                      onChange={(event) => updateDetail("participantEmail", event.target.value)}
                      placeholder="jstull1689@gmail.com"
                      required
                      type="email"
                      value={details.participantEmail}
                    />
                  </label>
                  <label className="field">
                    Paypal
                    <input
                      name="paypalEmail"
                      onChange={(event) => updateDetail("paypalEmail", event.target.value)}
                      placeholder="jstull689@gmail.com"
                      value={details.paypalEmail}
                    />
                  </label>
                  <label className="field">
                    Newsletter Campaign
                    <input
                      list="assignment-campaign-suggestions"
                      name="newsletterCampaign"
                      onChange={(event) => updateDetail("newsletterCampaign", event.target.value)}
                      placeholder="Week 52, 2025"
                      required
                      value={details.newsletterCampaign}
                    />
                  </label>
                  <label className="field">
                    Full Payment Date
                    <input
                      name="fullPaymentDate"
                      onChange={(event) => updateDetail("fullPaymentDate", event.target.value)}
                      type="date"
                      value={details.fullPaymentDate}
                    />
                  </label>
                  <label className="field">
                    Commission Payment Made
                    <input
                      name="commissionPaymentDate"
                      onChange={(event) => updateDetail("commissionPaymentDate", event.target.value)}
                      type="date"
                      value={details.commissionPaymentDate}
                    />
                  </label>
                  <label className="field">
                    Total Commission
                    <input readOnly value={`$${sumCommission(lineItems)}`} />
                  </label>
                </div>
                <datalist id="assignment-campaign-suggestions">
                  {campaignSuggestions.map((campaign) => (
                    <option key={campaign} value={campaign} />
                  ))}
                </datalist>
              </div>

              <div className="rk-modal-section">
                <div className="rk-modal-section-title">Products</div>
                <div className="rk-product-actions">
                  <button className="button-link" onClick={addLineItem} type="button">
                    + Add product
                  </button>
                </div>

                <div className="rk-product-stack">
                  {lineItems.map((item, index) => (
                    <div className="rk-product-card" key={`product-row-${index}`}>
                      <div className="rk-product-card__header">
                        <strong>Product {index + 1}</strong>
                        <button
                          className="button-link"
                          disabled={lineItems.length === 1}
                          onClick={() => removeLineItem(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="rk-modal-grid rk-modal-grid--product">
                        <label className="field">
                          Brand
                          <input
                            onChange={(event) => updateLineItem(index, "brand", event.target.value)}
                            placeholder="plusOne"
                            value={item.brand}
                          />
                        </label>
                        <label className="field">
                          Product
                          <input
                            onChange={(event) => updateLineItem(index, "productTitle", event.target.value)}
                            placeholder="Pimple Patches"
                            value={item.productTitle}
                          />
                        </label>
                        <label className="field">
                          Product Cost
                          <input
                            onChange={(event) => updateLineItem(index, "productCost", event.target.value)}
                            placeholder="12.99"
                            value={item.productCost}
                          />
                        </label>
                        <label className="field">
                          Product Link
                          <input
                            onChange={(event) => updateLineItem(index, "productLink", event.target.value)}
                            placeholder="https://www.amazon.com/..."
                            value={item.productLink}
                          />
                        </label>
                        <label className="field">
                          PP Fee
                          <input
                            onChange={(event) => updateLineItem(index, "ppFee", event.target.value)}
                            placeholder="1.14"
                            value={item.ppFee}
                          />
                        </label>
                        <label className="field">
                          Total Product Cost
                          <input
                            onChange={(event) => updateLineItem(index, "totalProductCost", event.target.value)}
                            placeholder="Leave blank to use product cost"
                            value={item.totalProductCost}
                          />
                        </label>
                        <label className="field">
                          Total Product Cost + PP Fee
                          <input
                            onChange={(event) => updateLineItem(index, "totalCostWithFee", event.target.value)}
                            placeholder="Leave blank to auto-calculate"
                            value={item.totalCostWithFee}
                          />
                        </label>
                        <label className="field">
                          Commission
                          <input
                            onChange={(event) => updateLineItem(index, "commission", event.target.value)}
                            placeholder="10.59"
                            value={item.commission}
                          />
                        </label>
                        <label className="field rk-product-grid-span">
                          Review Product Link
                          <input
                            onChange={(event) => updateLineItem(index, "reviewProductLink", event.target.value)}
                            placeholder="https://www.amazon.com/review/..."
                            value={item.reviewProductLink}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <input name="lineItems" type="hidden" value={JSON.stringify(lineItems)} />

              {state.status === "error" ? <div className="rk-form-error">{state.message}</div> : null}

              <div className="rk-modal-footer">
                <button className="button-link" disabled={pending} onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <SubmitButton className="hero-link primary" pendingLabel="Saving assignments...">
                  Save assignment set
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </>
  );
}
