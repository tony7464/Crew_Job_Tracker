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


def _sum_prices(jobs):
    return float(sum((job.price for job in jobs), 0))


def _totals(week_jobs, unpaid_jobs):
    active_week = [job for job in week_jobs if job.status != "cancelled"]
    return {
        "week_scheduled": _sum_prices(active_week),
        "week_completed": _sum_prices(job for job in week_jobs if job.status == "completed"),
        "unpaid_total": _sum_prices(job for job in unpaid_jobs if job.status != "cancelled"),
        "paid_this_week": _sum_prices(job for job in active_week if job.paid),
    }


@bp.get("/dashboard")
@login_required
def dashboard():
    today = date.today()
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    user_id = session["user_id"]
    week_jobs = _user_jobs(user_id, Job.date >= start, Job.date <= end)
    unpaid_jobs = _user_jobs(user_id, paid=False)
    return jsonify(
        week_start=start.isoformat(),
        week_end=end.isoformat(),
        week_jobs=jobs_schema.dump(week_jobs),
        unpaid_jobs=jobs_schema.dump(unpaid_jobs),
        totals=_totals(week_jobs, unpaid_jobs),
    )
