import { getRun } from "workflow/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  try {
    const run = getRun(runId);

    // Log run info for debugging
    const [status, createdAt, completedAt] = await Promise.all([
      run.status,
      run.createdAt,
      run.completedAt,
    ]);
    console.log(
      `[Stream] Run ${runId}: status=${status}, created=${createdAt?.toISOString()}, completed=${completedAt?.toISOString()}`
    );

    // Start from index 0 to get all data from the beginning
    const readable = run.getReadable({ startIndex: 0 });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Stream] Error getting run:", error);
    return Response.json({ error: "Run not found" }, { status: 404 });
  }
}
