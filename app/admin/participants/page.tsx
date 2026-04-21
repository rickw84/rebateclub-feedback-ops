import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProgressLink } from "@/components/progress-link";
import { getServerSession } from "@/lib/auth";
import { getParticipantListingData } from "@/lib/dashboard-data";

export default async function ParticipantsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await getServerSession();
  const params = (await searchParams) ?? {};
  const participantListing = await getParticipantListingData(params);
  const participantRows = participantListing.rows;

  return (
    <AppShell
      title="Participant Monitoring"
      kicker="Admin Queue"
      description="Verification state, score, payout readiness, and assignment history at a glance."
      links={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/assignments", label: "Assignments" },
        { href: "/admin/payouts", label: "Payouts" },
        { href: "/portal", label: "Portal View" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <span>Home</span>
          <span>/</span>
          <ProgressLink href="/admin">Admin Workspace</ProgressLink>
          <span>/</span>
          <strong>Participants</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Participant monitoring</div>
              <p className="muted">
                Review verification state, health score, assignment volume, and payout history in
                one place.
              </p>
            </div>
          </div>

          <div className="mini-metrics">
            <div className="mini-metric">
              <div className="mini-metric-label">Profiles loaded</div>
              <div className="mini-metric-value">{participantListing.pagination.totalItems}</div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">Verified profiles</div>
              <div className="mini-metric-value">
                {participantRows.filter((row) => row.status === "VERIFIED").length}
              </div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">High scores</div>
              <div className="mini-metric-value">
                {participantRows.filter((row) => Number(row.score) >= 80).length}
              </div>
            </div>
          </div>
        </article>

        <article className="rk-panel">
          <div className="rk-info-banner">
            This page is meant to become the main reviewer health queue, including verification,
            completion quality, payout risk, and internal profile notes.
          </div>

          <div className="rk-table-wrap with-top-border">
            <table className="rk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Marketplace</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Assignments</th>
                  <th>Payouts</th>
                </tr>
              </thead>
              <tbody>
                {participantRows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.marketplace}</td>
                    <td>{row.status}</td>
                    <td>{row.score}</td>
                    <td>{row.assignments}</td>
                  <td>{row.payouts}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          <PaginationControls
            basePath="/admin/participants"
            page={participantListing.pagination.page}
            pageSize={participantListing.pagination.pageSize}
            query={{
              page: String(participantListing.pagination.page),
              pageSize: String(participantListing.pagination.pageSize)
            }}
            totalItems={participantListing.pagination.totalItems}
          />
        </article>
      </section>
    </AppShell>
  );
}
