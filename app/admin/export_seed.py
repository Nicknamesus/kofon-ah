"""Export DB-authoritative content back to seed/ files.

With the DB as the source of truth post-launch, this is how you snapshot the
live catalog/KB back into the git-tracked `seed/` layout (for review, diffing,
or as part of a backup). It is the inverse of `app.seed.load` and writes the
exact shapes that loader expects, so an exported tree round-trips.

    python -m app.admin.export_seed                 # write into ./seed
    python -m app.admin.export_seed --out /tmp/snap # write elsewhere
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal, engine
from app.models import (
    MainConversationType,
    ProblemType,
    Product,
    ProductType,
    Solution,
    UseCase,
    UseCaseProductType,
)

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "seed"


def _dump_yaml(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)


def _clean(d: dict[str, Any], drop: set[str]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if k not in drop}


async def export(session: AsyncSession, out: Path) -> dict[str, int]:
    counts: dict[str, int] = {}

    # main_conversation_types
    mct = (await session.execute(
        select(MainConversationType).order_by(MainConversationType.id)
    )).scalars().all()
    _dump_yaml(out / "main_conversation_types.yaml", [
        {"code": m.code, "label": m.label, "description": m.description,
         "greeting_key": m.greeting_key}
        for m in mct
    ])
    counts["main_conversation_types"] = len(mct)

    # use_cases
    ucs = (await session.execute(
        select(UseCase).order_by(UseCase.industry, UseCase.application)
    )).scalars().all()
    _dump_yaml(out / "use_cases.yaml", [
        {"industry": u.industry, "application": u.application,
         "description": u.description, "notes": u.notes}
        for u in ucs
    ])
    counts["use_cases"] = len(ucs)
    uc_by_id = {u.id: u for u in ucs}

    # product_types — one file per code
    pts = (await session.execute(
        select(ProductType).order_by(ProductType.code)
    )).scalars().all()
    pt_dir = out / "product_types"
    for pt in pts:
        _dump_yaml(pt_dir / f"{pt.code}.yaml", {
            "code": pt.code, "name": pt.name, "family": pt.family,
            "description": pt.description, "product_page_url": pt.product_page_url,
            "spec_schema": pt.spec_schema,
        })
    counts["product_types"] = len(pts)
    pt_code = {pt.id: pt.code for pt in pts}

    # products — grouped per family file
    prods = (await session.execute(
        select(Product).order_by(Product.sku)
    )).scalars().all()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for p in prods:
        code = pt_code.get(p.product_type_id)
        if code is None:
            continue
        grouped.setdefault(code, []).append({
            "sku": p.sku, "name": p.name, "specs": p.specs,
            "datasheet_url": p.datasheet_url, "cad_url": p.cad_url,
            "lead_time_days": p.lead_time_days, "status": p.status,
        })
    prod_dir = out / "products"
    for code, items in grouped.items():
        _dump_yaml(prod_dir / f"{code}.yaml", {
            "product_type_code": code, "products": items,
        })
    counts["products"] = len(prods)

    # use_case_fits.csv
    fits = (await session.execute(select(UseCaseProductType))).scalars().all()
    fit_rows = []
    for f in fits:
        uc = uc_by_id.get(f.use_case_id)
        code = pt_code.get(f.product_type_id)
        if uc is None or code is None:
            continue
        fit_rows.append({
            "industry": uc.industry, "application": uc.application,
            "product_type_code": code, "fit_score": f.fit_score,
            "rationale": f.rationale,
        })
    out.mkdir(parents=True, exist_ok=True)
    with (out / "use_case_fits.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh, fieldnames=["industry", "application", "product_type_code",
                            "fit_score", "rationale"]
        )
        writer.writeheader()
        writer.writerows(fit_rows)
    counts["use_case_product_types"] = len(fit_rows)

    # problems + solutions — one file per family
    probs = (await session.execute(
        select(ProblemType).order_by(ProblemType.code)
    )).scalars().all()
    sols = (await session.execute(select(Solution))).scalars().all()
    sols_by_problem: dict[int, list[Solution]] = {}
    for s in sols:
        sols_by_problem.setdefault(s.problem_type_id, []).append(s)

    prob_grouped: dict[str, list[dict[str, Any]]] = {}
    for pr in probs:
        code = pt_code.get(pr.product_type_id) if pr.product_type_id else None
        key = code or "_unassigned"
        prob_grouped.setdefault(key, []).append({
            "code": pr.code, "label": pr.label, "description": pr.description,
            "severity": pr.severity,
            "solutions": [
                _clean({
                    "summary": s.summary, "body_markdown": s.body_markdown,
                    "confidence": s.confidence, "escalate_if": s.escalate_if,
                    "sop_url": s.sop_url, "rma_template_url": s.rma_template_url,
                }, drop=set())
                for s in sols_by_problem.get(pr.id, [])
            ],
        })
    prob_dir = out / "problems"
    for code, items in prob_grouped.items():
        _dump_yaml(prob_dir / f"{code}.yaml", {
            "product_type_code": code, "problems": items,
        })
    counts["problem_types"] = len(probs)
    counts["solutions"] = len(sols)

    return counts


async def run(out: Path) -> int:
    try:
        async with SessionLocal() as session:
            counts = await export(session, out)
    finally:
        await engine.dispose()
    print(f"Exported to {out}:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Export DB content to seed YAML.")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()
    code = asyncio.run(run(Path(args.out)))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
