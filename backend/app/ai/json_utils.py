import json
import re


_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.IGNORECASE | re.DOTALL)


def strip_code_fences(text: str) -> str:
    stripped = text.strip()
    match = _FENCE.search(stripped)
    if match:
        return match.group(1).strip()
    return stripped


def extract_json_object(text: str) -> dict | None:
    cleaned = strip_code_fences(text)
    candidates = [cleaned]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        candidates.append(cleaned[start : end + 1])

    for candidate in candidates:
        try:
            value = json.loads(candidate)
        except (TypeError, ValueError):
            continue
        if isinstance(value, dict):
            return value
    return None
