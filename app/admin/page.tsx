import { AppShell } from "@/components/app-shell";
import { ActionForm } from "@/components/action-form";
import { StatCard } from "@/components/stat-card";
import { SubmitButton } from "@/components/submit-button";
import {
  createAssignmentAction,
  createCampaignAction,
  createParticipantAction
} from "@/app/admin/actions";
import { getServerSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function AdminPage() {
  const session = await getServerSession();
  const { managementOptions, participantRows, payoutRows, stats, urgentQueue } = await getDashboardData();

  return (
    <AppShell
      title="Admin Workspace"
      kicker="Operations Console"
      description="Campaign oversight, participant verification, submission review, and payout monitoring."
      links={[
        { href: "/", label: "Overview" },
        { href: "/admin/assignments", label: "Assignments" },
        { href: "/admin/participants", label: "Participants" },
        { href: "/admin/payouts", label: "Payouts" },
        { href: "/portal", label: "Portal View" },
        { href: session ? session.landingPath : "/login", label: session ? `${session.role} Session` : "Login" }
      ]}
    >
      <section className="sections">
        <div className="rk-breadcrumb">
          <span>Home</span>
          <span>/</span>
          <strong>Admin Workspace</strong>
        </div>

        <div className="grid-three">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} delta={stat.delta} />
          ))}
        </div>

        <div className="dashboard-grid">
          <article className="card">
            <div className="eyebrow">Ops queue</div>
            <h3>Priority actions</h3>
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

          <article className="card">
            <div className="eyebrow">Migration posture</div>
            <h3>Implementation notes</h3>
            <ul className="list">
              <li className="list-item">
                <div>
                  <strong>Prisma schema is ready</strong>
                  <span className="muted">Campaigns, assignments, payout batches, and payouts are normalized.</span>
                </div>
              </li>
              <li className="list-item">
                <div>
                  <strong>Importer is validated</strong>
                  <span className="muted">The shared payment tracker converts into normalized JSON with zero warnings.</span>
                </div>
              </li>
              <li className="list-item">
                <div>
                  <strong>Seed flow is prepared</strong>
                  <span className="muted">Once Postgres is connected, the imported history can be loaded into Prisma.</span>
                </div>
              </li>
            </ul>
          </article>
        </div>

        <div className="table-grid">
          <article className="table-card">
            <div className="eyebrow">Participants</div>
            <h3>High-signal participant records</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Assignments</th>
                </tr>
              </thead>
              <tbody>
                {participantRows.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.status}</td>
                    <td>{row.score}</td>
                    <td>{row.assignments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="table-card">
            <div className="eyebrow">Payout activity</div>
            <h3>Recent batch examples</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Participant</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payoutRows.map((row) => (
                  <tr key={`${row.source}-${row.participant}`}>
                    <td>{row.source}</td>
                    <td>{row.participant}</td>
                    <td>{row.batchType}</td>
                    <td>{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>

        <div className="table-grid">
          <article className="rk-panel stack">
            <div>
              <div className="eyebrow">Create campaign</div>
              <h3>Add a live campaign</h3>
              <p>
                This writes into the local live store immediately, so you can create new campaign
                shells and see the dashboard counts update right away.
              </p>
            </div>
            <ActionForm action={createCampaignAction} className="form-grid">
              <label className="field">
                Campaign name
                <input name="name" placeholder="Week 18 spring push" required />
              </label>
              <div className="form-grid two">
                <label className="field">
                  Client / brand
                  <input name="clientName" placeholder="Savepod" />
                </label>
                <label className="field">
                  Reward amount
                  <input name="rewardAmount" placeholder="25.00" />
                </label>
              </div>
              <label className="field">
                Description
                <textarea name="description" placeholder="Briefly describe the participant deliverables." />
              </label>
              <label className="field">
                Status
                <select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </label>
              <SubmitButton className="hero-link primary" pendingLabel="Creating campaign...">
                Create campaign
              </SubmitButton>
            </ActionForm>
          </article>

          <article className="rk-panel stack">
            <div>
              <div className="eyebrow">Create participant</div>
              <h3>Add a participant profile</h3>
              <p>
                This replaces the old verification spreadsheet step with a real participant record.
              </p>
            </div>
            <ActionForm action={createParticipantAction} className="form-grid">
              <div className="form-grid two">
                <label className="field">
                  Full name
                  <input name="name" placeholder="Taylor Smith" required />
                </label>
                <label className="field">
                  Email
                  <input name="email" placeholder="taylor@example.com" required />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  PayPal email
                  <input name="paypalEmail" placeholder="paypal@example.com" />
                </label>
                <label className="field">
                  Marketplace
                  <input name="marketplace" defaultValue="amazon.com" />
                </label>
              </div>
              <label className="field">
                Verification status
                <select name="verificationStatus" defaultValue="NEW">
                  <option value="NEW">New</option>
                  <option value="PENDING_REVIEW">Pending review</option>
                  <option value="VERIFIED">Verified</option>
                </select>
              </label>
              <SubmitButton className="hero-link primary" pendingLabel="Creating participant...">
                Create participant
              </SubmitButton>
            </ActionForm>
          </article>
        </div>

        <article className="rk-panel stack">
          <div>
            <div className="eyebrow">Create assignment</div>
            <h3>Assign a participant to a product</h3>
            <p>
              This is the minimum live workflow step to move a participant into active work.
            </p>
          </div>
          <ActionForm action={createAssignmentAction} className="form-grid">
            <div className="form-grid two">
              <label className="field">
                Campaign
                <select name="campaignId" required defaultValue="">
                  <option value="" disabled>
                    Select campaign
                  </option>
                  {managementOptions?.campaigns?.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
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
                Product
                <select name="productId" required defaultValue="">
                  <option value="" disabled>
                    Select product
                  </option>
                  {managementOptions?.products?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Base reward
                <input name="baseRewardAmount" placeholder="20.00" />
              </label>
            </div>
            <div className="form-grid two">
              <label className="field">
                Source label
                <input name="sourceLabel" placeholder="Week 19 launch" />
              </label>
              <label className="field">
                Status
                <select name="status" defaultValue="ASSIGNED">
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="SUBMITTED">Submitted</option>
                </select>
              </label>
            </div>
            <label className="field">
              Internal notes
              <textarea name="internalNotes" placeholder="Any assignment guidance or special handling notes." />
            </label>
            <SubmitButton className="hero-link primary" pendingLabel="Creating assignment...">
              Create assignment
            </SubmitButton>
          </ActionForm>
        </article>
      </section>
    </AppShell>
  );
}
