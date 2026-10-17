from flask import Blueprint, jsonify, request, session
from sqlalchemy import func

from ..app import bcrypt
from ..models import User, db
from ..schemas import LoginSchema, SignupSchema, UserSchema
from .ownership import current_user, unauthorized

bp = Blueprint("auth", __name__)
signup_schema = SignupSchema()
login_schema = LoginSchema()
user_schema = UserSchema()


def _user_by(column, value):
    return db.session.scalar(db.select(User).where(func.lower(column) == value.lower()))


@bp.post("/signup")
def signup():
    data = signup_schema.load(request.get_json(silent=True) or {})
    if _user_by(User.username, data["username"]):
        return jsonify(errors={"username": ["Username already taken"]}), 400
    if _user_by(User.email, data["email"]):
        return jsonify(errors={"email": ["Email already taken"]}), 400
    user = User(
        username=data["username"],
        email=data["email"],
        password_hash=bcrypt.generate_password_hash(data["password"]).decode("utf-8"),
    )
    db.session.add(user)
    db.session.commit()
    session.permanent = True
    session["user_id"] = user.id
    return user_schema.dump(user), 201


@bp.post("/login")
def login():
    data = login_schema.load(request.get_json(silent=True) or {})
    user = _user_by(User.username, data["username"])
    if not user or not bcrypt.check_password_hash(user.password_hash, data["password"]):
        return jsonify(errors={"auth": ["Invalid username or password"]}), 401
    session.permanent = True
    session["user_id"] = user.id
    return user_schema.dump(user)


@bp.delete("/logout")
def logout():
    session.clear()
    return "", 204


@bp.get("/check_session")
def check_session():
    user = current_user()
    if user is None:
        session.clear()
        return unauthorized()
    return user_schema.dump(user)
