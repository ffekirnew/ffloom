FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src/ src/
RUN pip install --no-cache-dir '.[server]'
COPY --from=web /web/dist /app/web
ENV FFLOOM_DB=/data/ffloom.db \
    FFLOOM_WEB_DIR=/app/web \
    PYTHONUNBUFFERED=1
USER 1000:1000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD ["uvicorn", "ffloom.server:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
