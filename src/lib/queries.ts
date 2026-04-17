"use client";
/**
 * TanStack Query hooks for actions and projects. Kept small on purpose —
 * the agent does most writes via the streaming endpoint; these hooks
 * mainly drive reads and a few direct-UI mutations (checkboxes, drag).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Action, Project } from "@/lib/db/schema";

export type ProjectWithCounts = Project & {
  counts: { total: number; done: number; next: number; waiting: number };
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------- projects ----------

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchJson<ProjectWithCounts[]>("/api/projects"),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () =>
      fetchJson<{ project: Project; actions: Action[] }>(
        `/api/projects/${id}`,
      ),
    enabled: !!id,
  });
}

/** Warm cache before navigation (e.g. sidebar / project card hover). */
export function prefetchProject(qc: QueryClient, id: string) {
  if (!id) return;
  return qc.prefetchQuery({
    queryKey: ["projects", id],
    queryFn: () =>
      fetchJson<{ project: Project; actions: Action[] }>(
        `/api/projects/${id}`,
      ),
  });
}

// ---------- actions ----------

export function useActions(params: { view?: string; projectId?: string; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  if (params.projectId) qs.set("projectId", params.projectId);
  if (params.status) qs.set("status", params.status);
  const url = `/api/actions${qs.toString() ? `?${qs.toString()}` : ""}`;
  return useQuery({
    queryKey: ["actions", params],
    queryFn: () => fetchJson<Action[]>(url),
  });
}

export function useUpdateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<Action> }) =>
      fetchJson<Action>(`/api/actions/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actions"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/actions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actions"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
