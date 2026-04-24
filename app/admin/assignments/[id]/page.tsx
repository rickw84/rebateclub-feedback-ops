import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AssignmentOpportunitySummaryForm } from "@/components/assignment-opportunity-summary-form";
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
      description="Edit the assignment set using the same layout as the New Assignment form."
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
              <div className="rk-section-title">Edit assignment set</div>
              <p className="muted">
                Update the grouped assignment details, payment fields, and product rows here.
              </p>
            </div>
          </div>

          <AssignmentOpportunitySummaryForm detail={detail} />
        </article>
      </section>
    </AppShell>
  );
}
