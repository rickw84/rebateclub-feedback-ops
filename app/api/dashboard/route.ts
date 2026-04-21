import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-data";

export async function GET() {
  const data = await getDashboardData();

  return NextResponse.json({
    summary: data.importSummary,
    stats: data.stats,
    urgentQueue: data.urgentQueue,
    participants: data.participantRows,
    payouts: data.payoutRows
  });
}
