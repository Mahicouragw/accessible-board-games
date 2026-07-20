import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const room = await store.rooms.byId(Number(params.id));
    if (!room) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ room, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
