#!/usr/bin/env bash
# WARNING: FOR DEMO/DEVELOPMENT USE ONLY — NOT FOR PRODUCTION.
# Security is disabled. Data is unencrypted and unauthenticated.
#
# Starts OpenSearch via Docker Compose for use as a vector store.
# Security plugin is disabled — HTTP only, no authentication for connections.
# An admin password is still required by OpenSearch 2.12+ at startup.
#
# Usage (Linux/macOS):
#   chmod +x start.sh
#   ./start.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Load .env ─────────────────────────────────────────────────────────────────

read_env() {
    [[ -f "$ENV_FILE" ]] || return
    while IFS= read -r line; do
        [[ "$line" =~ ^\s*# ]] && continue
        [[ "$line" =~ ^\s*$ ]] && continue
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]// /}"
            value="${BASH_REMATCH[2]}"
            # Only set if not already in environment
            [[ -z "${!key+x}" ]] && export "$key=$value"
        fi
    done < "$ENV_FILE"
}

write_env() {
    cat > "$ENV_FILE" <<EOF
OPENSEARCH_PASSWORD=$OPENSEARCH_PASSWORD
OPENSEARCH_PORT=$OPENSEARCH_PORT
EOF
    echo "Settings saved to $ENV_FILE"

    local gitignore="$SCRIPT_DIR/.gitignore"
    if [[ ! -f "$gitignore" ]]; then
        echo ".env" > "$gitignore"
    elif ! grep -qxF ".env" "$gitignore"; then
        printf '\n.env' >> "$gitignore"
    fi
}

# ── Port helpers ──────────────────────────────────────────────────────────────

is_port_free() {
    ! (echo >/dev/tcp/localhost/"$1") 2>/dev/null
}

find_free_port() {
    local port=$1
    while ! is_port_free "$port"; do
        echo "Port $port is in use, trying $((port + 1))..."
        port=$((port + 1))
    done
    echo "$port"
}

# ── Password validation ───────────────────────────────────────────────────────

check_password_strength() {
    local pw="$1"
    if (( ${#pw} < 12 ));                        then echo "Password must be at least 12 characters long."; return; fi
    if [[ "$pw" != *[A-Z]* ]];                   then echo "Password must contain at least one uppercase letter."; return; fi
    if [[ "$pw" != *[a-z]* ]];                   then echo "Password must contain at least one lowercase letter."; return; fi
    if [[ "$pw" != *[0-9]* ]];                   then echo "Password must contain at least one digit."; return; fi
    if [[ "$pw" =~ ^[A-Za-z0-9]+$ ]];            then echo "Password must contain at least one special character."; return; fi
    echo ""
}

# ── Init ──────────────────────────────────────────────────────────────────────

unset OPENSEARCH_PASSWORD OPENSEARCH_PORT
read_env

# ── Disclaimer ────────────────────────────────────────────────────────────────

echo ""
echo "  This setup is for DEMO/DEVELOPMENT purposes only."
echo "  It is not supported in any production environment."
echo ""
read -rp "  If you are fully aware and agree, type 'ok' to continue: " consent
if [[ "$consent" != "ok" ]]; then
    echo "Aborted."
    exit 0
fi
echo ""

# ── Admin password ────────────────────────────────────────────────────────────

changed=false

if [[ -z "${OPENSEARCH_PASSWORD:-}" ]]; then
    echo "  OpenSearch requires a strong password (scored by zxcvbn)."
    echo "  Min 12 chars, upper+lower+digit+special. Avoid common words/patterns."
    echo "  Test strength: https://lowe.github.io/tryzxcvbn"
    while true; do
        read -rsp "Admin password (startup only, not used for connections): " pw
        echo ""
        err="$(check_password_strength "$pw")"
        if [[ -z "$err" ]]; then
            export OPENSEARCH_PASSWORD="$pw"
            break
        fi
        echo "  Invalid: $err"
    done
    changed=true
fi

# ── Port ──────────────────────────────────────────────────────────────────────

start_port="${OPENSEARCH_PORT:-19600}"
resolved_port="$(find_free_port "$start_port")"
if [[ "$resolved_port" != "$start_port" ]]; then
    echo "Using port $resolved_port instead."
    changed=true
fi
export OPENSEARCH_PORT="$resolved_port"

if [[ "$changed" == true ]]; then write_env; fi

# ── Docker check ──────────────────────────────────────────────────────────────

if ! docker version > /dev/null 2>&1; then
    echo "Error: docker is not installed or not on PATH." >&2
    exit 1
fi

# ── Docker Compose ────────────────────────────────────────────────────────────

cd "$SCRIPT_DIR"

compose_cmd=""
if docker compose version > /dev/null 2>&1; then
    compose_cmd="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    compose_cmd="docker-compose"
else
    echo "Error: Neither 'docker compose' plugin nor 'docker-compose' is available." >&2
    exit 1
fi

echo "Starting OpenSearch..."
$compose_cmd up -d

# ── Wait until healthy ────────────────────────────────────────────────────────

printf "Waiting for OpenSearch to be ready"
max_retries=30
retry=0
ready=false

while (( retry <= max_retries )); do
    if docker exec smart-workflow-opensearch \
        curl -fs "http://localhost:9200/_cluster/health" > /dev/null 2>&1; then
        ready=true
        break
    fi
    printf "."
    sleep 2
    retry=$(( retry + 1 ))
done

echo ""

if [[ "$ready" != true ]]; then
    echo "Error: OpenSearch did not become ready after $(( max_retries * 2 )) seconds." >&2
    echo "Check logs: docker logs smart-workflow-opensearch" >&2
    exit 1
fi

echo " ready."

# ── Summary ───────────────────────────────────────────────────────────────────

url="http://localhost:${OPENSEARCH_PORT}"
echo ""
echo "==========================================================="
echo "  OpenSearch Vector Store"
echo "-----------------------------------------------------------"
echo "  URL      : $url"
echo "-----------------------------------------------------------"
echo "  Set these Ivy variables:"
echo "    AI.RAG.OpenSearch.Url               = $url"
echo "    AI.RAG.OpenSearch.ApiKey             = (leave blank)"
echo "    AI.RAG.OpenSearch.UserName           = (leave blank)"
echo "    AI.RAG.OpenSearch.Password           = (leave blank)"
echo "==========================================================="
echo ""
echo "Stop:   $compose_cmd stop"
echo "Logs:   $compose_cmd logs -f"
echo "Reset:  $compose_cmd down -v   # also deletes index data"
