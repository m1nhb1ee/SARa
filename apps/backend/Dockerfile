FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=8000
WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .
RUN useradd -m -u 1000 django \
    && mkdir -p /app/staticfiles /app/logs && chown -R django:django /app
USER django

EXPOSE 8000
CMD sh -c "python manage.py collectstatic --noinput && \
           gunicorn config.wsgi:application \
             --bind 0.0.0.0:${PORT} \
             --workers ${WEB_CONCURRENCY:-3} \
             --timeout ${GUNICORN_TIMEOUT:-120} \
             --access-logfile - --error-logfile -"