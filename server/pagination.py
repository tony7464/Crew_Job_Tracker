import math

from flask import request
from sqlalchemy import func, select

from .models import db


class QueryParamError(Exception):
    def __init__(self, field, message):
        self.errors = {field: [message]}


def page_args(default_per_page=10, max_per_page=50):
    page = _positive_int("page", 1)
    per_page = _positive_int("per_page", default_per_page)
    if per_page > max_per_page:
        raise QueryParamError("per_page", "Must be at most 50.")
    return page, per_page


def paginate(stmt, schema):
    page, per_page = page_args()
    total = db.session.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ) or 0
    pages = math.ceil(total / per_page) if total else 0
    rows = db.session.scalars(
        stmt.limit(per_page).offset((page - 1) * per_page)
    ).unique().all()
    return {
        "items": schema.dump(rows),
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
    }


def _positive_int(name, default):
    raw = request.args.get(name)
    if raw is None or raw.strip() == "":
        return default
    if not raw.strip().isdigit():
        raise QueryParamError(name, "Must be a positive integer.")
    value = int(raw)
    if value < 1:
        raise QueryParamError(name, "Must be a positive integer.")
    return value
