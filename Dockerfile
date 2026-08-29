# Purser container: Node builds the static panel, Python serves it + the API.
FROM node:20-slim AS panel
WORKDIR /build
COPY panel/package.json panel/package-lock.json* ./
RUN npm install --silent
COPY panel/ .
# Panel build fetches the two Google fonts (documented in README).
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/src
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./
COPY --from=panel /build/out ../panel/out
# PurserMemory resolves runtime/ relative to src/; point it at the Railway volume.
ENV PURSER_PANEL_DB=/data/panel_memory.db
RUN mkdir -p /data
EXPOSE 8000
CMD ["python", "-m", "purser.api"]
