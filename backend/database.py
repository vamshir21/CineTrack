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

    # Ensure migrations and default admin profile exist
    try:
        with engine.connect() as conn:
            # 1. Collection columns on movies
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(movies)")).fetchall()]
            if "collection_id" not in cols:
                conn.execute(text("ALTER TABLE movies ADD COLUMN collection_id INTEGER"))
            if "collection_name" not in cols:
                conn.execute(text("ALTER TABLE movies ADD COLUMN collection_name VARCHAR"))

            # 2. Profile column on watch_history
            wh_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(watch_history)")).fetchall()]
            if "profile_id" not in wh_cols:
                conn.execute(text("ALTER TABLE watch_history ADD COLUMN profile_id INTEGER REFERENCES profiles(id)"))

            # 3. Profile column on watchlist
            wl_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(watchlist)")).fetchall()]
            if "profile_id" not in wl_cols:
                conn.execute(text("ALTER TABLE watchlist ADD COLUMN profile_id INTEGER REFERENCES profiles(id)"))

            # 4. Default Admin profile
            profile_count = conn.execute(text("SELECT count(*) FROM profiles")).scalar() or 0
            if profile_count == 0:
                conn.execute(text(
                    "INSERT INTO profiles (name, avatar, is_admin, created_at) "
                    "VALUES ('Admin', 'netflix-red', 1, CURRENT_TIMESTAMP)"
                ))

            # Find default admin ID
            admin_id = conn.execute(text("SELECT id FROM profiles WHERE is_admin = 1 ORDER BY id ASC LIMIT 1")).scalar() or 1
            # Associate any orphaned records to the admin profile
            conn.execute(text(f"UPDATE watch_history SET profile_id = {admin_id} WHERE profile_id IS NULL"))
            conn.execute(text(f"UPDATE watchlist SET profile_id = {admin_id} WHERE profile_id IS NULL"))

            conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Migration note: %s", e)
