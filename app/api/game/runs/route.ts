import { getRun } from "workflow/api";

export type RunInfo = {
  runId: string;
  seed: string;
  playerNames: string[];
  status: string;
  createdAt: string;
  completedAt: string | null;
};

// GET - List all runs by checking provided run IDs
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runIds } = body as { runIds: { runId: string; seed: string; playerNames: string[] }[] };

    if (!runIds || !Array.isArray(runIds)) {
      return Response.json({ runs: [] });
    }

    const runs: RunInfo[] = [];

    for (const runInfo of runIds) {
      try {
        const run = getRun(runInfo.runId);
        const [status, createdAt, completedAt] = await Promise.all([
          run.status,
          run.createdAt,
          run.completedAt,
        ]);

        runs.push({
          runId: runInfo.runId,
          seed: runInfo.seed,
          playerNames: runInfo.playerNames,
          status,
          createdAt: createdAt.toISOString(),
          completedAt: completedAt?.toISOString() || null,
        });
      } catch (error) {
        // Run not found or error - skip it
        console.log(`Run ${runInfo.runId} not found or error:`, error);
      }
    }

    // Sort by createdAt descending (newest first)
    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return Response.json({ runs });
  } catch (error) {
    console.error("Error listing runs:", error);
    return Response.json({ runs: [] });
  }
}

