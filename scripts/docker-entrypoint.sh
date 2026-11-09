#!/bin/sh
# Container entrypoint: a private MQTT broker for the in-process water simulator,
# then the GoGreen API (which also serves the frontend).
set -e

# Broker bound to localhost only: never reachable from outside the container
cat > /tmp/mosquitto.conf <<'EOF'
listener 1883 127.0.0.1
allow_anonymous true
persistence false
log_type error
EOF
mosquitto -c /tmp/mosquitto.conf -d

exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-5000}" --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 5
