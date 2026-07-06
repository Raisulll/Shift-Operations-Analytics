"""AI-assisted reason grouping via the Groq API.

Given the distinct raw reasons in the active dataset, ask an LLM to propose
higher-level groups — merging synonyms, abbreviations, casing and spelling
variants of the same concept — so a user can approve them in the grouping editor
instead of mapping every reason by hand. The model only *suggests*: nothing is
persisted until the user saves the grouping.

Groq's free tier is generous and needs no credit card, which makes it a good fit
for a demo. Its API is OpenAI-compatible; we call it directly with the standard
library, so there is no extra Python dependency to install.

Configuration (via env / .env, same pattern as grouping.py):
  GROQ_API_KEY   required — get a free key at https://console.groq.com/keys.
                 Unset -> feature disabled (the endpoint returns a clear 503).
  GROQ_MODEL     optional — defaults to llama-3.3-70b-versatile. Use
                 llama-3.1-8b-instant for higher rate limits / faster responses.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from decouple import config

_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class AIUnavailable(Exception):
    """Raised when the AI grouping feature can't run (missing key, API error,
    unparseable response). Views translate this into a clean HTTP error."""


_SYSTEM = (
    "You are a manufacturing operations analyst. You group raw shift-log "
    "'reason' labels into a small set of higher-level categories. Merge "
    "synonyms, abbreviations, casing and spelling variants of the same concept "
    "(e.g. 'Power Failure', 'power fail', 'Elec. fault' all mean the same thing). "
    "Keep genuinely distinct reasons in separate groups. Prefer a few clear, "
    "Title-Case group labels. Only ever use the exact reason strings provided. "
    "Respond with JSON only."
)


def _call_groq(system: str, prompt: str, *, json_mode: bool = True) -> str:
    """POST to Groq's chat-completions endpoint and return the response text.

    ``json_mode`` asks Groq to emit a strict JSON object (used for grouping).
    Set it False for free-form prose (used for the executive summary).

    Raises AIUnavailable with a clear message on any failure (missing key,
    HTTP error, network error, empty response).
    """
    api_key = config("GROQ_API_KEY", default="").strip()
    if not api_key:
        raise AIUnavailable(
            "AI features are not configured. Set GROQ_API_KEY on the server."
        )
    # Tolerate a stray trailing dot / whitespace in the configured value.
    model = config("GROQ_MODEL", default="llama-3.3-70b-versatile").strip().strip(".")

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        _API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            # Groq is behind Cloudflare, which blocks the default "Python-urllib"
            # User-Agent with a 403 / error 1010. Send a normal UA to pass.
            "User-Agent": "Mozilla/5.0 (compatible; ShiftAnalytics/1.0)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:300]
        raise AIUnavailable(f"Groq API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise AIUnavailable(f"Could not reach the Groq API: {exc.reason}") from exc

    choices = payload.get("choices") or []
    if not choices:
        raise AIUnavailable("Groq returned no content.")
    return choices[0].get("message", {}).get("content", "") or ""


def suggest_groups(reasons: list[str]) -> dict[str, list[str]]:
    """Return a {group_label: [reasons]} suggestion for the given reasons.

    The result is validated against the input: hallucinated reasons are dropped,
    and single-member groups whose label equals the reason are omitted (they are
    standalone — no grouping needed). Returns {} when there's nothing to group.
    """
    reasons = sorted({r.strip() for r in reasons if r and r.strip()})
    if len(reasons) < 2:
        return {}

    prompt = (
        "Group these shift-log reasons. Respond with ONLY a JSON object of the "
        'form {"groups": [{"label": "<group name>", "reasons": ["<reason>", ...]}]}. '
        "Every reason must appear in exactly one group. Reasons:\n"
        + "\n".join(f"- {r}" for r in reasons)
    )

    text = _call_groq(_SYSTEM, prompt)
    data = _parse_json(text)

    valid = set(reasons)
    out: dict[str, list[str]] = {}
    for group in data.get("groups", []):
        label = str(group.get("label", "")).strip()
        members = [m for m in group.get("reasons", []) if m in valid]
        if not label or not members:
            continue
        # A one-member group whose label is the reason itself is "standalone".
        if len(members) == 1 and members[0] == label:
            continue
        bucket = out.setdefault(label, [])
        for m in members:
            if m not in bucket:
                bucket.append(m)
    return out


_SUMMARY_SYSTEM = (
    "You are a plant operations manager writing a short briefing for leadership. "
    "You are given already-computed analytics as JSON. Write 3-5 sentences of "
    "plain prose that a busy manager can read at a glance: state the overall "
    "operational efficiency, call out the biggest downtime driver and the "
    "worst-performing day with their numbers, and end with one concrete, "
    "actionable recommendation. Reference specific figures and dates from the "
    "data. Do NOT invent numbers. No markdown, no bullet points, no headings — "
    "just a single tight paragraph."
)


def summarize(context: dict) -> str:
    """Return a plain-language executive summary of the computed analytics.

    ``context`` is a compact dict of already-computed metrics (efficiency,
    worst days, insights, data quality). Nothing is invented by this module —
    the model only rephrases the numbers it is given.
    """
    prompt = (
        "Operational analytics (JSON):\n"
        + json.dumps(context, ensure_ascii=False)
        + "\n\nWrite the briefing paragraph now."
    )
    text = _call_groq(_SUMMARY_SYSTEM, prompt, json_mode=False)
    return text.strip()


def _parse_json(text: str) -> dict:
    """Best-effort JSON extraction: tolerate ```json fences and surrounding prose."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    raise AIUnavailable("The AI response could not be parsed as JSON.")
