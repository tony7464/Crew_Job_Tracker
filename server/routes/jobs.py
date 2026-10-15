from flask import Blueprint, jsonify, request, session
from sqlalchemy.orm import joinedload

from ..models import Client, Job, db
from ..schemas import STATUSES, JobSchema
from . import login_required

bp = Blueprint("jobs", __name__)
job_schema = JobSchema()
jobs_schema = JobSchema(many=True)


def owned_job(job_id):
    return db.session.scalar(
        db.select(Job).filter_by(id=job_id, user_id=session["user_id"])
    )


def owned_client(client_id):
    return db.session.scalar(
        db.select(Client).filter_by(id=client_id, user_id=session["user_id"])
    )


def owned_jobs():
    return (
        db.select(Job)
        .options(joinedload(Job.client))
        .filter_by(user_id=session["user_id"])
        .order_by(Job.date, Job.time)
    )


@bp.get("/jobs")
@login_required
def list_jobs():
    stmt = owned_jobs()
    status = request.args.get("status")
    if status in STATUSES:
        stmt = stmt.filter_by(status=status)
    paid = request.args.get("paid")
    if paid == "true":
        stmt = stmt.filter_by(paid=True)
    elif paid == "false":
        stmt = stmt.filter_by(paid=False)
    jobs = db.session.scalars(stmt).unique().all()
    return jsonify(jobs_schema.dump(jobs))


@bp.post("/jobs")
@login_required
def create_job():
    data = job_schema.load(request.get_json(silent=True) or {})
    if owned_client(data["client_id"]) is None:
        return jsonify(error="Not found"), 404
    data.setdefault("status", "scheduled")
    data.setdefault("paid", False)
    job = Job(user_id=session["user_id"], **data)
    db.session.add(job)
    db.session.commit()
    return jsonify(job_schema.dump(job)), 201


@bp.get("/jobs/<int:job_id>")
@login_required
def get_job(job_id):
    job = owned_job(job_id)
    if job is None:
        return jsonify(error="Not found"), 404
    return jsonify(job_schema.dump(job))


@bp.patch("/jobs/<int:job_id>")
@login_required
def update_job(job_id):
    job = owned_job(job_id)
    if job is None:
        return jsonify(error="Not found"), 404
    data = job_schema.load(request.get_json(silent=True) or {}, partial=True)
    if "client_id" in data and owned_client(data["client_id"]) is None:
        return jsonify(error="Not found"), 404
    for key, value in data.items():
        setattr(job, key, value)
    db.session.commit()
    return jsonify(job_schema.dump(job))


@bp.delete("/jobs/<int:job_id>")
@login_required
def delete_job(job_id):
    job = owned_job(job_id)
    if job is None:
        return jsonify(error="Not found"), 404
    db.session.delete(job)
    db.session.commit()
    return "", 204
