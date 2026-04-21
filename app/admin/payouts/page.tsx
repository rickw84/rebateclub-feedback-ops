import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProgressLink } from "@/components/progress-link";
import { QueryForm } from "@/components/query-form";
import { SortLink } from "@/components/sort-link";
import { SubmitButton } from "@/components/submit-button";
import { createPayoutAction } from "@/app/admin/actions";
import { getServerSession } from "@/lib/auth";
import { getDashboardData, getPayoutListingData } from "@/lib/dashboard-data";

type PayoutsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    campaign?: string;
    sort?: string;
    dir?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function withParams(
  params: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string; page?: string; pageSize?: string },
  patch: Partial<{ q: string; status: string; campaign: string; sort: string; dir: string; page: string; pageSize: string }>
) {
  const next = new URLSearchParams();
  const merged = { ...params, ...patch };

  Object.entries(merged).forEach(([key, value]) => {
    if (value) {
      next.set(key, value);
    }
  });

  const qs = next.toString();
  return qs ? `/admin/payouts?${qs}` : "/admin/payouts";
}

function sortHref(
  params: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string; page?: string; pageSize?: string },
  key: string
) {
  const nextDir = params.sort === key && params.dir === "asc" ? "desc" : "asc";
  return withParams(params, { sort: key, dir: nextDir });
}

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
  const session = await getServerSession();
  const params = (await searchParams) ?? {};
  const { managementOptions } = await getDashboardData();
  const payoutListing = await getPayoutListingData(params);

  const statusTabs = [
    { label: "All Payouts", status: "", count: payoutListing.tabs.all },
    { label: "Needs Approval", status: "DRAFT", count: payoutListing.tabs.needsApproval },
    { label: "Sent", status: "SENT", count: payoutListing.tabs.sent },
    { label: "Paid Out", status: "PAID", count: payoutListing.tabs.paid },
    { label: "Failed", status: "FAILED", count: payoutListing.tabs.failed },
    { label: "Canceled", status: "CANCELED", count: payoutListing.tabs.canceled }
  ];

  return (
    <AppShell
      title="Rebate Queue"
      kicker="Finance Queue"
      description="Search, sort, and inspect every payout entry from one operations screen."
      links={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/assignments", label: "Assignments" },
        { href: "/admin/participants", label: "Participants" },
        { href: "/", label: "Overview" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <ProgressLink href="/">Home</ProgressLink>
          <span>/</span>
          <ProgressLink href="/admin">Finance</ProgressLink>
          <span>/</span>
          <strong>Rebate Queue</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Rebate Queue</div>
              <p className="muted">
                Every payout is listed here with sortable columns and a dedicated detail page.
              </p>
            </div>
          </div>

          <QueryForm className="rk-search-row">
            <input
              defaultValue={payoutListing.filters.q}
              name="q"
              placeholder="Search by payment ID, email, campaign, or participant"
            />
            <input name="status" type="hidden" value={payoutListing.filters.status} />
            <input name="campaign" type="hidden" value={payoutListing.filters.campaign} />
            <input name="sort" type="hidden" value={payoutListing.filters.sort} />
            <input name="dir" type="hidden" value={payoutListing.filters.dir} />
            <input name="pageSize" type="hidden" value={payoutListing.filters.pageSize} />
            <button type="submit">Search</button>
          </QueryForm>

          <div className="rk-filter-row">
            <label className="field">
              Campaign
              <select
                defaultValue={payoutListing.filters.campaign}
                name="campaign"
                form="rk-filter-form"
              >
                <option value="">All campaigns</option>
                {payoutListing.campaigns.map((campaign) => (
                  <option key={campaign} value={campaign}>
                    {campaign}
                  </option>
                ))}
              </select>
            </label>
            <QueryForm className="rk-hidden-form" id="rk-filter-form">
              <input name="q" type="hidden" value={payoutListing.filters.q} />
              <input name="status" type="hidden" value={payoutListing.filters.status} />
              <input name="sort" type="hidden" value={payoutListing.filters.sort} />
              <input name="dir" type="hidden" value={payoutListing.filters.dir} />
              <input name="pageSize" type="hidden" value={payoutListing.filters.pageSize} />
              <button className="hero-link primary" type="submit">
                Apply campaign filter
              </button>
            </QueryForm>
          </div>

          <div className="rk-tabs">
            {statusTabs.map((tab) => {
              const active = (payoutListing.filters.status || "") === tab.status;
              return (
                <ProgressLink
                  className={`rk-tab ${active ? "active" : ""}`}
                  href={withParams(params, { status: tab.status || undefined, page: "1" })}
                  key={tab.label}
                >
                  {tab.label} ({tab.count})
                </ProgressLink>
              );
            })}
          </div>

          <div className="rk-info-banner">
            Payout entries can be reviewed by request date, filtered by campaign, and opened by
            unique payment ID for the full participant and assignment context.
          </div>

          <div className="rk-table-wrap">
            <table className="rk-table">
              <thead>
                <tr>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "uniquePaymentId")} label="Unique Payment ID" sortKey="uniquePaymentId" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "requestDate")} label="Request Date" sortKey="requestDate" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "email")} label="Email" sortKey="email" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "campaign")} label="Campaign" sortKey="campaign" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "participant")} label="Buyer" sortKey="participant" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "amount")} label="Payout" sortKey="amount" />
                  </th>
                  <th>
                    <SortLink activeDir={payoutListing.filters.dir} activeSort={payoutListing.filters.sort} href={sortHref(payoutListing.filters, "status")} label="Status" sortKey="status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {payoutListing.rows.length ? (
                  payoutListing.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <ProgressLink className="rk-id-link" href={`/admin/payouts/${encodeURIComponent(row.id)}`}>
                          {row.uniquePaymentId}
                        </ProgressLink>
                      </td>
                      <td>{row.requestDateLabel}</td>
                      <td>{row.email}</td>
                      <td>{row.campaign}</td>
                      <td>{row.participantName}</td>
                      <td>{row.amountLabel}</td>
                      <td>
                        <span
                          className={`badge ${row.status === "PAID" ? "good" : row.status === "FAILED" ? "alert" : "warn"}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="rk-empty" colSpan={7}>
                      No payouts matched the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            basePath="/admin/payouts"
            page={payoutListing.pagination.page}
            pageSize={payoutListing.pagination.pageSize}
            query={payoutListing.filters}
            totalItems={payoutListing.pagination.totalItems}
          />
        </article>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div className="rk-section-title">Create payout entry</div>
          </div>
          <ActionForm action={createPayoutAction} className="form-grid">
            <div className="form-grid two">
              <label className="field">
                Assignment
                <select name="assignmentId" required defaultValue="">
                  <option value="" disabled>
                    Select assignment
                  </option>
                  {managementOptions?.assignments?.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Participant
                <select name="participantId" required defaultValue="">
                  <option value="" disabled>
                    Select participant
                  </option>
                  {managementOptions?.participants?.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid two">
              <label className="field">
                Amount
                <input name="amount" placeholder="10.59" />
              </label>
              <label className="field">
                Recipient email
                <input name="recipientEmail" placeholder="paypal@example.com" />
              </label>
            </div>
            <div className="form-grid two">
              <label className="field">
                Payout type
                <select name="payoutType" defaultValue="manual_adjustment">
                  <option value="manual_adjustment">Manual adjustment</option>
                  <option value="base_reimbursement">Base reimbursement</option>
                  <option value="bonus">Bonus</option>
                </select>
              </label>
              <label className="field">
                Status
                <select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">Draft</option>
                  <option value="QUEUED">Queued</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                </select>
              </label>
            </div>
            <SubmitButton className="hero-link primary" pendingLabel="Creating payout...">
              Create payout
            </SubmitButton>
          </ActionForm>
        </article>
      </section>
    </AppShell>
  );
}
