/**
 * Best-effort highlight keys when a tool *call* starts (before result).
 * Keeps UI feedback visible during slow tool execution.
 */
export function computeTouchHighlightKeysFromToolCall(
  toolName: string,
  input: unknown,
): string[] {
  const keys = new Set<string>();
  const inp =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const addProject = (id: unknown) => {
    if (typeof id === "string" && id) {
      keys.add(`project:${id}`);
      keys.add(`route:/projects/${id}`);
    }
  };
  const addAction = (id: unknown) => {
    if (typeof id === "string" && id) keys.add(`action:${id}`);
  };

  switch (toolName) {
    case "navigate_ui": {
      const path = inp.path;
      if (path === "today") {
        keys.add("region:today");
        keys.add("route:/today");
      } else if (path === "inbox") {
        keys.add("region:inbox");
        keys.add("route:/inbox");
      } else if (path === "projects") {
        keys.add("region:projects");
        keys.add("route:/projects");
      } else if (path === "upcoming") {
        keys.add("region:upcoming");
        keys.add("route:/upcoming");
      } else if (path === "project") {
        addProject(inp.projectId);
      }
      break;
    }
    case "read_state": {
      const scope = inp.scope;
      if (scope === "inbox") {
        keys.add("region:inbox");
        keys.add("route:/inbox");
      } else if (scope === "today") {
        keys.add("region:today");
        keys.add("route:/today");
      } else if (scope === "project") addProject(inp.projectId);
      else if (scope === "all") {
        keys.add("region:projects");
        keys.add("route:/projects");
      }
      break;
    }
    case "clarify_inbox_item":
    case "capture_thought":
      keys.add("region:inbox");
      keys.add("route:/inbox");
      addAction(inp.actionId);
      break;
    case "update_action":
    case "complete_action":
    case "delete_action":
      addAction(inp.actionId);
      addProject(inp.projectId);
      keys.add("region:today");
      keys.add("route:/today");
      break;
    case "create_action": {
      const st = typeof inp.status === "string" ? inp.status : "next";
      if (st === "inbox") {
        keys.add("region:inbox");
        keys.add("route:/inbox");
      }
      addProject(inp.projectId);
      if (st === "scheduled" || inp.scheduledAt || inp.dueAt) {
        keys.add("region:upcoming");
        keys.add("route:/upcoming");
      }
      if (["next", "waiting", "scheduled", "done"].includes(st)) {
        keys.add("region:today");
        keys.add("route:/today");
      }
      break;
    }
    case "create_project":
    case "update_project":
      keys.add("region:projects");
      keys.add("route:/projects");
      addProject(inp.projectId);
      break;
    default:
      break;
  }

  return [...keys];
}
