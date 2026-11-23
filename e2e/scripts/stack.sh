#!/usr/bin/env bash
# Throwaway E2E stack. Never touches the dev containers (mq-postgres, mq-redis, minio-server) or any .env.
# Usage: stack.sh infra|template|reset|backend|frontend|stop|clean
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SHOP="$(cd "$HERE/../.." && pwd)"
BACK="$(cd "$SHOP/../mq_backend" && pwd)"
RUN="$HERE/../.run"; mkdir -p "$RUN"
ENVF="$HERE/../env/backend.env"
PSQL=(docker exec -i mqe2e-pg psql -U e2e -d postgres -v ON_ERROR_STOP=1 -q)
MINIO_IMG='firstfinger/minio:latest-amd64@sha256:264638de8c29d78c482353eeb6c88974bfccbca4375235b0c8f112cde9a62ade'

wait_http() { for _ in $(seq 1 120); do c=$(curl -s -o /dev/null -w '%{http_code}' "$1" || true); [ "$c" = "$2" ] && return 0; sleep 1; done; echo "timeout waiting for $1" >&2; return 1; }
running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" = true ]; }
# Only LISTENING processes: plain `lsof -ti:PORT` also lists every client connected to the port (the Playwright worker and
# Chromium keep connections to :3005), and killing those closed the browser under a running test.
kill_port() { local p; p=$(lsof -ti tcp:"$1" -sTCP:LISTEN || true); [ -n "$p" ] && kill $p 2>/dev/null || true; for _ in $(seq 1 20); do lsof -ti tcp:"$1" -sTCP:LISTEN >/dev/null 2>&1 || return 0; sleep 0.5; done; }

infra() {
  running mqe2e-pg    || { docker rm -f mqe2e-pg >/dev/null 2>&1 || true;    docker run -d --name mqe2e-pg -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e_pw_local -e POSTGRES_DB=postgres -p 55432:5432 postgres:16-alpine >/dev/null; }
  running mqe2e-redis || { docker rm -f mqe2e-redis >/dev/null 2>&1 || true; docker run -d --name mqe2e-redis -p 56379:6379 redis:7-alpine >/dev/null; }
  running mqe2e-minio || { docker rm -f mqe2e-minio >/dev/null 2>&1 || true; docker run -d --name mqe2e-minio -e MINIO_ROOT_USER=e2eminio -e MINIO_ROOT_PASSWORD=e2eminio_pw -p 59010:9000 "$MINIO_IMG" >/dev/null; }
  for _ in $(seq 1 60); do docker exec mqe2e-pg pg_isready -U e2e >/dev/null 2>&1 && break; sleep 1; done
}

start_backend() { # $1 = db name
  kill_port 3005
  : > "$RUN/backend.log"
  ( set -a; . "$ENVF"; export DATABASE_URL="postgres://e2e:e2e_pw_local@localhost:55432/$1"; set +a
    cd "$RUN" && nohup node "$BACK/dist/main.js" > "$RUN/backend.log" 2>&1 & echo $! > "$RUN/backend.pid" )
  wait_http http://localhost:3005/docs 200
}

# Build the template once: empty DB -> boot backend (TYPEORM_SYNC + migrations) -> seed users + FX -> stop.
template() {
  infra
  if "${PSQL[@]}" -tA -c "select 1 from pg_database where datname='mq_e2e_template'" | grep -q 1 && [ "${E2E_REBUILD_TEMPLATE:-0}" != 1 ]; then return 0; fi
  kill_port 3005
  "${PSQL[@]}" -c "drop database if exists mq_e2e_template" -c "create database mq_e2e_template"
  start_backend mq_e2e_template
  ( set -a; . "$ENVF"; export DATABASE_URL="postgres://e2e:e2e_pw_local@localhost:55432/mq_e2e_template"; set +a
    cd "$RUN" && pnpm --dir "$BACK" seed:users >"$RUN/seed.log" 2>&1 && pnpm --dir "$BACK" seed:fx >>"$RUN/seed.log" 2>&1 )
  kill_port 3005
}

reset() { # fresh DB from template + empty Redis + backend restarted (clears the in-memory throttler)
  template
  kill_port 3005
  "${PSQL[@]}" -c "drop database if exists mq_e2e with (force)" -c "create database mq_e2e template mq_e2e_template"
  docker exec mqe2e-redis redis-cli flushall >/dev/null
  start_backend mq_e2e
}

frontend() {
  kill_port 3000
  cd "$SHOP"
  # Rebuild unless .next is the exact build this script made for E2E (marker = its BUILD_ID): any other build
  # (e.g. the api.example.com gate build) changes BUILD_ID and forces a rebuild with the localhost API host.
  if [ ! -f .next/BUILD_ID ] || [ "${E2E_REBUILD:-0}" = 1 ] || [ ! -f "$RUN/built-for-e2e" ] || [ "$(cat "$RUN/built-for-e2e")" != "$(cat .next/BUILD_ID)" ]; then
    NEXT_PUBLIC_API_HOST=http://localhost:3005 pnpm build > "$RUN/frontend-build.log" 2>&1
    cp .next/BUILD_ID "$RUN/built-for-e2e"
  fi
  NEXT_PUBLIC_API_HOST=http://localhost:3005 nohup pnpm start -p 3000 > "$RUN/frontend.log" 2>&1 &
  wait_http http://localhost:3000/ 200
}

backend() { start_backend "${2:-mq_e2e}"; } # restart ONLY the backend (keeps DB/Redis) after editing env/backend.env

stop() { kill_port 3005; kill_port 3000; }
clean() { stop; docker rm -f mqe2e-pg mqe2e-redis mqe2e-minio >/dev/null 2>&1 || true; rm -rf "$RUN"; }

cmd="${1:?usage: stack.sh infra|template|reset|frontend|stop|clean}"; "$cmd"
