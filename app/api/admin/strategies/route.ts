import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  DefaultStrategy,
  DefaultStrategyInput,
  getDefaultStrategiesKey,
} from "@/lib/access-control";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const MAX_STRATEGY_LENGTH = 1000;

// GET - List all default strategies (admin only)
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const strategies =
      (await kv.get<DefaultStrategy[]>(getDefaultStrategiesKey())) || [];
    return NextResponse.json({ strategies });
  } catch (error) {
    console.error("Error fetching default strategies:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}

// POST - Create a new default strategy (admin only)
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input: DefaultStrategyInput = await request.json();

    if (!input.name?.trim() || !input.prompt?.trim()) {
      return NextResponse.json(
        { error: "Name and prompt are required" },
        { status: 400 }
      );
    }

    // Enforce max strategy length
    const prompt = input.prompt.trim().slice(0, MAX_STRATEGY_LENGTH);

    const strategies =
      (await kv.get<DefaultStrategy[]>(getDefaultStrategiesKey())) || [];

    const newStrategy: DefaultStrategy = {
      id: `default-${Date.now()}`,
      name: input.name.trim().slice(0, 100),
      prompt,
      createdAt: Date.now(),
    };

    strategies.push(newStrategy);
    await kv.set(getDefaultStrategiesKey(), strategies);

    // Revalidate the home page to pick up new strategies
    revalidatePath("/");

    return NextResponse.json({ strategy: newStrategy }, { status: 201 });
  } catch (error) {
    console.error("Error creating default strategy:", error);
    return NextResponse.json(
      { error: "Failed to create strategy" },
      { status: 500 }
    );
  }
}

