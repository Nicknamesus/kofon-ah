"""Catalog ingest — fetch a Kofon product PDF and emit draft seed YAML.

Sibling of `extract_url.py`. The HTML path works fine for product pages
with textual spec sheets, but Kofon's older / denser product pages render
their tables as multi-column HTML that flattens to an unreadable stream
during text extraction. The linked PDFs preserve table structure, and
pdfplumber recovers it cleanly — exactly the input the LLM needs.

Usage::

    python -m app.seed.extract_pdf path/to/datasheet.pdf
    python -m app.seed.extract_pdf https://example.com/datasheet.pdf
    python -m app.seed.extract_pdf <src> --code r_series --out seed/drafts

Pipeline:
    1. Fetch the PDF (httpx for URLs, local read for paths).
    2. pdfplumber extracts per-page text + tables. Tables are rendered as
       markdown so column boundaries survive the trip to the LLM.
    3. DeepSeek (same `SYSTEM` prompt + `ProductTypeDraft` schema as the
       HTML path) produces structured YAML.
    4. `write_draft` from `extract_url.py` writes the two YAML files
       under `seed/drafts/`. Same review-then-promote workflow.

Same notes about review as extract_url.py — drafts go to seed/drafts/;
the seed loader ignores that folder until you move them into
seed/product_types/ + seed/products/ explicitly.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import sys
from pathlib import Path

import httpx
import pdfplumber
from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.llm import get_chat_llm
from app.seed.extract_url import (
    SYSTEM,
    ProductTypeDraft,
    _safe_print,
    write_draft,
)


# ---------------- fetcher ----------------


async def _fetch_pdf_bytes(source: str) -> bytes:
    """URL → download; local path → read."""
    if source.startswith(("http://", "https://")):
        async with httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True,
            headers={"User-Agent": "kofon-seed-extractor/0.1"},
        ) as client:
            resp = await client.get(source)
            resp.raise_for_status()
            return resp.content
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {source}")
    return path.read_bytes()


def _pdf_to_text(data: bytes, *, max_chars: int = 120_000) -> str:
    """Extract page text + tables, preserving table structure as markdown.

    Markdown tables keep the row/column relationship intact across the
    LLM hop. We emit one block per page so the model still has spatial
    cues (page N is the cover, N+1 is the spec table, etc.)."""
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            parts.append(f"\n## Page {page_no}\n")
            for table in page.extract_tables() or []:
                rendered = _table_to_markdown(table)
                if rendered:
                    parts.append(rendered)
                    parts.append("")
            text = (page.extract_text() or "").strip()
            if text:
                parts.append(text)
    flat = "\n".join(parts).strip()
    return flat[:max_chars]


def _table_to_markdown(table: list[list[str | None]]) -> str:
    """Render a pdfplumber table (list[list[str|None]]) as a markdown table.

    Empty / single-row tables are dropped — they're usually layout
    artifacts, not real data.
    """
    cleaned: list[list[str]] = []
    for row in table:
        if not row:
            continue
        cleaned.append([(c or "").replace("\n", " ").strip() for c in row])
    if len(cleaned) < 2:
        return ""
    if not any(any(c for c in row) for row in cleaned):
        return ""

    header, *rows = cleaned
    cols = max(len(header), max((len(r) for r in rows), default=0))
    header = header + [""] * (cols - len(header))
    rows = [r + [""] * (cols - len(r)) for r in rows]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join("---" for _ in header) + " |",
    ]
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


# ---------------- extractor ----------------


async def extract_pdf(
    source: str, *, code_override: str | None = None
) -> ProductTypeDraft:
    data = await _fetch_pdf_bytes(source)
    text = _pdf_to_text(data)
    if not text.strip():
        raise ValueError(
            f"PDF produced no extractable text or tables — likely a "
            f"scan-image PDF (needs OCR): {source}"
        )

    llm = get_chat_llm(temperature=0.0).with_structured_output(ProductTypeDraft)
    user = (
        f"Source PDF: {source}\n\n"
        "Content (per-page text + tables rendered as markdown):\n"
        f"{text}\n\n"
        "Emit the structured extraction now."
    )
    draft: ProductTypeDraft | None = await llm.ainvoke(
        [SystemMessage(content=SYSTEM), HumanMessage(content=user)]
    )
    if draft is None:
        raise ValueError(
            f"LLM returned no structured extraction (page likely isn't a "
            f"product datasheet, or hit a refusal): {source}"
        )
    if code_override:
        draft.product_type_code = code_override
    draft.source_url = source
    return draft


# ---------------- CLI ----------------


async def _amain() -> int:
    parser = argparse.ArgumentParser(
        description="Extract a Kofon product PDF datasheet into draft seed YAML."
    )
    parser.add_argument("source", help="Local path or URL to the PDF datasheet.")
    parser.add_argument(
        "--code",
        dest="code_override",
        default=None,
        help="Force the product_type_code (otherwise the LLM picks).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("seed/drafts"),
        help="Output directory for draft YAML (default: seed/drafts).",
    )
    args = parser.parse_args()

    draft = await extract_pdf(args.source, code_override=args.code_override)
    pt_path, p_path = write_draft(draft, args.out)

    _safe_print(f"  Family:  {draft.product_type_code}  ({draft.product_type_name})")
    _safe_print(f"  SKUs:    {len(draft.products)}")
    _safe_print(f"  Wrote:   {pt_path}")
    _safe_print(f"           {p_path}")
    if draft.notes_for_reviewer:
        _safe_print(f"\n  Reviewer notes:\n    {draft.notes_for_reviewer}\n")
    _safe_print("Next:")
    _safe_print(f"  Review the drafts, then promote:")
    _safe_print(f"    mv {pt_path} seed/product_types/{draft.product_type_code}.yaml")
    _safe_print(f"    mv {p_path}  seed/products/{draft.product_type_code}.yaml")
    _safe_print(f"  Then: python -m app.seed.load")
    return 0


def main() -> None:
    sys.exit(asyncio.run(_amain()))


if __name__ == "__main__":
    main()
