/** 把 fetch / AI 调用异常整理成能直接展示给用户的文案。 */
export function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return message && message !== "Failed to fetch" ? message : fallback;
}
