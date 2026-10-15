from flask import jsonify, session

from ..models import Client, Job, User, db


def current_user():
    user_id = session.get("user_id")
    if user_id is None:
        return None
    return db.session.get(User, user_id)


def owned_client(client_id):
    return db.session.scalar(
        db.select(Client).filter_by(id=client_id, user_id=session["user_id"])
    )


def owned_job(job_id):
    return db.session.scalar(
        db.select(Job).filter_by(id=job_id, user_id=session["user_id"])
    )


def unauthorized():
    return jsonify(errors={"auth": ["Unauthorized"]}), 401


def not_found():
    return jsonify(errors={"id": ["Not found"]}), 404
