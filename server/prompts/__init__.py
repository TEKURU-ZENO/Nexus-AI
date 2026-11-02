"""Versioned prompt registry. Prompts live as Markdown files with a `version:` front-matter key."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

PROMPT_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Prompt:
    id: str
    version: str
    text: str


@lru_cache
def load_prompt(prompt_id: str) -> Prompt:
    raw = (PROMPT_DIR / f"{prompt_id}.md").read_text(encoding="utf-8")
    version = f"{prompt_id}.v0"
    body = raw
    if raw.startswith("---"):
        _, header, body = raw.split("---", 2)
        for line in header.strip().splitlines():
            key, _, value = line.partition(":")
            if key.strip() == "version":
                version = value.strip()
    return Prompt(prompt_id, version, body.strip())


def all_prompt_versions() -> dict[str, str]:
    return {p.stem: load_prompt(p.stem).version for p in sorted(PROMPT_DIR.glob("*.md"))}
