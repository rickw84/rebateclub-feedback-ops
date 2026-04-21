import { AppShell } from "@/components/app-shell";
import { AssignmentSetModal } from "@/components/assignment-set-modal";
import { PaginationControls } from "@/components/pagination-controls";
import { ProgressLink } from "@/components/progress-link";
import { QueryForm } from "@/components/query-form";
import { SortLink } from "@/components/sort-link";
import { getServerSession } from "@/lib/auth";
import { getAssignmentOpportunityListingData } from "@/lib/dashboard-data";

type AssignmentsPageProps = {
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
  return qs ? `/admin/assignments?${qs}` : "/admin/assignments";
}

function sortHref(
  params: { q?: string; status?: string; campaign?: string; sort?: string; dir?: string; page?: string; pageSize?: string },
  key: string
) {
  const nextDir = params.sort === key && params.dir === "asc" ? "desc" : "asc";
  return withParams(params, { sort: key, dir: nextDir });
}

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const session = await getServerSession();
  const params = (await searchParams) ?? {};
  const listing = await getAssignmentOpportunityListingData(params);

  const statusTabs = [
    { label: "All Assignments", status: "", count: listing.tabs.all },
    { label: "Needs Approval", status: "DRAFT", count: listing.tabs.needsApproval },
    { label: "Sent", status: "SENT", count: listing.tabs.sent },
    { label: "Paid", status: "PAID", count: listing.tabs.paid },
    { label: "Failed", status: "FAILED", count: listing.tabs.failed },
    { label: "Canceled", status: "CANCELED", count: listing.tabs.canceled }
  ];

  return (
    <AppShell
      title="Assignments"
      kicker="Operations Queue"
      description="One row per review opportunity, grouped above the individual payout records."
      links={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/participants", label: "Participants" },
        { href: "/admin/payouts", label: "Payouts" },
        { href: "/", label: "Overview" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <ProgressLink href="/">Home</ProgressLink>
          <span>/</span>
          <ProgressLink href="/admin">Admin</ProgressLink>
          <span>/</span>
          <strong>Assignments</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Assignment queue</div>
              <div className="rk-panel-subactions">
                <AssignmentSetModal campaignSuggestions={listing.campaigns} />
              </div>
              <p className="muted">
                This is the higher-level screen for one review opportunity. It groups the related
                reimbursements, commission payouts, products, and review links onto one row.
              </p>
            </div>
          </div>

          <QueryForm className="rk-search-row">
            <input
              defaultValue={listing.filters.q}
              name="q"
              placeholder="Search by payment ID, name, email, PayPal, campaign, brand, or product"
            />
            <input name="status" type="hidden" value={listing.filters.status} />
            <input name="campaign" type="hidden" value={listing.filters.campaign} />
            <input name="sort" type="hidden" value={listing.filters.sort} />
            <input name="dir" type="hidden" value={listing.filters.dir} />
            <input name="pageSize" type="hidden" value={listing.filters.pageSize} />
            <button type="submit">Search</button>
          </QueryForm>

          <div className="rk-filter-row">
            <label className="field">
              Newsletter Campaign
              <select defaultValue={listing.filters.campaign} form="assignment-filter-form" name="campaign">
                <option value="">All campaigns</option>
                {listing.campaigns.map((campaign) => (
                  <option key={campaign} value={campaign}>
                    {campaign}
                  </option>
                ))}
              </select>
            </label>
            <QueryForm className="rk-hidden-form" id="assignment-filter-form">
              <input name="q" type="hidden" value={listing.filters.q} />
              <input name="status" type="hidden" value={listing.filters.status} />
              <input name="sort" type="hidden" value={listing.filters.sort} />
              <input name="dir" type="hidden" value={listing.filters.dir} />
              <input name="pageSize" type="hidden" value={listing.filters.pageSize} />
              <button className="hero-link primary" type="submit">
                Apply filter
              </button>
            </QueryForm>
          </div>

          <div className="rk-tabs">
            {statusTabs.map((tab) => {
              const active = (listing.filters.status || "") === tab.status;
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
            Assignment rows are grouped by one review opportunity. That means multiple unique
            payment IDs can belong to the same row when they are part of the same assignment set.
          </div>

          <div className="rk-table-wrap with-top-border">
            <table className="rk-table rk-wide-table">
              <thead>
                <tr>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "requestDate")} label="Request Date" sortKey="requestDate" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "name")} label="Name" sortKey="name" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "email")} label="Email" sortKey="email" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "paypal")} label="PayPal" sortKey="paypal" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "campaign")} label="Newsletter Campaign" sortKey="campaign" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "brand")} label="Brand" sortKey="brand" />
                  </th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "product")} label="Product" sortKey="product" />
                  </th>
                  <th>Total Cost + PP Fee</th>
                  <th>Full Payment Date</th>
                  <th>
                    <SortLink activeDir={listing.filters.dir} activeSort={listing.filters.sort} href={sortHref(listing.filters, "status")} label="Status" sortKey="status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {listing.rows.length ? (
                  listing.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.requestDateLabel}</td>
                      <td>
                        <ProgressLink className="rk-id-link" href={`/admin/assignments/${encodeURIComponent(row.id)}`}>
                          {row.participantName}
                        </ProgressLink>
                      </td>
                      <td>{row.email}</td>
                      <td>{row.paypalEmail}</td>
                      <td>{row.newsletterCampaign}</td>
                      <td>{row.brandSummary}</td>
                      <td>{row.productSummary}</td>
                      <td>{row.totalCostWithFeeLabel}</td>
                      <td>{row.fullPaymentDateLabel}</td>
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
                    <td className="rk-empty" colSpan={10}>
                      No assignment opportunities matched the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            basePath="/admin/assignments"
            page={listing.pagination.page}
            pageSize={listing.pagination.pageSize}
            query={listing.filters}
            totalItems={listing.pagination.totalItems}
          />
        </article>
      </section>
    </AppShell>
  );
}
