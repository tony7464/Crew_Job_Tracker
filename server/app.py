import os

from flask import Flask
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from marshmallow import ValidationError

from .models import db

bcrypt = Bcrypt()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "app.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + db_path
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "dev-secret"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)

    @app.errorhandler(ValidationError)
    def handle_validation(err):
        return {"errors": err.messages}, 400

    from .routes import register_routes

    register_routes(app)
    return app


app = create_app()
