from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from backend.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and apply incremental migrations."""
    from backend import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Ensure collection columns exist on movies table
    try:
        with engine.connect() as conn:
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(movies)")).fetchall()]
            if "collection_id" not in cols:
                conn.execute(text("ALTER TABLE movies ADD COLUMN collection_id INTEGER"))
            if "collection_name" not in cols:
                conn.execute(text("ALTER TABLE movies ADD COLUMN collection_name VARCHAR"))
            conn.commit()
    except Exception:
        pass
