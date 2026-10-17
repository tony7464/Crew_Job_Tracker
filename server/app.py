import logging
import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from marshmallow import ValidationError

from .models import db
from .pagination import QueryParamError

_SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_SERVER_DIR, ".env"))

bcrypt = Bcrypt()
migrate = Migrate()
log = logging.getLogger(__name__)

DEV_SECRET_KEY = "dev-only-insecure-key"
CLIENT_DIST = os.path.abspath(os.path.join(_SERVER_DIR, "..", "client", "dist"))
MIGRATIONS_DIR = os.path.join(_SERVER_DIR, "migrations")


def database_uri():
    url = os.environ.get("DATABASE_URL")
    if url:
        scheme, separator, rest = url.partition("://")
        # SQLAlchemy needs the psycopg2 driver named in the URL.
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
    migrate.init_app(app, db, directory=MIGRATIONS_DIR)
    bcrypt.init_app(app)

    @app.errorhandler(ValidationError)
    def handle_validation(err):
        return {"errors": err.messages}, 400

    @app.errorhandler(QueryParamError)
    def handle_query_param(err):
        return {"errors": err.errors}, 400

    from .routes import register_routes

    register_routes(app)
    register_frontend(app)
    return app


def _is_api_path(path):
    return path == "/api" or path.startswith("/api/")


def register_frontend(app):
    """Serve the built React app. Unknown /api paths stay a JSON 404."""

    @app.errorhandler(404)
    def handle_not_found(_err):
        if _is_api_path(request.path):
            return {"error": "Not found"}, 404
        index = os.path.join(CLIENT_DIST, "index.html")
        if request.method in {"GET", "HEAD"} and os.path.isfile(index):
            return send_from_directory(CLIENT_DIST, "index.html")
        return {"error": "Not found"}, 404

    @app.before_request
    def serve_built_frontend():
        if request.method not in {"GET", "HEAD"}:
            return None
        if _is_api_path(request.path):
            return None
        if not os.path.isdir(CLIENT_DIST):
            return None

        relative = request.path.lstrip("/")
        if relative:
            root = os.path.normpath(CLIENT_DIST)
            requested = os.path.normpath(os.path.join(root, relative))
            # Reject paths that climb out of the built client folder.
            inside_dist = requested == root or requested.startswith(root + os.sep)
            if inside_dist and os.path.isfile(requested):
                return send_from_directory(CLIENT_DIST, relative)

        index = os.path.join(CLIENT_DIST, "index.html")
        if os.path.isfile(index):
            return send_from_directory(CLIENT_DIST, "index.html")
        return None


app = create_app()
