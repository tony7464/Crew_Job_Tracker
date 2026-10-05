from functools import wraps

from flask import jsonify, session


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return jsonify(error="Unauthorized"), 401
        return view(*args, **kwargs)

    return wrapped


def register_routes(app):
    from .auth import bp as auth_bp
    from .clients import bp as clients_bp
    from .jobs import bp as jobs_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(clients_bp)
    app.register_blueprint(jobs_bp)
