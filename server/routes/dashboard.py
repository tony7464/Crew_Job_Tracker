from datetime import date, timedelta

from flask import Blueprint, jsonify, session
from sqlalchemy.orm import joinedload

from ..models import Job, db
from ..schemas import JobSchema
from . import login_required

bp = Blueprint("dashboard", __name__)
jobs_schema = JobSchema(many=True)


def _user_jobs(user_id, *filters, **equals):
    stmt = (
        db.select(Job)
        .options(joinedload(Job.client))
        .filter_by(user_id=user_id, **equals)
        .order_by(Job.date, Job.time, Job.id)
    )
    if filters:
        stmt = stmt.filter(*filters)
    return db.session.scalars(stmt).unique().all()


@bp.get("/dashboard")
@login_required
def dashboard():
    today = date.today()
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    user_id = session["user_id"]
    return jsonify(
        week_start=start.isoformat(),
        week_end=end.isoformat(),
        week_jobs=jobs_schema.dump(_user_jobs(user_id, Job.date >= start, Job.date <= end)),
        unpaid_jobs=jobs_schema.dump(_user_jobs(user_id, paid=False)),
    )
