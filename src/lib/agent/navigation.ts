import { z } from "zod";

export const navigateUISchema = z.object({
  path: z
    .enum(["today", "inbox", "projects", "upcoming", "project"])
    .describe(
      "Which screen to open in the app UI.",
    ),
  projectId: z
    .string()
    .optional()
    .describe(
      "Required when path is project. Must be a real project id from the state snapshot or read_state.",
    ),
});

export type NavigateUIInput = z.infer<typeof navigateUISchema>;

export type NavigateUIResult = {
  navigated: true;
  path: NavigateUIInput["path"];
  projectId: string | null;
};

export function executeNavigateUI(input: NavigateUIInput): NavigateUIResult {
  const parsed = navigateUISchema.parse(input);
  if (parsed.path === "project" && !parsed.projectId) {
    throw new Error("projectId is required when path is project");
  }
  return {
    navigated: true,
    path: parsed.path,
    projectId: parsed.projectId ?? null,
  };
}

/** Build the Next.js route for a successful navigate_ui tool result. */
export function hrefFromNavigateUIResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (r.navigated !== true || typeof r.path !== "string") return null;
  switch (r.path) {
    case "today":
      return "/today";
    case "inbox":
      return "/inbox";
    case "projects":
      return "/projects";
    case "upcoming":
      return "/upcoming";
    case "project": {
      const id = r.projectId;
      if (typeof id !== "string" || !id) return null;
      return `/projects/${id}`;
    }
    default:
      return null;
  }
}
