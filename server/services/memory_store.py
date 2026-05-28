import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def memory_path() -> Path:
    configured = os.getenv("NEXUS_MEMORY_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[1] / "data" / "memory.json"


def read_memory() -> list[dict]:
    path = memory_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_memory(items: list[dict]) -> None:
    path = memory_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, indent=2), encoding="utf-8")


def recall(mission: str) -> list[str]:
    words = {word for word in mission.lower().split() if len(word) > 4}
    matches = []
    for item in read_memory():
        text = f"{item.get('mission', '')} {item.get('summary', '')}".lower()
        if words and any(word in text for word in words):
            matches.append(item.get("summary", ""))
    return matches[:3]


def remember(mission: str, summary: str) -> None:
    items = read_memory()
    items.insert(0, {"mission": mission, "summary": summary})
    write_memory(items[:20])
