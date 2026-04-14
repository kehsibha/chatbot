/**
 * GET    /api/actions/:id    → single action
 * PATCH  /api/actions/:id    → partial update
 * DELETE /api/actions/:id    → delete
 */
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = db
    .select()
    .from(schema.actions)
    .where(eq(schema.actions.id, id))
    .get();
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row);
}

const patchSchema = z.object({
  title: z.string().optional(),
  notes: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  status: z
    .enum(["inbox", "next", "waiting", "scheduled", "done", "someday"])
    .optional(),
  context: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  delegatedTo: z.string().nullable().optional(),
  isFirstAction: z.boolean().optional(),
  position: z.number().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const patch: Record<string, unknown> = {};
  if (d.title !== undefined) patch.title = d.title;
  if (d.notes !== undefined) patch.notes = d.notes;
  if (d.projectId !== undefined) patch.projectId = d.projectId;
  if (d.status !== undefined) {
    patch.status = d.status;
    if (d.status === "done") patch.completedAt = new Date();
  }
  if (d.context !== undefined) patch.context = d.context;
  if (d.dueAt !== undefined)
    patch.dueAt = d.dueAt ? new Date(d.dueAt) : null;
  if (d.scheduledAt !== undefined)
    patch.scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
  if (d.delegatedTo !== undefined) patch.delegatedTo = d.delegatedTo;
  if (d.isFirstAction !== undefined) patch.isFirstAction = d.isFirstAction;
  if (d.position !== undefined) patch.position = d.position;

  db.update(schema.actions)
    .set(patch)
    .where(eq(schema.actions.id, id))
    .run();
  const row = db
    .select()
    .from(schema.actions)
    .where(eq(schema.actions.id, id))
    .get();
  return Response.json(row);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  db.delete(schema.actions).where(eq(schema.actions.id, id)).run();
  return Response.json({ deleted: true });
}
