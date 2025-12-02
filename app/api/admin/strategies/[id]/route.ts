import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  DefaultStrategy,
  DefaultStrategyInput,
  getDefaultStrategiesKey,
} from "@/lib/access-control";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

// PUT - Update a default strategy (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const input: Partial<DefaultStrategyInput> = await request.json();

    const strategies =
      (await kv.get<DefaultStrategy[]>(getDefaultStrategiesKey())) || [];
    const index = strategies.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    if (input.name !== undefined) {
      strategies[index].name = input.name.trim();
    }
    if (input.prompt !== undefined) {
      strategies[index].prompt = input.prompt.trim();
    }

    await kv.set(getDefaultStrategiesKey(), strategies);

    // Revalidate the home page
    revalidatePath("/");

    return NextResponse.json({ strategy: strategies[index] });
  } catch (error) {
    console.error("Error updating default strategy:", error);
    return NextResponse.json(
      { error: "Failed to update strategy" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a default strategy (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const strategies =
      (await kv.get<DefaultStrategy[]>(getDefaultStrategiesKey())) || [];
    const filtered = strategies.filter((s) => s.id !== id);

    if (filtered.length === strategies.length) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    await kv.set(getDefaultStrategiesKey(), filtered);

    // Revalidate the home page
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting default strategy:", error);
    return NextResponse.json(
      { error: "Failed to delete strategy" },
      { status: 500 }
    );
  }
}

