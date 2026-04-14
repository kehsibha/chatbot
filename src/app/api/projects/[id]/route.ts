/**
 * GET    /api/projects/:id   → single project + its actions
 * PATCH  /api/projects/:id   → update a project
 * DELETE /api/projects/:id   → delete a project (actions detach; projectId -> null)
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
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  if (!project) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const actions = db
    .select()
    .from(schema.actions)
    .where(eq(schema.actions.projectId, id))
    .all();
  return Response.json({ project, actions });
}

const patchSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "on_hold", "someday", "done"]).optional(),
  color: z.string().nullable().optional(),
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
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "done") patch.completedAt = new Date();
  db.update(schema.projects)
    .set(patch)
    .where(eq(schema.projects.id, id))
    .run();
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  return Response.json(project);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  db.delete(schema.projects).where(eq(schema.projects.id, id)).run();
  return Response.json({ deleted: true });
}
