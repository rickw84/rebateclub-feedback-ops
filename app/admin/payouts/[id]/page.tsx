import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getServerSession } from "@/lib/auth";
import { getPayoutDetailData } from "@/lib/dashboard-data";

type PayoutDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

export default async function PayoutDetailPage({ params }: PayoutDetailPageProps) {
  const session = await getServerSession();
  const { id } = await params;
  const detail = await getPayoutDetailData(id);

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      title="Payment Detail"
      kicker="Rebate Queue"
      description="Detailed payout information with assignment, participant, and campaign context."
      links={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/payouts", label: "Back to Payouts" },
        { href: "/", label: "Overview" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/admin">Finance</Link>
          <span>/</span>
          <Link href="/admin/payouts">Rebate Queue</Link>
          <span>/</span>
          <strong>{detail.record.uniquePaymentId}</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Payment detail</div>
              <p className="muted">
                Unique Payment ID: <strong>{detail.record.uniquePaymentId}</strong>
              </p>
            </div>
            <Link className="hero-link" href="/admin/payouts">
              Return to queue
            </Link>
          </div>

          <div className="grid-two">
            <div className="stack">
              <div className="rk-info-banner">
                This view shows the linked participant, assignment, and campaign context for one
                payout entry so you can reconcile issues without leaving the queue.
              </div>
              <div className="rk-detail-grid">
                <div className="rk-detail-item">
                  <span>Request date</span>
                  <strong>{detail.record.requestDateLabel}</strong>
                </div>
                <div className="rk-detail-item">
                  <span>Email</span>
                  <strong>{detail.record.email}</strong>
                </div>
                <div className="rk-detail-item">
                  <span>Campaign</span>
                  <strong>{detail.record.campaign}</strong>
                </div>
                <div className="rk-detail-item">
                  <span>Buyer</span>
                  <strong>{detail.record.participantName}</strong>
                </div>
                <div className="rk-detail-item">
                  <span>Payout</span>
                  <strong>{detail.record.amountLabel}</strong>
                </div>
                <div className="rk-detail-item">
                  <span>Status</span>
                  <strong>{detail.record.status}</strong>
                </div>
              </div>
            </div>

            <div className="rk-sidebar-card">
              <h3>Linked records</h3>
              <ul className="list">
                <li className="list-item">
                  <div>
                    <strong>Assignment ID</strong>
                    <span className="muted">{detail.record.assignmentId}</span>
                  </div>
                </li>
                <li className="list-item">
                  <div>
                    <strong>Batch ID</strong>
                    <span className="muted">{detail.record.batchId ?? "Standalone payout"}</span>
                  </div>
                </li>
                <li className="list-item">
                  <div>
                    <strong>Product</strong>
                    <span className="muted">{detail.product?.title ?? "Not linked"}</span>
                  </div>
                </li>
                <li className="list-item">
                  <div>
                    <strong>Provider reference</strong>
                    <span className="muted">{detail.record.providerReference ?? "Not recorded"}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </article>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div className="rk-section-title">Operations timeline</div>
          </div>
          <div className="rk-detail-grid">
            <div className="rk-detail-item">
              <span>Created</span>
              <strong>{formatDateTime(detail.record.createdAt)}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Sent</span>
              <strong>{formatDateTime(detail.record.sentAt)}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Settled</span>
              <strong>{formatDateTime(detail.record.settledAt)}</strong>
            </div>
            <div className="rk-detail-item">
              <span>Provider</span>
              <strong>{detail.record.provider}</strong>
            </div>
          </div>
          <div className="rk-notes">
            <strong>Internal notes</strong>
            <p>{detail.record.internalNotes ?? "No internal notes recorded for this payout yet."}</p>
          </div>
        </article>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div className="rk-section-title">What to check next</div>
          </div>
          <div className="mini-metrics">
            <div className="mini-metric">
              <div className="mini-metric-label">Recipient email</div>
              <div className="mini-metric-value compact">
                {detail.record.email}
              </div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">Provider reference</div>
              <div className="mini-metric-value compact">
                {detail.record.providerReference ?? "Pending"}
              </div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">Current status</div>
              <div className="mini-metric-value compact">
                {detail.record.status}
              </div>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
