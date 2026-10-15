from datetime import date, timedelta

from flask import Blueprint, jsonify, session
from sqlalchemy.orm import joinedload

from ..models import Job, db
from ..schemas import JobSchema
from . import login_required

bp = Blueprint("dashboard", __name__)
jobs_schema = JobSchema(many=True)


def current_week(today=None):
    today = today or date.today()
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


@bp.get("/dashboard")
@login_required
def dashboard():
    start, end = current_week()
    user_id = session["user_id"]
    week_jobs = db.session.scalars(
        db.select(Job)
        .options(joinedload(Job.client))
        .filter_by(user_id=user_id)
        .filter(Job.date >= start, Job.date <= end)
        .order_by(Job.date, Job.time, Job.id)
    ).unique().all()
    unpaid_jobs = db.session.scalars(
        db.select(Job)
        .options(joinedload(Job.client))
        .filter_by(user_id=user_id, paid=False)
        .order_by(Job.date, Job.time, Job.id)
    ).unique().all()
    return jsonify(
        week_start=start.isoformat(),
        week_end=end.isoformat(),
        week_jobs=jobs_schema.dump(week_jobs),
        unpaid_jobs=jobs_schema.dump(unpaid_jobs),
    )
