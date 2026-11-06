FROM python:3.13-alpine
WORKDIR /opt/indexnow
COPY monitor.py ./
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 INDEXNOW_KEY_FILE=/config/key.txt INDEXNOW_STATE_DIR=/data
USER 1000:1000
CMD ["python", "monitor.py", "run"]
