import { parseImportedJson } from "./parse";
import type { ProjectDocument, ProjectSummary } from "./types";

class ProjectRequestError extends Error {}

async function requestError(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "error" in payload) {
      const message = (payload as { error?: unknown }).error;
      if (typeof message === "string" && message) return message;
    }
  } catch {
    // 忽略非 JSON 错误体。
  }
  return `${fallback}（HTTP ${response.status}）`;
}

export async function listSavedProjects(): Promise<ProjectSummary[]> {
  const response = await fetch("/api/projects", { cache: "no-store" });
  if (!response.ok) {
    throw new ProjectRequestError(await requestError(response, "读取存档列表失败"));
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") return [];
  const projects = (payload as { projects?: unknown }).projects;
  return Array.isArray(projects) ? (projects as ProjectSummary[]) : [];
}

export async function loadSavedProject(id: string): Promise<ProjectDocument> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProjectRequestError(await requestError(response, "读取存档失败"));
  }
  const payload: unknown = await response.json();
  const { project } = parseImportedJson(JSON.stringify(payload));
  return project;
}

export async function saveProjectToServer(document: ProjectDocument): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(document.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  if (!response.ok) {
    throw new ProjectRequestError(await requestError(response, "保存项目失败"));
  }
}

export async function deleteSavedProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new ProjectRequestError(await requestError(response, "删除存档失败"));
  }
}

export function projectFileName(document: ProjectDocument): string {
  const name = document.novelName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40) || "项目";
  const stamp = (document.updatedAt || new Date().toISOString()).slice(0, 10);
  return `${name}-${stamp}.json`;
}

export function downloadProject(document: ProjectDocument): void {
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = projectFileName(document);
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file, "utf-8");
  });
}
