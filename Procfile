web: cd backend && (alembic upgrade head || echo "WARNING: Alembic migration failed, starting app anyway") && uvicorn main:app --host 0.0.0.0 --port $PORT
