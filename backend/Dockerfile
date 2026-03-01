FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render sets PORT env var; default 8000 for local
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
