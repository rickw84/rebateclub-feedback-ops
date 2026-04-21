import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getServerSession } from "@/lib/auth";
import { getAssignmentOpportunityDetailData } from "@/lib/dashboard-data";

export default async function AssignmentOpportunityDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  const { id } = await params;
  const detail = await getAssignmentOpportunityDetailData(id);

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      title="Assignment Detail"
      kicker="Operations Queue"
      description="Grouped assignment opportunity with products, review links, and related payouts."
      links={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/assignments", label: "Back to Assignments" },
        { href: "/admin/payouts", label: "Payouts" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/admin">Admin</Link>
          <span>/</span>
          <Link href="/admin/assignments">Assignments</Link>
          <span>/</span>
          <strong>{detail.participantName}</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Assignment opportunity summary</div>
              <p className="muted">
                This is the grouped parent record for one review opportunity.
              </p>
            </div>
          </div>

          <div className="rk-detail-grid">
            <div className="rk-detail-item">
              <span>Request date</span>
              <strong>{detail.requestDateLabel}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Name</span>
              <strong>{detail.participantName}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Email</span>
              <strong>{detail.email}</strong>
            </div>
            <div className="rk-detail-item">
              <span>PayPal</span>
              <strong>{detail.paypalEmail}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Newsletter campaign</span>
              <strong>{detail.newsletterCampaign}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Status</span>
              <strong>{detail.status}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Total product cost</span>
              <strong>{detail.totalProductCostLabel}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Total cost + PP fee</span>
              <strong>{detail.totalCostWithFeeLabel}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Commission total</span>
              <strong>{detail.commissionTotalLabel}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Full payment date</span>
              <strong>{detail.fullPaymentDateLabel}</strong>
            </div>
          </div>
        </article>

        <div className="grid-two">
          <article className="rk-panel">
            <div className="rk-panel-header">
              <div className="rk-section-title">Products in this assignment</div>
            </div>
            <div className="rk-table-wrap with-top-border">
              <table className="rk-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Product</th>
                    <th>Product Cost</th>
                    <th>Review Link</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.assignmentRows.map((assignment: any) => (
                    <tr key={assignment.id}>
                      <td>{assignment.brandName}</td>
                      <td>{assignment.productTitle}</td>
                      <td>{assignment.purchaseSubtotalLabel}</td>
                      <td>
                        {assignment.reviewLinks?.length ? (
                          <div className="rk-id-stack">
                            {assignment.reviewLinks.map((reviewLink: string) => (
                              <a className="rk-id-link" href={reviewLink} key={reviewLink} target="_blank">
                                Open review
                              </a>
                            ))}
                          </div>
                        ) : (
                          "No link"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rk-panel">
            <div className="rk-panel-header">
              <div className="rk-section-title">Related payouts</div>
            </div>
            <div className="rk-table-wrap with-top-border">
              <table className="rk-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payoutRows.map((payout: any) => (
                    <tr key={payout.id}>
                      <td>{payout.id}</td>
                      <td>{payout.payoutTypeLabel}</td>
                      <td>{payout.amountLabel}</td>
                      <td>{payout.status}</td>
                      <td>{payout.paymentDateLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
