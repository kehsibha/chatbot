/**
 * Derives UI "touch" highlight keys from agent tool results so the client
 * can briefly glow the parts of the screen that changed.
 */
export function computeTouchHighlightKeys(
  toolName: string,
  input: unknown,
  result: unknown,
  isError?: boolean,
): string[] {
  if (isError) return [];

  const keys = new Set<string>();
  const inp = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const res = result && typeof result === "object" ? (result as Record<string, unknown>) : {};

  const addAction = (id: unknown) => {
    if (typeof id === "string" && id) keys.add(`action:${id}`);
  };
  const addProject = (id: unknown) => {
    if (typeof id === "string" && id) {
      keys.add(`project:${id}`);
      keys.add(`route:/projects/${id}`);
    }
  };

  switch (toolName) {
    case "navigate_ui": {
      if (res.navigated !== true || typeof res.path !== "string") break;
      switch (res.path) {
        case "today":
          keys.add("region:today");
          keys.add("route:/today");
          break;
        case "inbox":
          keys.add("region:inbox");
          keys.add("route:/inbox");
          break;
        case "projects":
          keys.add("region:projects");
          keys.add("route:/projects");
          break;
        case "upcoming":
          keys.add("region:upcoming");
          keys.add("route:/upcoming");
          break;
        case "project": {
          const pid = res.projectId;
          if (typeof pid === "string" && pid) addProject(pid);
          break;
        }
        default:
          break;
      }
      break;
    }
    case "capture_thought": {
      keys.add("region:inbox");
      keys.add("route:/inbox");
      addAction(res.id);
      break;
    }
    case "clarify_inbox_item": {
      keys.add("region:inbox");
      keys.add("route:/inbox");
      addAction(inp.actionId ?? res.id);
      const st = typeof res.status === "string" ? res.status : inp.status;
      if (st === "next" || st === "waiting" || st === "scheduled" || st === "done") {
        keys.add("region:today");
        keys.add("route:/today");
      }
      if (typeof inp.projectId === "string" && inp.projectId)
        addProject(inp.projectId);
      break;
    }
    case "create_project": {
      keys.add("region:projects");
      keys.add("route:/projects");
      addProject(res.id);
      break;
    }
    case "update_project": {
      addProject(inp.projectId ?? res.id);
      keys.add("region:projects");
      keys.add("route:/projects");
      break;
    }
    case "create_action": {
      addAction(res.id);
      const st = typeof inp.status === "string" ? inp.status : "next";
      if (st === "inbox") {
        keys.add("region:inbox");
        keys.add("route:/inbox");
      }
      if (typeof inp.projectId === "string" && inp.projectId) {
        addProject(inp.projectId);
      }
      if (st === "scheduled" || inp.scheduledAt || inp.dueAt) {
        keys.add("region:upcoming");
        keys.add("route:/upcoming");
      }
      if (st === "next" || st === "waiting" || st === "scheduled" || st === "done") {
        keys.add("region:today");
        keys.add("route:/today");
      }
      break;
    }
    case "update_action":
    case "complete_action":
    case "delete_action": {
      addAction(inp.actionId);
      if (typeof inp.projectId === "string" && inp.projectId)
        addProject(inp.projectId);
      keys.add("region:today");
      keys.add("route:/today");
      keys.add("region:inbox");
      keys.add("route:/inbox");
      keys.add("region:upcoming");
      keys.add("route:/upcoming");
      break;
    }
    case "read_state": {
      const scope = typeof inp.scope === "string" ? inp.scope : "";
      if (scope === "inbox") {
        keys.add("region:inbox");
        keys.add("route:/inbox");
      } else if (scope === "today") {
        keys.add("region:today");
        keys.add("route:/today");
      } else if (scope === "project" && typeof inp.projectId === "string") {
        addProject(inp.projectId);
      } else if (scope === "all") {
        keys.add("region:projects");
        keys.add("route:/projects");
      }
      break;
    }
    default:
      break;
  }

  if (
    keys.size > 0 &&
    !isError &&
    toolName !== "read_state"
  ) {
    keys.add("region:reasoning");
  }

  return [...keys];
}
