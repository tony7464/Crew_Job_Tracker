from functools import wraps

from flask import session

from .ownership import unauthorized


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return unauthorized()
        return view(*args, **kwargs)

    return wrapped


def register_routes(app):
    from .auth import bp as auth_bp
    from .clients import bp as clients_bp
    from .dashboard import bp as dashboard_bp
    from .jobs import bp as jobs_bp

    for blueprint in (auth_bp, clients_bp, dashboard_bp, jobs_bp):
        app.register_blueprint(blueprint, url_prefix="/api")
