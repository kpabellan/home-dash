import { monitor } from "@/lib/monitor";

export const dynamic = "force-dynamic";

// The latest result for every service, straight from the background monitor.
// The dashboard uses /api/status/stream instead; this is for scripts and curl.
export async function GET() {
  await monitor.ready(3000);
  return Response.json({ checkedAt: Date.now(), ...monitor.snapshot() });
}
