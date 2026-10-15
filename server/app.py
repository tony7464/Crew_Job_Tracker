import logging
import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from marshmallow import ValidationError

from .models import db
from .pagination import QueryParamError

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

bcrypt = Bcrypt()
migrate = Migrate()
log = logging.getLogger(__name__)

DEV_SECRET_KEY = "dev-only-insecure-key"


def database_uri():
    url = os.environ.get("DATABASE_URL")
    if url:
        scheme, separator, rest = url.partition("://")
        if separator and "+" not in scheme and scheme in {"postgres", "postgresql"}:
            return "postgresql+psycopg2://" + rest
        return url
    db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "app.db")
    return "sqlite:///" + db_path


def env_flag(name, default=False):
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    secret = os.environ.get("SECRET_KEY")
    if not secret:
        log.warning(
            "SECRET_KEY is not set. Using a dev-only fallback. "
            "Set SECRET_KEY in the environment before deploying."
        )
        secret = DEV_SECRET_KEY
    app.config["SECRET_KEY"] = secret
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = env_flag("SESSION_COOKIE_SECURE")

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)

    @app.errorhandler(ValidationError)
    def handle_validation(err):
        return {"errors": err.messages}, 400

    @app.errorhandler(QueryParamError)
    def handle_query_param(err):
        return {"errors": err.errors}, 400

    from .routes import register_routes

    register_routes(app)
    return app


app = create_app()
