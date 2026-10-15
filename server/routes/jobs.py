from flask import Blueprint, jsonify, request, session
from sqlalchemy.orm import joinedload

from ..models import Job, db
from ..pagination import QueryParamError, paginate
from ..schemas import STATUSES, JobSchema
from . import login_required
from .ownership import not_found, owned_client, owned_job

bp = Blueprint("jobs", __name__)
job_schema = JobSchema()
jobs_schema = JobSchema(many=True)


def owned_jobs():
    return (
        db.select(Job)
        .options(joinedload(Job.client))
        .filter_by(user_id=session["user_id"])
        .order_by(Job.date, Job.time, Job.id)
    )


@bp.get("/jobs")
@login_required
def list_jobs():
    stmt = owned_jobs()
    status = request.args.get("status")
    if status in STATUSES:
        stmt = stmt.filter_by(status=status)
    paid = request.args.get("paid")
    if paid is not None and paid != "":
        if paid == "true":
            stmt = stmt.filter_by(paid=True)
        elif paid == "false":
            stmt = stmt.filter_by(paid=False)
        else:
            raise QueryParamError("paid", "Must be true or false.")
    return jsonify(paginate(stmt, jobs_schema))


@bp.post("/jobs")
@login_required
def create_job():
    data = job_schema.load(request.get_json(silent=True) or {})
    if owned_client(data["client_id"]) is None:
        return not_found()
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
        return not_found()
    return jsonify(job_schema.dump(job))


@bp.patch("/jobs/<int:job_id>")
@login_required
def update_job(job_id):
    job = owned_job(job_id)
    if job is None:
        return not_found()
    data = job_schema.load(request.get_json(silent=True) or {}, partial=True)
    if "client_id" in data and owned_client(data["client_id"]) is None:
        return not_found()
    for key, value in data.items():
        setattr(job, key, value)
    db.session.commit()
    return jsonify(job_schema.dump(job))


@bp.delete("/jobs/<int:job_id>")
@login_required
def delete_job(job_id):
    job = owned_job(job_id)
    if job is None:
        return not_found()
    db.session.delete(job)
    db.session.commit()
    return "", 204
