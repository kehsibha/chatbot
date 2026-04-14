import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Projects — top-level containers. A project is anything that needs more
 * than one action to complete (classic GTD definition).
 */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["active", "on_hold", "someday", "done"],
  })
    .notNull()
    .default("active"),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/**
 * Actions — individual tasks. May belong to a project or be "loose" (inbox).
 * The `status` field drives both the Kanban columns for a project and the
 * broader GTD organization.
 */
export const actions = sqliteTable("actions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  status: text("status", {
    enum: ["inbox", "next", "waiting", "scheduled", "done", "someday"],
  })
    .notNull()
    .default("inbox"),
  context: text("context"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  delegatedTo: text("delegated_to"),
  isFirstAction: integer("is_first_action", { mode: "boolean" })
    .notNull()
    .default(false),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/**
 * Events — append-only audit log. Every meaningful change (user message,
 * agent thinking, tool call, tool result) is an event. The structured tables
 * above are effectively a materialized view; events are the source of truth
 * for history, audit, and undo.
 */
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "user_message",
      "agent_thinking",
      "agent_message",
      "tool_call",
      "tool_result",
      "system",
    ],
  }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  relatedId: text("related_id"),
  runId: text("run_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// Type exports for use throughout the app.
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type ActionStatus = Action["status"];
export type ProjectStatus = Project["status"];
export type EventType = Event["type"];
