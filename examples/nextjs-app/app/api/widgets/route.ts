import { NextResponse } from "next/server";
import { captureException } from "@/lib/runtimecatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("Missing `id` query param");

    // … your real lookup …
    const widget = { id, name: "Example widget" };

    return NextResponse.json(widget);
  } catch (err) {
    await captureException(err, {
      route: "GET /api/widgets",
      url: request.url,
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
