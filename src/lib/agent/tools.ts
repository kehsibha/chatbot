/**
 * Agent tools. Each tool has:
 *  - a JSON schema for the Anthropic API
 *  - an `execute` function that mutates the local SQLite DB via Drizzle
 *
 * Tools return a small JSON payload summarizing the change. The agent loop
 * streams a `tool_result` event to the UI after each execute, and the
 * frontend refetches the affected slice of state (via React Query) so the
 * board stays in sync.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/lib/db";
import type { ActionStatus, ProjectStatus } from "@/lib/db/schema";
import {
  executeNavigateUI,
  navigateUISchema,
} from "@/lib/agent/navigation";

// ---------- zod schemas ----------

const actionStatusEnum = z.enum([
  "inbox",
  "next",
  "waiting",
  "scheduled",
  "done",
  "someday",
]);

const projectStatusEnum = z.enum(["active", "on_hold", "someday", "done"]);

const captureSchema = z.object({
  title: z.string().min(1).describe("Short title for the captured thought"),
  notes: z.string().optional().describe("Optional longer notes"),
});

const clarifySchema = z.object({
  actionId: z.string().describe("The id of the inbox action being clarified"),
  title: z.string().optional().describe("Optional cleaner title"),
  notes: z.string().optional(),
  projectId: z
    .string()
    .nullable()
    .optional()
    .describe("Attach to this project, or null for a loose action"),
  status: actionStatusEnum.describe(
    "Where the action belongs after clarification",
  ),
  context: z
    .string()
    .optional()
    .describe("GTD context tag like @phone, @computer, @errands"),
  dueAt: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 due date/time"),
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 scheduled date/time"),
  delegatedTo: z
    .string()
    .optional()
    .describe("If waiting, who you're waiting on"),
  isFirstAction: z
    .boolean()
    .optional()
    .describe("Mark as the first/next action for its project"),
});

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: projectStatusEnum.optional().default("active"),
  color: z.string().optional().describe("Hex color like #6366f1"),
});

const createActionSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  projectId: z.string().nullable().optional(),
  status: actionStatusEnum.optional().default("next"),
  context: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  delegatedTo: z.string().optional(),
  isFirstAction: z.boolean().optional(),
});

const updateActionSchema = z.object({
  actionId: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().nullable().optional(),
  status: actionStatusEnum.optional(),
  context: z.string().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  delegatedTo: z.string().nullable().optional(),
  isFirstAction: z.boolean().optional(),
});

const completeActionSchema = z.object({
  actionId: z.string(),
});

const deleteActionSchema = z.object({
  actionId: z.string(),
});

const updateProjectSchema = z.object({
  projectId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: projectStatusEnum.optional(),
  color: z.string().optional(),
});

const readStateSchema = z.object({
  scope: z
    .enum(["all", "inbox", "today", "project"])
    .describe("Which slice of state to read"),
  projectId: z
    .string()
    .optional()
    .describe("Required when scope='project'"),
});

// ---------- tool definitions for the Anthropic API ----------

type ToolDef<TInput> = {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  zod: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<unknown>;
};

function toJsonSchema(zodSchema: z.ZodType): Anthropic.Tool.InputSchema {
  // Tiny hand-rolled JSON-Schema converter. We keep tool inputs simple so
  // this stays tractable; for anything complex we'd reach for
  // `zod-to-json-schema` but that's one more dep we don't need.
  const def = (zodSchema as unknown as { _def: { typeName: string } })._def;
  if (def.typeName !== "ZodObject") {
    throw new Error("tool input must be a ZodObject");
  }
  const shape = (
    zodSchema as unknown as { shape: Record<string, z.ZodTypeAny> }
  ).shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(value);
    if (!value.isOptional()) required.push(key);
  }
  return {
    type: "object",
    properties,
    required,
  };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  let cur: z.ZodTypeAny = field;
  const description: string | undefined = (
    cur as unknown as { _def: { description?: string } }
  )._def.description;

  // Unwrap optional/default/nullable chains.
  while (true) {
    const t = (cur as unknown as { _def: { typeName: string } })._def.typeName;
    if (
      t === "ZodOptional" ||
      t === "ZodDefault" ||
      t === "ZodNullable"
    ) {
      cur = (cur as unknown as { _def: { innerType: z.ZodTypeAny } })._def
        .innerType;
      continue;
    }
    break;
  }

  const typeName = (cur as unknown as { _def: { typeName: string } })._def
    .typeName;

  const base: Record<string, unknown> = {};
  if (description) base.description = description;

  switch (typeName) {
    case "ZodString": {
      const checks =
        (cur as unknown as { _def: { checks?: Array<{ kind: string }> } })._def
          .checks ?? [];
      if (checks.some((c) => c.kind === "datetime")) {
        return { ...base, type: "string", format: "date-time" };
      }
      return { ...base, type: "string" };
    }
    case "ZodNumber":
      return { ...base, type: "number" };
    case "ZodBoolean":
      return { ...base, type: "boolean" };
    case "ZodEnum": {
      const values = (cur as unknown as { _def: { values: string[] } })._def
        .values;
      return { ...base, type: "string", enum: values };
    }
    default:
      return { ...base };
  }
}

function makeTool<TInput>(
  name: string,
  description: string,
  zodSchema: z.ZodType<TInput>,
  execute: (input: TInput) => Promise<unknown>,
): ToolDef<TInput> {
  return {
    name,
    description,
    input_schema: toJsonSchema(zodSchema),
    zod: zodSchema,
    execute,
  };
}

// ---------- date helpers ----------

const toDate = (iso?: string | null) =>
  iso == null ? null : new Date(iso);

// ---------- tool implementations ----------

export const captureThought = makeTool(
  "capture_thought",
  "Add a raw, unprocessed thought or task to the inbox. Use this for quick capture before clarifying — prefer this for anything the user dumps on you without deciding what to do with it.",
  captureSchema,
  async ({ title, notes }) => {
    const id = nanoid();
    db.insert(schema.actions)
      .values({
        id,
        title,
        notes: notes ?? null,
        status: "inbox",
        position: Date.now(),
      })
      .run();
    return { id, title, status: "inbox" };
  },
);

export const clarifyInboxItem = makeTool(
  "clarify_inbox_item",
  "Process an inbox item: decide what it is (next action, waiting-for, scheduled, someday, or done/trash) and optionally attach it to a project and add context tags. This is the GTD 'clarify' step.",
  clarifySchema,
  async (input) => {
    const patch: Record<string, unknown> = {
      status: input.status,
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.projectId !== undefined) patch.projectId = input.projectId;
    if (input.context !== undefined) patch.context = input.context;
    if (input.dueAt !== undefined) patch.dueAt = toDate(input.dueAt);
    if (input.scheduledAt !== undefined)
      patch.scheduledAt = toDate(input.scheduledAt);
    if (input.delegatedTo !== undefined) patch.delegatedTo = input.delegatedTo;
    if (input.isFirstAction !== undefined)
      patch.isFirstAction = input.isFirstAction;
    if (input.status === "done") patch.completedAt = new Date();

    db.update(schema.actions)
      .set(patch)
      .where(eq(schema.actions.id, input.actionId))
      .run();

    return { id: input.actionId, status: input.status };
  },
);

export const createProject = makeTool(
  "create_project",
  "Create a new project. A project is anything that takes more than one action to complete.",
  createProjectSchema,
  async ({ title, description, status, color }) => {
    const id = nanoid();
    db.insert(schema.projects)
      .values({
        id,
        title,
        description: description ?? null,
        status: (status ?? "active") as ProjectStatus,
        color: color ?? null,
      })
      .run();
    return { id, title };
  },
);

export const updateProject = makeTool(
  "update_project",
  "Update an existing project's metadata or status (e.g. mark as on_hold, someday, done).",
  updateProjectSchema,
  async (input) => {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "done") patch.completedAt = new Date();
    }
    if (input.color !== undefined) patch.color = input.color;

    db.update(schema.projects)
      .set(patch)
      .where(eq(schema.projects.id, input.projectId))
      .run();
    return { id: input.projectId };
  },
);

export const createAction = makeTool(
  "create_action",
  "Create a fully-formed action. Use when the user already knows the category (next, waiting, scheduled). For unprocessed dumps, use capture_thought instead.",
  createActionSchema,
  async (input) => {
    const id = nanoid();
    db.insert(schema.actions)
      .values({
        id,
        title: input.title,
        notes: input.notes ?? null,
        projectId: input.projectId ?? null,
        status: (input.status ?? "next") as ActionStatus,
        context: input.context ?? null,
        dueAt: toDate(input.dueAt) ?? null,
        scheduledAt: toDate(input.scheduledAt) ?? null,
        delegatedTo: input.delegatedTo ?? null,
        isFirstAction: input.isFirstAction ?? false,
        position: Date.now(),
      })
      .run();
    return { id, title: input.title };
  },
);

export const updateAction = makeTool(
  "update_action",
  "Update fields on an existing action. Pass only the fields you want to change.",
  updateActionSchema,
  async (input) => {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.projectId !== undefined) patch.projectId = input.projectId;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "done") patch.completedAt = new Date();
    }
    if (input.context !== undefined) patch.context = input.context;
    if (input.dueAt !== undefined) patch.dueAt = toDate(input.dueAt);
    if (input.scheduledAt !== undefined)
      patch.scheduledAt = toDate(input.scheduledAt);
    if (input.delegatedTo !== undefined) patch.delegatedTo = input.delegatedTo;
    if (input.isFirstAction !== undefined)
      patch.isFirstAction = input.isFirstAction;

    db.update(schema.actions)
      .set(patch)
      .where(eq(schema.actions.id, input.actionId))
      .run();
    return { id: input.actionId };
  },
);

export const completeAction = makeTool(
  "complete_action",
  "Mark an action as done. Shortcut for update_action with status=done.",
  completeActionSchema,
  async ({ actionId }) => {
    db.update(schema.actions)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(schema.actions.id, actionId))
      .run();
    return { id: actionId, status: "done" };
  },
);

export const deleteAction = makeTool(
  "delete_action",
  "Delete an action entirely. Prefer complete_action unless the item was garbage / a duplicate / misfire.",
  deleteActionSchema,
  async ({ actionId }) => {
    db.delete(schema.actions)
      .where(eq(schema.actions.id, actionId))
      .run();
    return { id: actionId, deleted: true };
  },
);

export const navigateUI = makeTool(
  "navigate_ui",
  "Open a screen in the user's running app (client-side navigation). Use when they ask to go somewhere, see a list, or open a project — do not only describe it in text. For a specific project board, pass path=project and the real projectId from the snapshot or read_state.",
  navigateUISchema,
  async (input) => executeNavigateUI(input),
);

export const readState = makeTool(
  "read_state",
  "Read a slice of current state. Use this when you need to look up ids or see what's already in a project/inbox/today.",
  readStateSchema,
  async ({ scope, projectId }) => {
    if (scope === "inbox") {
      return {
        inbox: db
          .select()
          .from(schema.actions)
          .where(eq(schema.actions.status, "inbox"))
          .all(),
      };
    }
    if (scope === "project") {
      if (!projectId) throw new Error("projectId is required for scope=project");
      const project = db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      const actions = db
        .select()
        .from(schema.actions)
        .where(eq(schema.actions.projectId, projectId))
        .all();
      return { project, actions };
    }
    if (scope === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const all = db
        .select()
        .from(schema.actions)
        .where(
          and(
            eq(schema.actions.status, "next"),
            // NB: drizzle doesn't easily express "due today or before" in
            // typed form here; we filter in JS for clarity.
          ),
        )
        .all();
      const today = all.filter((a) => {
        const due = a.dueAt?.getTime();
        const sched = a.scheduledAt?.getTime();
        return (
          (due != null && due <= end.getTime()) ||
          (sched != null && sched <= end.getTime())
        );
      });
      return { today };
    }
    // all
    const projects = db.select().from(schema.projects).all();
    const actions = db.select().from(schema.actions).all();
    return { projects, actions };
  },
);

// ---------- registry ----------

export const ALL_TOOLS = [
  captureThought,
  clarifyInboxItem,
  createProject,
  updateProject,
  createAction,
  updateAction,
  completeAction,
  deleteAction,
  navigateUI,
  readState,
];

export type AnyTool = (typeof ALL_TOOLS)[number];

export function getToolByName(name: string): AnyTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function toolParamsForApi(): Anthropic.Tool[] {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
