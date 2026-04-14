/**
 * Seed the database with a few example projects and actions so the UI isn't
 * empty on first run. Idempotent-ish: clears all existing rows first. Only
 * run in development.
 *
 * Usage: `pnpm db:seed`
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { nanoid } from "nanoid";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./gtd.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// Wipe existing data.
db.delete(schema.events).run();
db.delete(schema.actions).run();
db.delete(schema.projects).run();

const nowMs = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
const d = (offsetMs: number) => new Date(nowMs + offsetMs);

const blogId = nanoid();
const kitchenId = nanoid();
const q3Id = nanoid();
const frenchId = nanoid();

db.insert(schema.projects)
  .values([
    {
      id: blogId,
      title: "Launch personal blog",
      description:
        "Publish a new blog with at least 3 posts live. Outcome: the blog is accessible at a real URL and has content.",
      status: "active",
      color: "#6366f1",
    },
    {
      id: kitchenId,
      title: "Kitchen remodel",
      description: "Replace cabinets and countertops. Waiting on quotes.",
      status: "active",
      color: "#f59e0b",
    },
    {
      id: q3Id,
      title: "Q3 planning",
      description:
        "Draft the Q3 strategy document and share with the team for feedback.",
      status: "active",
      color: "#10b981",
    },
    {
      id: frenchId,
      title: "Learn French",
      description: "Reach conversational level. No deadline.",
      status: "someday",
      color: "#ec4899",
    },
  ])
  .run();

db.insert(schema.actions)
  .values([
    // Inbox items (unprocessed captures)
    {
      id: nanoid(),
      title: "look into that article someone mentioned about focus",
      status: "inbox",
      position: 100,
    },
    {
      id: nanoid(),
      title: "figure out what to do about the laundry situation",
      status: "inbox",
      position: 200,
    },

    // Blog project actions
    {
      id: nanoid(),
      title: "Draft outline for first post",
      notes: "Topic: voice-first task management",
      projectId: blogId,
      status: "next",
      context: "@computer",
      isFirstAction: true,
      position: 100,
    },
    {
      id: nanoid(),
      title: "Buy domain name",
      projectId: blogId,
      status: "next",
      context: "@computer",
      position: 200,
    },
    {
      id: nanoid(),
      title: "Hear back from Sarah on draft",
      projectId: blogId,
      status: "waiting",
      delegatedTo: "Sarah",
      position: 100,
    },

    // Kitchen project actions
    {
      id: nanoid(),
      title: "Get second quote from a different contractor",
      projectId: kitchenId,
      status: "next",
      context: "@phone",
      isFirstAction: true,
      position: 100,
    },
    {
      id: nanoid(),
      title: "Quote from John",
      projectId: kitchenId,
      status: "waiting",
      delegatedTo: "John",
      dueAt: d(-12 * oneDay),
      position: 100,
    },

    // Q3 planning actions (due soon, appears in Today)
    {
      id: nanoid(),
      title: "Draft Q3 strategy doc",
      notes: "High-level narrative, metrics, and headcount asks.",
      projectId: q3Id,
      status: "next",
      context: "@computer",
      dueAt: d(oneDay),
      scheduledAt: d(0),
      isFirstAction: true,
      position: 100,
    },

    // Loose actions (no project) — appear in Today
    {
      id: nanoid(),
      title: "Call dentist to reschedule",
      status: "next",
      context: "@phone",
      dueAt: d(0),
      scheduledAt: d(0),
      position: 100,
    },
    {
      id: nanoid(),
      title: "Buy cat food",
      status: "next",
      context: "@errands",
      dueAt: d(0),
      position: 200,
    },
    {
      id: nanoid(),
      title: "Email landlord about the radiator",
      status: "next",
      context: "@computer",
      dueAt: d(oneDay),
      position: 300,
    },
  ])
  .run();

console.log("Seed complete:");
console.log(`  Projects: ${db.select().from(schema.projects).all().length}`);
console.log(`  Actions:  ${db.select().from(schema.actions).all().length}`);

sqlite.close();
