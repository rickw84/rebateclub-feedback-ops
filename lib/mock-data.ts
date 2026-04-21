export const importSummary = {
  participantProfiles: 193,
  assignments: 790,
  payoutBatches: 783,
  payouts: 1336,
  campaigns: 19,
  products: 68
};

export const adminStats = [
  {
    label: "Active Campaigns",
    value: "19",
    delta: "Imported from legacy tracker"
  },
  {
    label: "Tracked Participants",
    value: "193",
    delta: "Verified and pending profiles combined"
  },
  {
    label: "Assignment Records",
    value: "790",
    delta: "Campaign-product work units"
  },
  {
    label: "Payout Events",
    value: "783",
    delta: "Batch-level PayPal sends"
  }
];

export const urgentQueue = [
  {
    title: "Submission review queue",
    detail: "24 assignments are waiting on an approval decision before the next payout run.",
    badge: "Needs review",
    tone: "warn"
  },
  {
    title: "Risk flags",
    detail: "7 participants have repeated non-response or manual notes that require manager approval.",
    badge: "Watchlist",
    tone: "alert"
  },
  {
    title: "Unreconciled payouts",
    detail: "3 payout batches are missing proof attachments or provider references.",
    badge: "Ops check",
    tone: "good"
  }
] as const;

export const adminTimeline = [
  {
    title: "Intake and verification",
    text: "Participants join, provide payout credentials, and move through a verification queue before they can receive assignments."
  },
  {
    title: "Campaign assignment",
    text: "Managers publish campaigns, participants apply for eligible products, and the team approves or rejects requests with duplicate-product protection."
  },
  {
    title: "Submission and payout",
    text: "Participants submit deliverables, reviewers approve or request revisions, and payout batches are created only after approved work."
  }
];

export const participantRows = [
  {
    name: "Jennifer Grayer",
    marketplace: "amazon.com",
    score: 92,
    status: "Verified",
    assignments: 8,
    payouts: "$218.77"
  },
  {
    name: "Ayaka Honda",
    marketplace: "amazon.com",
    score: 89,
    status: "Verified",
    assignments: 11,
    payouts: "$267.92"
  },
  {
    name: "Rachel St Germain",
    marketplace: "amazon.com",
    score: 81,
    status: "Watchlist",
    assignments: 6,
    payouts: "$124.73"
  },
  {
    name: "Charleen Abernath",
    marketplace: "amazon.com",
    score: 74,
    status: "Pending proof",
    assignments: 5,
    payouts: "$96.62"
  }
];

export const payoutRows = [
  {
    source: "Week 35, 2025",
    participant: "Faith Kessler",
    batchType: "Base reimbursement",
    amount: "$33.65",
    status: "Paid"
  },
  {
    source: "Week 36, 2025",
    participant: "Ayaka Honda",
    batchType: "Bonus",
    amount: "$14.04",
    status: "Paid"
  },
  {
    source: "$20 Commission",
    participant: "Rachel St Germain",
    batchType: "Bonus",
    amount: "$20.88",
    status: "Pending reconciliation"
  },
  {
    source: "Week 52, 2025",
    participant: "Monica Santiago",
    batchType: "Base reimbursement",
    amount: "$30.12",
    status: "Paid"
  }
];

export const portalTasks = [
  {
    title: "Finish onboarding",
    detail: "Confirm your payout email, marketplace, and participant profile details.",
    badge: "Step 1"
  },
  {
    title: "Review assigned deliverables",
    detail: "See due dates, task expectations, and revision notes in one place.",
    badge: "Step 2"
  },
  {
    title: "Submit approved proof",
    detail: "Upload survey responses, screenshots, photos, or links for manager review.",
    badge: "Step 3"
  }
];
