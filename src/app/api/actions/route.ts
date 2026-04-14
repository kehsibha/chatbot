/**
 * GET  /api/actions                 → list all actions (optionally filtered)
 *   query params: status, projectId, view=today|inbox
 * POST /api/actions                 → create an action
 */
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");

  let rows = db.select().from(schema.actions).all();

  if (view === "inbox") {
    rows = rows.filter((a) => a.status === "inbox");
  } else if (view === "today") {
    const now = Date.now();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    rows = rows.filter((a) => {
      if (a.status === "done") return false;
      const due = a.dueAt?.getTime();
      const sched = a.scheduledAt?.getTime();
      return (
        (due != null && due <= endOfToday.getTime()) ||
        (sched != null && sched <= endOfToday.getTime()) ||
        // Also include overdue items
        (due != null && due < now)
      );
    });
  } else {
    if (status) rows = rows.filter((a) => a.status === status);
    if (projectId) rows = rows.filter((a) => a.projectId === projectId);
  }

  // Sort for UI stability: position asc, then createdAt asc.
  rows.sort(
    (a, b) =>
      a.position - b.position ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return Response.json(rows);
}

const createSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  projectId: z.string().nullable().optional(),
  status: z
    .enum(["inbox", "next", "waiting", "scheduled", "done", "someday"])
    .optional(),
  context: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  delegatedTo: z.string().optional(),
  isFirstAction: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const id = nanoid();
  db.insert(schema.actions)
    .values({
      id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      projectId: parsed.data.projectId ?? null,
      status: parsed.data.status ?? "inbox",
      context: parsed.data.context ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : null,
      delegatedTo: parsed.data.delegatedTo ?? null,
      isFirstAction: parsed.data.isFirstAction ?? false,
      position: Date.now(),
    })
    .run();
  const created = db
    .select()
    .from(schema.actions)
    .where(eq(schema.actions.id, id))
    .get();
  return Response.json(created, { status: 201 });
}
