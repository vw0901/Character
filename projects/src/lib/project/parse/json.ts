import type { StatValues } from "../types";

export const DEFAULT_STATS: StatValues = { health: 100, power: 50, reputation: 50 };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() ? value : fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  const single = text(value);
  return single ? [single] : [];
}

export function normalizeStats(value: unknown): StatValues {
  const record = asRecord(value) ?? {};
  return {
    health: clamp(Math.round(numberValue(record.health, DEFAULT_STATS.health)), 0, 100),
    power: clamp(Math.round(numberValue(record.power, DEFAULT_STATS.power)), 0, 100),
    reputation: clamp(
      Math.round(numberValue(record.reputation, DEFAULT_STATS.reputation)),
      0,
      100
    ),
  };
}

/** 模型输出常常带说明文字或 ``` 代码块，这里做宽松解析。 */
export function parseJsonLoose(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [trimmed, unfenced];
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(unfenced.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === "object") return parsed;
    } catch {
      // 继续尝试下一个候选。
    }
    try {
      const repaired = JSON.parse(
        candidate.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      );
      if (repaired !== null && typeof repaired === "object") return repaired;
    } catch {
      // 继续尝试下一个候选。
    }
  }
  return null;
}
