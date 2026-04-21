import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getServerSession } from "@/lib/auth";
import { getPortalData } from "@/lib/dashboard-data";

export default async function PortalPage() {
  const session = await getServerSession();
  const { snapshot, tasks } = await getPortalData();

  return (
    <AppShell
      title="Participant Portal"
      kicker="User Workspace"
      description="A cleaner replacement for the email-driven participant experience."
      links={[
        { href: "/", label: "Overview" },
        { href: "/admin", label: "Admin View" },
        { href: "/admin/participants", label: "Participant Queue" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <strong>Participant Portal</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Participant home</div>
              <p className="muted">
                One place to review tasks, submit proof, respond to revisions, and monitor payout
                progress.
              </p>
            </div>
          </div>

          <div className="rk-info-banner">
            Participants no longer need to manage assignment steps through scattered email threads.
            The portal is meant to become the single source of truth for instructions, proof, and
            payout visibility.
          </div>
        </article>

        <div className="grid-two">
          <StatCard
            label="Tracked Assignments"
            value={String(snapshot.assignmentCount)}
            delta="Open or active work in the dataset"
          />
          <StatCard
            label="Payout Records"
            value={String(snapshot.payoutCount)}
            delta="Visible to the participant portal"
          />
        </div>

        <div className="grid-three">
          {tasks.map((task) => (
            <article className="card stack" key={task.title}>
              <div className="badge good">{task.badge}</div>
              <h3>{task.title}</h3>
              <p>{task.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
