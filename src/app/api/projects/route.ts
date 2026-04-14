/**
 * GET  /api/projects        → list projects with action counts
 * POST /api/projects        → create a project
 */
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = db.select().from(schema.projects).all();
  const actions = db.select().from(schema.actions).all();

  const byProject: Record<
    string,
    { total: number; done: number; next: number; waiting: number }
  > = {};
  for (const a of actions) {
    if (!a.projectId) continue;
    const cur =
      byProject[a.projectId] ??
      (byProject[a.projectId] = { total: 0, done: 0, next: 0, waiting: 0 });
    cur.total += 1;
    if (a.status === "done") cur.done += 1;
    if (a.status === "next") cur.next += 1;
    if (a.status === "waiting") cur.waiting += 1;
  }

  return Response.json(
    projects.map((p) => ({
      ...p,
      counts: byProject[p.id] ?? {
        total: 0,
        done: 0,
        next: 0,
        waiting: 0,
      },
    })),
  );
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["active", "on_hold", "someday", "done"]).optional(),
  color: z.string().optional(),
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
  db.insert(schema.projects)
    .values({
      id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "active",
      color: parsed.data.color ?? null,
    })
    .run();
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  return Response.json(project, { status: 201 });
}
