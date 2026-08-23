FROM python:3.12-slim

WORKDIR /app

RUN useradd --create-home --uid 1000 appuser

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

RUN mkdir -p /data/db /data/master /data/provided-docs
COPY knowledge-base/master-data /data/master
COPY knowledge-base/provided-docs /data/provided-docs
RUN chown -R appuser:appuser /data /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
