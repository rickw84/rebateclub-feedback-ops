import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";

const roles = [
  {
    role: "OWNER",
    label: "Enter as owner",
    description: "Full access to dashboard, participant ops, payouts, and configuration."
  },
  {
    role: "MANAGER",
    label: "Enter as manager",
    description: "Review assignments, approve submissions, and handle participant workflows."
  },
  {
    role: "PARTICIPANT",
    label: "Enter as participant",
    description: "See assigned work, upload deliverables, and check payout history."
  }
] as const;

export default function LoginPage() {
  return (
    <AppShell
      title="Demo Access"
      kicker="Auth Scaffold"
      description="A lightweight cookie-based session flow until a full auth provider is attached."
      links={[
        { href: "/", label: "Overview" },
        { href: "/admin", label: "Admin" },
        { href: "/portal", label: "Portal" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <strong>Login</strong>
        </div>

        <article className="rk-panel">
          <div className="rk-panel-header">
            <div>
              <div className="rk-section-title">Choose a demo session</div>
              <p className="muted">
                This local MVP uses a lightweight cookie-based session so each app area can be
                tested before a full authentication provider is connected.
              </p>
            </div>
          </div>

          <div className="rk-info-banner">
            Pick the role that best matches the workflow you want to test. The owner and manager
            paths are best for dashboard iteration, while participant is useful for portal flow
            review.
          </div>
        </article>

        <div className="grid-three">
          {roles.map((item) => (
            <article className="card stack" key={item.role}>
              <div className="eyebrow">{item.role}</div>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
              <ActionForm action="/api/auth/session" method="post">
                <input name="role" type="hidden" value={item.role} />
                <input
                  name="name"
                  type="hidden"
                  value={item.role === "PARTICIPANT" ? "Participant Demo" : `${item.role} Demo`}
                />
                <SubmitButton className="hero-link primary" pendingLabel="Starting session...">
                  Start session
                </SubmitButton>
              </ActionForm>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
