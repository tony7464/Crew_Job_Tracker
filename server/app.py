import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from marshmallow import ValidationError

from .models import db
from .pagination import PaginationError

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

bcrypt = Bcrypt()
migrate = Migrate()
log = logging.getLogger(__name__)

DEV_SECRET_KEY = "dev-only-insecure-key"


def database_uri():
    url = os.environ.get("DATABASE_URL")
    if url:
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        return url
    db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "app.db")
    return "sqlite:///" + db_path


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
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)

    @app.errorhandler(ValidationError)
    def handle_validation(err):
        return {"errors": err.messages}, 400

    @app.errorhandler(PaginationError)
    def handle_pagination(err):
        return {"errors": err.errors}, 400

    from .routes import register_routes

    register_routes(app)
    return app


app = create_app()
