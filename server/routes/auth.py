from flask import Blueprint, jsonify, request, session

from ..app import bcrypt
from ..models import User, db
from ..schemas import LoginSchema, SignupSchema, UserSchema

bp = Blueprint("auth", __name__)
signup_schema = SignupSchema()
login_schema = LoginSchema()
user_schema = UserSchema()


@bp.post("/signup")
def signup():
    data = signup_schema.load(request.get_json(silent=True) or {})
    if db.session.scalar(db.select(User).filter_by(username=data["username"])):
        return jsonify(error="Username already taken"), 400
    if db.session.scalar(db.select(User).filter_by(email=data["email"])):
        return jsonify(error="Email already taken"), 400
    user = User(
        username=data["username"],
        email=data["email"],
        password_hash=bcrypt.generate_password_hash(data["password"]).decode("utf-8"),
    )
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return user_schema.dump(user), 201


@bp.post("/login")
def login():
    data = login_schema.load(request.get_json(silent=True) or {})
    user = db.session.scalar(db.select(User).filter_by(username=data["username"]))
    if not user or not bcrypt.check_password_hash(user.password_hash, data["password"]):
        return jsonify(error="Invalid username or password"), 401
    session["user_id"] = user.id
    return user_schema.dump(user)


@bp.delete("/logout")
def logout():
    session.pop("user_id", None)
    return "", 204


@bp.get("/check_session")
def check_session():
    user_id = session.get("user_id")
    if user_id is None:
        return jsonify(error="Unauthorized"), 401
    user = db.session.get(User, user_id)
    if user is None:
        session.pop("user_id", None)
        return jsonify(error="Unauthorized"), 401
    return user_schema.dump(user)
