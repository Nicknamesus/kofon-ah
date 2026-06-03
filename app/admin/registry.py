"""Generic content-CRUD registry — the 'edit the DB without code' engine.

Instead of hand-writing a router + template per content table, we describe
each editable entity once (`EntitySpec` + `FieldSpec`) and drive generic
list / form / save / delete logic off the description. Two templates
(`content_list.html`, `content_form.html`) render every entity.

Covered entities (DB-authoritative — see ADMIN_INTERFACE_PLAN.md §3):
  product_types, products, problem_types, solutions, use_cases,
  use_case_product_types, main_conversation_types.

Saving a product / product_type / problem_type also refreshes embeddings for
the changed rows (hash-keyed, so it's cheap and idempotent).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    MainConversationType,
    ProblemType,
    Product,
    ProductType,
    Solution,
    UseCase,
    UseCaseProductType,
)


class ValidationError(Exception):
    """Raised with a user-facing message when form input is invalid."""


# --------------------------------------------------------------------------
# Field + entity descriptors
# --------------------------------------------------------------------------


@dataclass
class FieldSpec:
    name: str
    label: str
    type: str = "text"  # text | textarea | int | json | bool | select | fk
    required: bool = False
    help: str | None = None
    # select: list of (value, label). fk: set fk_entity instead.
    options: list[tuple[str, str]] | None = None
    fk_entity: str | None = None
    # Only shown/editable on create (e.g. natural keys / composite PK parts).
    create_only: bool = False


@dataclass
class EntitySpec:
    key: str  # url slug
    label: str  # plural, for headings
    singular: str
    model: type
    fields: list[FieldSpec]
    list_columns: list[tuple[str, str]]  # (attr, header)
    pk: tuple[str, ...] = ("id",)
    order_by: str = "id"
    # 'product' | 'problem' | None — which embedding refresh to run on save.
    embed_refresh: str | None = None
    search_columns: tuple[str, ...] = ()


# --------------------------------------------------------------------------
# The registry
# --------------------------------------------------------------------------

REGISTRY: dict[str, EntitySpec] = {}


def _register(spec: EntitySpec) -> None:
    REGISTRY[spec.key] = spec


_STATUS_OPTIONS = [("active", "active"), ("inactive", "inactive")]
_SEVERITY_HELP = "1 (minor) – 5 (critical)"
_CONFIDENCE_HELP = "1 (low) – 5 (high)"


_register(EntitySpec(
    key="product_types",
    label="Product families",
    singular="Product family",
    model=ProductType,
    order_by="code",
    embed_refresh="product",
    search_columns=("code", "name", "family"),
    list_columns=[("id", "ID"), ("code", "Code"), ("name", "Name"), ("family", "Family")],
    fields=[
        FieldSpec("code", "Code", required=True, create_only=True,
                  help="Stable slug; matches seed files + routing.yaml. Cannot change after creation."),
        FieldSpec("name", "Name", required=True),
        FieldSpec("family", "Family", required=True),
        FieldSpec("description", "Description", type="textarea", required=True),
        FieldSpec("product_page_url", "Product page URL"),
        FieldSpec("spec_schema", "Spec schema (JSON)", type="json", required=True,
                  help="Declares which spec keys instances expose."),
    ],
))

_register(EntitySpec(
    key="products",
    label="Products (SKUs)",
    singular="Product",
    model=Product,
    order_by="sku",
    embed_refresh="product",
    search_columns=("sku", "name"),
    list_columns=[("id", "ID"), ("sku", "SKU"), ("name", "Name"),
                  ("product_type_id", "Family"), ("status", "Status")],
    fields=[
        FieldSpec("sku", "SKU", required=True, create_only=True,
                  help="Unique. Cannot change after creation."),
        FieldSpec("name", "Name", required=True),
        FieldSpec("product_type_id", "Product family", type="fk",
                  fk_entity="product_types", required=True),
        FieldSpec("specs", "Specs (JSON)", type="json", required=True,
                  help="Keys should follow the family's spec schema."),
        FieldSpec("datasheet_url", "Datasheet URL"),
        FieldSpec("cad_url", "CAD URL"),
        FieldSpec("lead_time_days", "Lead time (days)", type="int"),
        FieldSpec("status", "Status", type="select", options=_STATUS_OPTIONS),
    ],
))

_register(EntitySpec(
    key="problem_types",
    label="Problem types",
    singular="Problem type",
    model=ProblemType,
    order_by="code",
    embed_refresh="problem",
    search_columns=("code", "label"),
    list_columns=[("id", "ID"), ("code", "Code"), ("label", "Label"),
                  ("product_type_id", "Family"), ("severity", "Severity")],
    fields=[
        FieldSpec("product_type_id", "Product family", type="fk",
                  fk_entity="product_types"),
        FieldSpec("code", "Code", required=True),
        FieldSpec("label", "Label", required=True),
        FieldSpec("description", "Description", type="textarea", required=True),
        FieldSpec("severity", "Severity", type="int", required=True, help=_SEVERITY_HELP),
    ],
))

_register(EntitySpec(
    key="solutions",
    label="Solutions",
    singular="Solution",
    model=Solution,
    order_by="id",
    search_columns=("summary",),
    list_columns=[("id", "ID"), ("problem_type_id", "Problem"),
                  ("summary", "Summary"), ("confidence", "Confidence")],
    fields=[
        FieldSpec("problem_type_id", "Problem type", type="fk",
                  fk_entity="problem_types", required=True),
        FieldSpec("summary", "Summary", required=True),
        FieldSpec("body_markdown", "Body (markdown)", type="textarea", required=True),
        FieldSpec("confidence", "Confidence", type="int", required=True, help=_CONFIDENCE_HELP),
        FieldSpec("escalate_if", "Escalate-if (JSON)", type="json",
                  help="Optional condition object; leave blank for none."),
        FieldSpec("sop_url", "SOP URL"),
        FieldSpec("rma_template_url", "RMA template URL"),
    ],
))

_register(EntitySpec(
    key="use_cases",
    label="Use cases",
    singular="Use case",
    model=UseCase,
    order_by="industry",
    search_columns=("industry", "application"),
    list_columns=[("id", "ID"), ("industry", "Industry"), ("application", "Application")],
    fields=[
        FieldSpec("industry", "Industry", required=True),
        FieldSpec("application", "Application", required=True),
        FieldSpec("description", "Description", type="textarea", required=True),
        FieldSpec("notes", "Notes", type="textarea"),
    ],
))

_register(EntitySpec(
    key="use_case_product_types",
    label="Use-case ↔ family fits",
    singular="Use-case fit",
    model=UseCaseProductType,
    pk=("use_case_id", "product_type_id"),
    order_by="use_case_id",
    list_columns=[("use_case_id", "Use case"), ("product_type_id", "Family"),
                  ("fit_score", "Fit")],
    fields=[
        FieldSpec("use_case_id", "Use case", type="fk", fk_entity="use_cases",
                  required=True, create_only=True),
        FieldSpec("product_type_id", "Product family", type="fk",
                  fk_entity="product_types", required=True, create_only=True),
        FieldSpec("fit_score", "Fit score", type="int", required=True, help="1 – 5"),
        FieldSpec("rationale", "Rationale", type="textarea", required=True),
    ],
))

_register(EntitySpec(
    key="main_conversation_types",
    label="Conversation branches",
    singular="Conversation branch",
    model=MainConversationType,
    order_by="id",
    list_columns=[("id", "ID"), ("code", "Code"), ("label", "Label")],
    fields=[
        FieldSpec("code", "Code", required=True, create_only=True),
        FieldSpec("label", "Label", required=True),
        FieldSpec("description", "Description", type="textarea", required=True),
        FieldSpec("greeting_key", "Greeting key", required=True),
    ],
))


# --------------------------------------------------------------------------
# FK option loaders — used to render <select> choices and to label rows.
# --------------------------------------------------------------------------


async def fk_options(session: AsyncSession, entity_key: str) -> list[tuple[int, str]]:
    if entity_key == "product_types":
        rows = (await session.execute(
            select(ProductType.id, ProductType.code, ProductType.name)
            .order_by(ProductType.code)
        )).all()
        return [(r[0], f"{r[1]} — {r[2]}") for r in rows]
    if entity_key == "problem_types":
        rows = (await session.execute(
            select(ProblemType.id, ProblemType.code, ProblemType.label)
            .order_by(ProblemType.code)
        )).all()
        return [(r[0], f"{r[1]} — {r[2]}") for r in rows]
    if entity_key == "use_cases":
        rows = (await session.execute(
            select(UseCase.id, UseCase.industry, UseCase.application)
            .order_by(UseCase.industry)
        )).all()
        return [(r[0], f"{r[1]} / {r[2]}") for r in rows]
    return []


async def fk_labels(session: AsyncSession, spec: EntitySpec) -> dict[str, dict[int, str]]:
    """Pre-load id→label maps for every FK field in `spec`, for nice list cells."""
    out: dict[str, dict[int, str]] = {}
    for f in spec.fields:
        if f.type == "fk" and f.fk_entity:
            opts = await fk_options(session, f.fk_entity)
            out[f.name] = {oid: label for oid, label in opts}
    return out


# --------------------------------------------------------------------------
# CRUD operations
# --------------------------------------------------------------------------


async def list_rows(
    session: AsyncSession, spec: EntitySpec, *, q: str | None = None,
    limit: int = 200, offset: int = 0,
) -> tuple[list[Any], int]:
    model = spec.model
    stmt = select(model)
    count_stmt = select(func.count()).select_from(model)
    if q and spec.search_columns:
        like = f"%{q}%"
        clause = None
        for col in spec.search_columns:
            cond = getattr(model, col).ilike(like)
            clause = cond if clause is None else (clause | cond)
        stmt = stmt.where(clause)
        count_stmt = count_stmt.where(clause)
    stmt = stmt.order_by(getattr(model, spec.order_by)).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    total = (await session.execute(count_stmt)).scalar_one()
    return list(rows), int(total)


def coerce_pk(spec: EntitySpec, raw: dict[str, Any]) -> dict[str, Any]:
    """Cast PK values (which arrive as strings from query/form) to the
    column's Python type — Postgres won't compare `bigint = text`."""
    out: dict[str, Any] = {}
    for col in spec.pk:
        v = raw.get(col)
        if v is None or v == "":
            out[col] = None
            continue
        try:
            pytype = getattr(spec.model, col).type.python_type
        except Exception:  # noqa: BLE001
            pytype = str
        if pytype is int:
            try:
                out[col] = int(v)
            except (TypeError, ValueError):
                out[col] = v
        else:
            out[col] = v
    return out


def _pk_filter(spec: EntitySpec, pk_values: dict[str, Any]):
    model = spec.model
    clause = None
    for col in spec.pk:
        cond = getattr(model, col) == pk_values[col]
        clause = cond if clause is None else (clause & cond)
    return clause


async def get_row(
    session: AsyncSession, spec: EntitySpec, pk_values: dict[str, Any]
) -> Any | None:
    stmt = select(spec.model).where(_pk_filter(spec, pk_values))
    return (await session.execute(stmt)).scalar_one_or_none()


def row_to_form(spec: EntitySpec, row: Any) -> dict[str, Any]:
    """Project an ORM row into form-display values (JSON pretty-printed)."""
    data: dict[str, Any] = {}
    for f in spec.fields:
        val = getattr(row, f.name, None)
        if f.type == "json":
            data[f.name] = json.dumps(val, indent=2, ensure_ascii=False) if val is not None else ""
        elif val is None:
            data[f.name] = ""
        else:
            data[f.name] = val
    for col in spec.pk:
        data[col] = getattr(row, col)
    return data


def _coerce(spec: EntitySpec, f: FieldSpec, raw: str | None) -> Any:
    raw = (raw or "").strip() if isinstance(raw, str) else raw
    if f.type in ("text", "textarea", "select"):
        if not raw:
            if f.required:
                raise ValidationError(f"{f.label} is required.")
            return None
        return raw
    if f.type == "int" or f.type == "fk":
        if raw in (None, ""):
            if f.required:
                raise ValidationError(f"{f.label} is required.")
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValidationError(f"{f.label} must be a whole number.") from None
    if f.type == "bool":
        return bool(raw)
    if f.type == "json":
        if not raw:
            if f.required:
                raise ValidationError(f"{f.label} is required.")
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"{f.label}: invalid JSON ({exc.msg}).") from None
    return raw


def coerce_form(spec: EntitySpec, form: dict[str, Any], *, creating: bool) -> dict[str, Any]:
    """Validate + coerce raw form strings into a column→value dict."""
    data: dict[str, Any] = {}
    for f in spec.fields:
        # create_only fields are editable only when creating.
        if f.create_only and not creating:
            continue
        data[f.name] = _coerce(spec, f, form.get(f.name))
    # Per-entity extra validation.
    _entity_validate(spec, data)
    return data


def _entity_validate(spec: EntitySpec, data: dict[str, Any]) -> None:
    if spec.key in ("product_types",) and "spec_schema" in data:
        if data["spec_schema"] is not None and not isinstance(data["spec_schema"], dict):
            raise ValidationError("Spec schema must be a JSON object.")
    if spec.key == "products" and "specs" in data:
        if data["specs"] is not None and not isinstance(data["specs"], dict):
            raise ValidationError("Specs must be a JSON object.")
    if spec.key == "problem_types" and data.get("severity") is not None:
        if not (1 <= data["severity"] <= 5):
            raise ValidationError("Severity must be between 1 and 5.")
    if spec.key == "solutions" and data.get("confidence") is not None:
        if not (1 <= data["confidence"] <= 5):
            raise ValidationError("Confidence must be between 1 and 5.")
    if spec.key == "use_case_product_types" and data.get("fit_score") is not None:
        if not (1 <= data["fit_score"] <= 5):
            raise ValidationError("Fit score must be between 1 and 5.")


async def create_row(session: AsyncSession, spec: EntitySpec, data: dict[str, Any]) -> Any:
    row = spec.model(**data)
    session.add(row)
    await session.flush()
    return row


async def update_row(
    session: AsyncSession, spec: EntitySpec, pk_values: dict[str, Any], data: dict[str, Any]
) -> Any:
    row = await get_row(session, spec, pk_values)
    if row is None:
        raise ValidationError("Record not found.")
    for k, v in data.items():
        setattr(row, k, v)
    await session.flush()
    return row


async def delete_row(session: AsyncSession, spec: EntitySpec, pk_values: dict[str, Any]) -> None:
    await session.execute(sa_delete(spec.model).where(_pk_filter(spec, pk_values)))


async def refresh_embeddings_for(session: AsyncSession, spec: EntitySpec) -> None:
    """Re-embed after a content change. Cheap: hash-keyed, only changed rows."""
    if spec.embed_refresh == "product":
        from app.seed.embed import refresh_product_embeddings
        await refresh_product_embeddings(session)
    elif spec.embed_refresh == "problem":
        from app.seed.embed import refresh_problem_embeddings
        await refresh_problem_embeddings(session)


def diff_dict(before: dict[str, Any] | None, after: dict[str, Any]) -> dict[str, Any]:
    """Compact before/after for the audit log."""
    if before is None:
        return {"created": _jsonsafe(after)}
    changes: dict[str, Any] = {}
    for k, v in after.items():
        old = before.get(k)
        if old != v:
            changes[k] = {"from": _jsonsafe(old), "to": _jsonsafe(v)}
    return changes


def _jsonsafe(v: Any) -> Any:
    try:
        json.dumps(v)
        return v
    except TypeError:
        return str(v)
