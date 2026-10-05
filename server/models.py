from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String, unique=True, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=False)

    clients = db.relationship(
        "Client", back_populates="user", cascade="all, delete-orphan"
    )
    jobs = db.relationship("Job", back_populates="user", cascade="all, delete-orphan")


class Client(db.Model):
    __tablename__ = "clients"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    address = db.Column(db.String)
    phone = db.Column(db.String)
    notes = db.Column(db.String)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    user = db.relationship("User", back_populates="clients")
    jobs = db.relationship(
        "Job", back_populates="client", cascade="all, delete-orphan"
    )


class Job(db.Model):
    __tablename__ = "jobs"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time, nullable=False)
    service_type = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default="scheduled")
    price = db.Column(db.Numeric(10, 2), nullable=False)
    paid = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.String)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    client = db.relationship("Client", back_populates="jobs")
    user = db.relationship("User", back_populates="jobs")
