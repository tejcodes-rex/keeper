# Keeper agent backend. Includes Node so the Dynatrace MCP server runs via npx.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

# Node 20 for the Dynatrace MCP server (npx @dynatrace-oss/dynatrace-mcp-server)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY keeper ./keeper

CMD ["sh", "-c", "uvicorn keeper.server:app --host 0.0.0.0 --port ${PORT}"]
