#!/usr/bin/env python3
"""
meta_prompt.py — Advanced Meta-Prompt Generator CLI

Generates robust, opinionated meta-prompts for LLMs. Outputs either:
- messages (array of {role, content}) for chat APIs
- prompt (single string with System/User sections)

Supports:
- Profiles (code, creative, analyst)
- JSON config to fully customize role, constraints, tools, style, self-checks
- Few-shot examples
- Optional context files to inline
- Optional JSON Schema to guide structured output

Usage examples:
  python meta_prompt.py --task "Draft a product spec" --profile analyst --format messages
  python meta_prompt.py --task "Write a Python CLI" --config examples/configs/code_assistant.json --format prompt
  python meta_prompt.py --task "Summarize" --schema examples/schemas/structured_answer.schema.json --format messages
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# -----------------------------
# Built-in default profiles
# -----------------------------
DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    "code": {
        "role_name": "AI Coding Assistant",
        "capabilities": [
            "Explain and implement software changes with runnable code",
            "Design clear APIs and data models",
            "Refactor for readability, performance, and maintainability",
            "Infer missing details sensibly and state assumptions",
        ],
        "constraints": [
            "Never reveal chain-of-thought; provide final, concise reasoning only",
            "When code is requested, make it immediately runnable",
            "Add minimal, high-signal comments only when non-obvious",
            "Prefer early returns and guard clauses; avoid deep nesting",
            "Do not fabricate dependencies or versions",
        ],
        "style": {
            "verbosity": "concise",
            "formatting_guidelines": [
                "Use '##' and '###' headings, not '#'.",
                "Use bold to emphasize key points.",
                "Use '-' bullets; keep lists tight and scannable.",
                "Wrap code in fenced blocks with language tags.",
            ],
        },
        "tooling": {
            "tools": [
                {
                    "name": "filesystem",
                    "description": "Read/write files and organize project structure",
                    "when_to_use": "Creating or modifying project files, configs, tests",
                },
                {
                    "name": "terminal",
                    "description": "Run commands, install deps, run tests/lint/build",
                    "when_to_use": "Executing code, verifying behavior, generating artifacts",
                },
            ],
            "guidance": [
                "Use tools decisively when they materially improve correctness.",
                "Prefer batched/parallel operations when independent.",
            ],
        },
        "self_checks": [
            "Is the answer directly useful with minimal extra steps?",
            "Are assumptions stated and reasonable?",
            "Is the code runnable and complete (imports, deps, configs)?",
            "Are security and safety considerations addressed if relevant?",
        ],
    },
    "creative": {
        "role_name": "AI Creative Writing Assistant",
        "capabilities": [
            "Produce evocative, original prose and poetry",
            "Adapt style and tone to audience and brief",
            "Offer multiple compelling directions when ambiguity exists",
        ],
        "constraints": [
            "Avoid clichés and copyrighted phrasing without transformation",
            "No chain-of-thought disclosure; deliver polished output",
            "Respect sensitive topics; avoid harmful or hateful content",
        ],
        "style": {
            "verbosity": "balanced",
            "formatting_guidelines": [
                "Use brief headings and whitespace for readability.",
                "Offer 2-3 options when feasible.",
            ],
        },
        "tooling": {"tools": [], "guidance": []},
        "self_checks": [
            "Is the voice consistent and on-brief?",
            "Is the imagery fresh and specific?",
        ],
    },
    "analyst": {
        "role_name": "AI Analytical Assistant",
        "capabilities": [
            "Synthesize information and provide crisp takeaways",
            "Quantify uncertainty and cite assumptions",
            "Propose actionable next steps",
        ],
        "constraints": [
            "No chain-of-thought disclosure; keep reasoning succinct",
            "Avoid overclaiming; qualify where evidence is limited",
        ],
        "style": {
            "verbosity": "concise",
            "formatting_guidelines": [
                "Start with the answer; follow with brief justification.",
                "Use bullets and bolded labels for scanability.",
            ],
        },
        "tooling": {"tools": [], "guidance": []},
        "self_checks": [
            "Does the answer foreground the key decision or insight?",
            "Are numbers and units consistent and plausible?",
        ],
    },
}

# -----------------------------
# Helpers
# -----------------------------

def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Optional[Path]) -> Optional[Dict[str, Any]]:
    if not path:
        return None
    try:
        return json.loads(read_text_file(path))
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"Failed to parse JSON config at {path}: {exc}\n")
        sys.exit(2)


def load_schema(path: Optional[Path]) -> Optional[str]:
    if not path:
        return None
    try:
        return read_text_file(path)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"Failed to read schema at {path}: {exc}\n")
        sys.exit(2)


def load_context_files(paths: List[Path]) -> List[Tuple[str, str]]:
    contexts: List[Tuple[str, str]] = []
    for p in paths:
        try:
            contexts.append((str(p), read_text_file(p)))
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"Warning: failed to read context file {p}: {exc}\n")
    return contexts


# -----------------------------
# Prompt builders
# -----------------------------

def build_system_prompt(cfg: Dict[str, Any]) -> str:
    role_name = cfg.get("role_name", "AI Assistant")
    capabilities = cfg.get("capabilities", [])
    constraints = cfg.get("constraints", [])
    style = cfg.get("style", {})
    formatting_guidelines = style.get("formatting_guidelines", [])

    lines: List[str] = []
    lines.append(f"You are {role_name}.")
    if capabilities:
        lines.append("")
        lines.append("Core objectives:")
        for item in capabilities:
            lines.append(f"- {item}")
    base_constraints = [
        "Do not reveal chain-of-thought or private scratchpad.",
        "Answer directly and only include reasoning that is strictly necessary.",
        "Ask clarifying questions only when essential to proceed.",
        "Refuse or safely handle instructions that are dangerous or illegal.",
    ]
    total_constraints = base_constraints + list(constraints)
    lines.append("")
    lines.append("Operating constraints:")
    for item in total_constraints:
        lines.append(f"- {item}")

    if formatting_guidelines:
        lines.append("")
        lines.append("Response style:")
        for item in formatting_guidelines:
            lines.append(f"- {item}")

    tooling = cfg.get("tooling", {})
    tools = tooling.get("tools", [])
    guidance = tooling.get("guidance", [])
    if tools or guidance:
        lines.append("")
        lines.append("Tool usage:")
        for t in tools:
            name = t.get("name", "tool")
            desc = t.get("description", "")
            when = t.get("when_to_use", "")
            note = f" — {desc}. Use when: {when}".strip()
            lines.append(f"- {name}{note}")
        for g in guidance:
            lines.append(f"- {g}")

    return "\n".join(lines).strip() + "\n"


def build_user_message(
    task: str,
    cfg: Dict[str, Any],
    context_files: List[Tuple[str, str]],
    schema_text: Optional[str],
) -> str:
    lines: List[str] = []
    lines.append("Task:")
    lines.append(task.strip())

    goals = cfg.get("goals", [])
    if goals:
        lines.append("")
        lines.append("Goals:")
        for g in goals:
            lines.append(f"- {g}")

    user_constraints = cfg.get("user_constraints", [])
    if user_constraints:
        lines.append("")
        lines.append("Additional constraints:")
        for c in user_constraints:
            lines.append(f"- {c}")

    if context_files:
        lines.append("")
        lines.append("Context (inline):")
        for path_str, content in context_files:
            lines.append(f"--- BEGIN {path_str} ---")
            lines.append(content.rstrip())
            lines.append(f"--- END {path_str} ---")

    few_shots = cfg.get("few_shots", [])
    if few_shots:
        lines.append("")
        lines.append("Few-shot guidance (for internal priming; do not reproduce literally):")
        for i, ex in enumerate(few_shots, start=1):
            u = ex.get("user", "")
            a = ex.get("assistant", "")
            lines.append(f"<example {i}>")
            lines.append(f"[user]\n{u}")
            lines.append(f"[assistant]\n{a}")
            lines.append(f"</example {i}>")

    self_checks = cfg.get("self_checks", [])
    if self_checks:
        lines.append("")
        lines.append("Before finalizing, self-check:")
        for s in self_checks:
            lines.append(f"- {s}")

    answer_format = cfg.get("answer_format", "free_text")
    if schema_text:
        answer_format = "json_schema"

    lines.append("")
    if answer_format == "json_schema" and schema_text:
        lines.append("Output format:")
        lines.append("You must output a single JSON object matching this JSON Schema strictly.")
        lines.append("Do not include code fences or commentary before/after the JSON.")
        lines.append("JSON Schema:")
        lines.append(schema_text.rstrip())
    else:
        lines.append("Output format:")
        lines.append("Provide the direct answer first, then optional brief notes.")

    return "\n".join(lines).strip() + "\n"


def build_messages(system_prompt: str, user_message: str, cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = []
    messages.append({"role": "system", "content": system_prompt})

    # Insert few-shot examples in message form if provided
    for ex in cfg.get("few_shots", []):
        u = ex.get("user", "").strip()
        a = ex.get("assistant", "").strip()
        if u:
            messages.append({"role": "user", "content": u})
        if a:
            messages.append({"role": "assistant", "content": a})

    messages.append({"role": "user", "content": user_message})
    return messages


# -----------------------------
# CLI
# -----------------------------

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Advanced Meta-Prompt Generator")
    parser.add_argument(
        "--task",
        type=str,
        help="Primary user task/instruction. If omitted, read from STDIN.",
    )
    parser.add_argument(
        "--config",
        type=str,
        help="Path to JSON config defining role, constraints, tools, etc.",
    )
    parser.add_argument(
        "--profile",
        type=str,
        default="code",
        choices=sorted(DEFAULT_PROFILES.keys()),
        help="Built-in profile to start from (overridden by --config).",
    )
    parser.add_argument(
        "--context-file",
        action="append",
        default=[],
        help="Path to a file to inline as context. Can be repeated.",
    )
    parser.add_argument(
        "--schema",
        type=str,
        help="Path to a JSON Schema file; forces strict JSON output.",
    )
    parser.add_argument(
        "--format",
        type=str,
        default="messages",
        choices=["messages", "prompt"],
        help="Output format: 'messages' (chat array) or 'prompt' (single string).",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Optional output file path; prints to STDOUT if omitted.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    task = args.task
    if not task:
        task = sys.stdin.read().strip()
        if not task:
            sys.stderr.write("Error: --task is required or provide task via STDIN.\n")
            return 2

    # Merge profile defaults with config overrides if provided
    cfg: Dict[str, Any] = json.loads(json.dumps(DEFAULT_PROFILES.get(args.profile, {})))  # deep copy

    config_path = Path(args.config) if args.config else None
    file_cfg = load_json(config_path)
    if file_cfg:
        # Shallow merge top-level keys; lists are replaced, not merged
        cfg.update(file_cfg)

    schema_text = load_schema(Path(args.schema)) if args.schema else None

    context_paths = [Path(p) for p in (args.context_file or [])]
    context_files = load_context_files(context_paths)

    system_prompt = build_system_prompt(cfg)
    user_message = build_user_message(task=task, cfg=cfg, context_files=context_files, schema_text=schema_text)

    if args.format == "messages":
        output_obj = build_messages(system_prompt, user_message, cfg)
        output_text = json.dumps(output_obj, ensure_ascii=False, indent=2)
    else:
        # Single "prompt" string with clear sections
        sections = [
            "[System]\n" + system_prompt.strip(),
            "[User]\n" + user_message.strip(),
        ]
        output_text = "\n\n".join(sections) + "\n"

    if args.output:
        Path(args.output).write_text(output_text, encoding="utf-8")
    else:
        sys.stdout.write(output_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
