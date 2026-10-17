from datetime import date, time, timedelta

from .app import app, bcrypt
from .models import Client, Job, User, db
from .schemas import STATUSES

CLIENTS = (
    ("Maple Ave", "10 Maple Ave", "555-0101", "Gate code 1111"),
    ("Oak Street", "22 Oak St", "555-0102", "Dog in the yard"),
    ("Pine Court", "5 Pine Ct", "555-0103", None),
    ("Cedar Lane", "80 Cedar Ln", "555-0104", "Call on arrival"),
    ("Elm Drive", "14 Elm Dr", "555-0105", "Side door"),
)
SERVICES = ("Windows", "Janitorial", "Gutters")


def main():
    with app.app_context():
        db.session.execute(db.delete(Job))
        db.session.execute(db.delete(Client))
        db.session.execute(db.delete(User))

        user = User(
            username="demo",
            email="demo@example.com",
            password_hash=bcrypt.generate_password_hash("password123").decode("utf-8"),
        )
        db.session.add(user)
        db.session.flush()

        clients = [
            Client(name=name, address=address, phone=phone, notes=notes, user_id=user.id)
            for name, address, phone, notes in CLIENTS
        ]
        db.session.add_all(clients)
        db.session.flush()

        today = date.today()
        monday = today - timedelta(days=today.weekday())
        jobs = []
        for count in range(15):
            week_start = monday + timedelta(days=(count // 5 - 1) * 7)
            jobs.append(
                Job(
                    date=week_start + timedelta(days=count % 5),
                    time=time(8 + (count % 8), 0 if count % 2 == 0 else 30),
                    service_type=SERVICES[count % 3],
                    status=STATUSES[count % 3],
                    price=75 + count * 10,
                    paid=count % 2 == 0,
                    notes=None,
                    client_id=clients[count % len(clients)].id,
                    user_id=user.id,
                )
            )
        db.session.add_all(jobs)
        db.session.commit()
        print(f"Seeded user demo with {len(clients)} clients and {len(jobs)} jobs")


if __name__ == "__main__":
    main()
