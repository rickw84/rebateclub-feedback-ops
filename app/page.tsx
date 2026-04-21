import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getServerSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function HomePage() {
  const session = await getServerSession();
  const { stats, adminTimeline, importSummary, urgentQueue } = await getDashboardData();

  return (
    <AppShell
      title="Feedback Ops Starter"
      kicker="Product Feedback SaaS"
      description="A compliant operations layer for campaigns, participant verification, submissions, and payout tracking."
      links={[
        { href: "/admin", label: "Admin Dashboard" },
        { href: "/portal", label: "Participant Portal" },
        { href: "/admin/payouts", label: "Payout Ops" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <strong>Overview</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Operations overview</div>
              <p className="muted">
                The imported SOP and payment tracker are now mapped into one shared workflow for
                campaigns, participants, approvals, and payouts.
              </p>
            </div>
          </div>

          <div className="mini-metrics">
            <div className="mini-metric">
              <div className="mini-metric-label">Participant profiles</div>
              <div className="mini-metric-value">{importSummary.participantProfiles}</div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">Assignments</div>
              <div className="mini-metric-value">{importSummary.assignments}</div>
            </div>
            <div className="mini-metric">
              <div className="mini-metric-label">Payout records</div>
              <div className="mini-metric-value">{importSummary.payouts}</div>
            </div>
          </div>
        </article>

        <div className="grid-three">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} delta={stat.delta} />
          ))}
        </div>

        <div className="dashboard-grid">
          <article className="card">
            <div className="eyebrow">Operations flow</div>
            <h3>How the workflow moves</h3>
            <div className="timeline">
              {adminTimeline.map((step) => (
                <div className="timeline-item" key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="eyebrow">Focus queue</div>
            <h3>What the team sees first</h3>
            <ul className="list">
              {urgentQueue.map((item) => (
                <li className="list-item" key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <span className="muted">{item.detail}</span>
                  </div>
                  <span className={`badge ${item.tone}`}>{item.badge}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="grid-two">
          <article className="card">
            <div className="eyebrow">Migration posture</div>
            <h3>Why this feels different from the spreadsheet</h3>
            <p>
              Campaign work, participant verification, proof review, and payout reconciliation now
              sit in one product surface. The live MVP already mirrors your imported tracker
              history, so iteration can happen on real workflow shapes instead of placeholder data.
            </p>
          </article>

          <article className="card">
            <div className="eyebrow">Compliant payout rule</div>
            <h3>Approval still gates payment</h3>
            <p>
              The product is modeled around approved deliverables and private feedback, not public
              review sentiment. That keeps your internal process visible without making public
              posting the payment trigger.
            </p>
          </article>
        </div>
      </section>

      <div className="footer-note">
        The current local MVP uses the live data store fallback, so UI changes can be tested right
        away while the Prisma database path is finalized.
      </div>
    </AppShell>
  );
}
