import { PlayerOutputs, playerOutputsSchema } from "@/lib/types";
import { resumeHook } from "workflow/api";

export async function POST(request: Request) {
  let hookToken: string | undefined;
  
  try {
    const body = await request.json();
    const parsed = body as {
      hookToken: string;
      outputs: PlayerOutputs;
    };
    hookToken = parsed.hookToken;
    const outputs = parsed.outputs;

    if (!hookToken) {
      return Response.json({ error: "Missing hookToken" }, { status: 400 });
    }

    if (!outputs) {
      return Response.json({ error: "Missing outputs" }, { status: 400 });
    }

    // Validate the outputs against the schema
    const validatedOutputs = playerOutputsSchema.safeParse(outputs);
    if (!validatedOutputs.success) {
      return Response.json(
        { error: "Invalid outputs", details: validatedOutputs.error.issues },
        { status: 400 }
      );
    }

    // Resume the workflow hook with the player's outputs
    console.log(`[API] Resuming hook ${hookToken}`);
    console.log(`[API] Outputs:`, JSON.stringify(validatedOutputs.data, null, 2));
    
    const result = await resumeHook(hookToken, validatedOutputs.data);

    console.log(`[API] Hook resumed successfully, runId: ${result.runId}`);
    return Response.json({
      success: true,
      runId: result.runId,
    });
  } catch (error) {
    console.error("[API] Error resuming hook:", error);
    console.error("[API] Hook token was:", hookToken);

    // Check if it's a "hook not found" error
    if (error instanceof Error && error.message.includes("not found")) {
      return Response.json(
        { error: "Hook not found or already consumed" },
        { status: 404 }
      );
    }

    return Response.json(
      { error: "Failed to submit player input" },
      { status: 500 }
    );
  }
}

