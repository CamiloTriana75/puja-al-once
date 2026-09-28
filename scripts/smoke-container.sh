#!/usr/bin/env bash
set -euo pipefail

image="${1:-subasta-futbolera:ci}"
container_name="fut-smoke-${GITHUB_RUN_ID:-local}-${RANDOM:-0}"
port="${SMOKE_PORT:-2569}"

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach \
  --name "$container_name" \
  --publish "127.0.0.1:${port}:2567" \
  "$image"

for attempt in {1..20}; do
  if curl --fail --silent "http://127.0.0.1:${port}/health/ready" >/dev/null; then
    echo "Container readiness endpoint responded."
    curl --fail --silent --show-error "http://127.0.0.1:${port}/" >/dev/null
    exit 0
  fi
  sleep 1
done

docker logs "$container_name"
exit 1
