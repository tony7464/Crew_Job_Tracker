from flask import Blueprint, jsonify, request, session

from ..models import Client, db
from ..schemas import ClientSchema
from . import login_required

bp = Blueprint("clients", __name__)
client_schema = ClientSchema()
clients_schema = ClientSchema(many=True, exclude=("jobs",))


def owned_client(client_id):
    return db.session.scalar(
        db.select(Client).filter_by(id=client_id, user_id=session["user_id"])
    )


@bp.get("/clients")
@login_required
def list_clients():
    clients = db.session.scalars(
        db.select(Client).filter_by(user_id=session["user_id"])
    ).all()
    return jsonify(clients_schema.dump(clients))


@bp.post("/clients")
@login_required
def create_client():
    data = client_schema.load(request.get_json(silent=True) or {})
    client = Client(user_id=session["user_id"], **data)
    db.session.add(client)
    db.session.commit()
    return jsonify(client_schema.dump(client)), 201


@bp.get("/clients/<int:client_id>")
@login_required
def get_client(client_id):
    client = owned_client(client_id)
    if client is None:
        return jsonify(error="Not found"), 404
    return jsonify(client_schema.dump(client))


@bp.patch("/clients/<int:client_id>")
@login_required
def update_client(client_id):
    client = owned_client(client_id)
    if client is None:
        return jsonify(error="Not found"), 404
    data = client_schema.load(request.get_json(silent=True) or {}, partial=True)
    for key, value in data.items():
        setattr(client, key, value)
    db.session.commit()
    return jsonify(client_schema.dump(client))


@bp.delete("/clients/<int:client_id>")
@login_required
def delete_client(client_id):
    client = owned_client(client_id)
    if client is None:
        return jsonify(error="Not found"), 404
    db.session.delete(client)
    db.session.commit()
    return "", 204
