#!/bin/bash
set -euo pipefail

# ── setup-projects.sh ─────────────────────────────────────────
# Reads projects.json → generates nginx configs → builds → deploys
# Usage: ./setup-projects.sh [--skip-build] [--skip-nginx]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECTS_FILE="$SCRIPT_DIR/projects.json"
NGINX_DIR="/etc/nginx/sites-available"
MINIAPP_DOMAIN="miniapp-herman-bot.rzbal.xyz"
MINIAPP_PORT=9122
AUTH_ENDPOINT="http://127.0.0.1:${MINIAPP_PORT}/internal/auth"
MINIAPP_SERVICE="miniapp-serve.service"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; }

SKIP_BUILD=false
SKIP_NGINX=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --skip-nginx) SKIP_NGINX=true ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────
if [ ! -f "$PROJECTS_FILE" ]; then
  err "projects.json not found at $PROJECTS_FILE"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  warn "jq not found, installing..."
  apt-get install -y jq >/dev/null 2>&1
fi

PROJECT_COUNT=$(jq '.projects | length' "$PROJECTS_FILE")
log "Found $PROJECT_COUNT project(s) in projects.json"

# ── Generate nginx configs ────────────────────────────────────
generate_nginx_config() {
  local domain="$1"
  local port="$2"
  local name="$3"
  local config_file="$NGINX_DIR/$domain"

  cat > "$config_file" << NGINX
server {
    listen 80;
    server_name $domain;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $domain;

    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Auth request: miniapp_only access control
    location = /_auth {
        internal;
        proxy_pass $AUTH_ENDPOINT;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI \$request_uri;
        proxy_set_header Referer \$http_referer;
        proxy_set_header Origin \$http_origin;
        proxy_set_header X-Auth-Bypass \$http_x_auth_bypass;
        proxy_set_header X-Auth-Token \$arg_t;
        proxy_set_header Cookie \$http_cookie;
    }

    # Blocked page (same style as miniapp landing)
    error_page 403 = @blocked;

    location @blocked {
        default_type text/html;
        return 403 '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$name - Access Restricted</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a1a;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:#f5f5f5;padding:24px}
.card{background:#242424;border:1px solid rgba(71,71,71,.8);border-radius:14px;padding:40px;max-width:420px;width:100%;text-align:center;box-shadow:0 0 0 1px rgba(255,107,74,.045),0 10px 26px rgba(0,0,0,.22)}
.icon{width:56px;height:56px;border-radius:14px;background:#ff6b4a;display:grid;place-items:center;margin:0 auto 20px;font-size:24px}
.badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;background:rgba(255,255,255,.06);border:1px solid rgba(63,63,70,.5);border-radius:8px;padding:6px 14px;margin-bottom:16px}
h1{font-size:22px;margin-bottom:8px;font-weight:600}
p{color:#808080;font-size:14px;line-height:1.6}
.footer{margin-top:24px;font-size:11px;color:#555}
</style>
</head>
<body>
<div class="card">
<div class="icon">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4"/></svg>
</div>
<div class="badge">Telegram Mini App</div>
<h1>$name</h1>
<p>This dashboard is available exclusively through the MiniApp.</p>
<div class="footer">by Joe</div>
</div>
</body>
</html>';
    }

    location / {
        auth_request /_auth;
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
NGINX

  # Enable site (symlink)
  if [ ! -L "/etc/nginx/sites-enabled/$domain" ]; then
    ln -sf "$config_file" "/etc/nginx/sites-enabled/$domain"
    log "Enabled site: $domain"
  fi

  # Check SSL cert exists
  if [ ! -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
    warn "SSL cert missing for $domain — run: certbot certonly --nginx -d $domain"
  fi
}

if [ "$SKIP_NGINX" = false ]; then
  echo ""
  echo "── Generating nginx configs ──"
  for i in $(seq 0 $((PROJECT_COUNT - 1))); do
    domain=$(jq -r ".projects[$i].domain" "$PROJECTS_FILE")
    port=$(jq -r ".projects[$i].port" "$PROJECTS_FILE")
    name=$(jq -r ".projects[$i].name" "$PROJECTS_FILE")
    enabled=$(jq -r ".projects[$i].enabled" "$PROJECTS_FILE")

    if [ "$enabled" = "true" ]; then
      generate_nginx_config "$domain" "$port" "$name"
      log "Nginx config: $domain → localhost:$port"
    else
      warn "Skipping disabled project: $name"
    fi
  done

  # Test and reload nginx
  if nginx -t 2>&1; then
    systemctl restart nginx
    log "Nginx restarted"
  else
    err "Nginx config test failed! Check configs manually."
    exit 1
  fi
fi

# ── Build frontend ────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "── Building frontend ──"
  cd "$SCRIPT_DIR"
  npm run build 2>&1 | tail -3
  log "Frontend built"
fi

# ── Restart miniapp server ────────────────────────────────────
echo ""
echo "── Restarting services ──"
systemctl restart "$MINIAPP_SERVICE"
sleep 2

if systemctl is-active --quiet "$MINIAPP_SERVICE"; then
  log "miniapp-serve.service restarted"
else
  err "miniapp-serve.service failed to start!"
  journalctl -u "$MINIAPP_SERVICE" -n 10 --no-pager
  exit 1
fi

# ── Verify ────────────────────────────────────────────────────
echo ""
echo "── Verification ──"
echo "Settings: $(curl -s "https://$MINIAPP_DOMAIN/api/settings" 2>/dev/null || echo 'FAILED')"
echo "Auth token: $(curl -s "https://$MINIAPP_DOMAIN/api/auth-token" 2>/dev/null | head -c 40 || echo 'FAILED')..."

for i in $(seq 0 $((PROJECT_COUNT - 1))); do
  domain=$(jq -r ".projects[$i].domain" "$PROJECTS_FILE")
  enabled=$(jq -r ".projects[$i].enabled" "$PROJECTS_FILE")
  if [ "$enabled" = "true" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" "https://$domain/" 2>/dev/null || echo "ERR")
    echo "  $domain: HTTP $status (403 = protected)"
  fi
done

echo ""
log "All done! Projects configured: $PROJECT_COUNT"
