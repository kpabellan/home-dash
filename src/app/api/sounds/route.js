import { listSounds } from "@/lib/sounds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ sounds: await listSounds() });
  } catch (e) {
    return Response.json({ error: `Couldn't read the sounds folder: ${e.message}` }, { status: 500 });
  }
}
