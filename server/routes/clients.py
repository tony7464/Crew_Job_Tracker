from flask import Blueprint, jsonify, request, session

from ..models import Client, db
from ..pagination import paginate
from ..schemas import ClientSchema
from . import login_required
from .ownership import not_found, owned_client

bp = Blueprint("clients", __name__)
client_schema = ClientSchema()
clients_schema = ClientSchema(many=True, exclude=("jobs",))


@bp.get("/clients")
@login_required
def list_clients():
    stmt = (
        db.select(Client)
        .filter_by(user_id=session["user_id"])
        .order_by(Client.name, Client.id)
    )
    return jsonify(paginate(stmt, clients_schema))


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
        return not_found()
    return jsonify(client_schema.dump(client))


@bp.patch("/clients/<int:client_id>")
@login_required
def update_client(client_id):
    client = owned_client(client_id)
    if client is None:
        return not_found()
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
        return not_found()
    db.session.delete(client)
    db.session.commit()
    return "", 204
