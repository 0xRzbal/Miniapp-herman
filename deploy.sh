#!/usr/bin/env bash
# deploy.sh — Deploy Telegram Mini App to hermes-agent installation.
#
# Usage:
#   ./deploy.sh                # Build + deploy with backup
#   ./deploy.sh --no-backup    # Build + deploy without backup (used by post-merge hook)
#   ./deploy.sh --install-hook # Install post-merge hook + build + deploy (first-time setup)
#   ./deploy.sh --skip-build   # Deploy without building (use existing web_dist/)
#
# Source:  This repo (hermes-telegram-miniapp)
# Target:  ~/.hermes/hermes-agent/

set -euo pipefail

# Resolve paths relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
TARGET_DIR="${HERMES_AGENT_DIR:-$HOME/.hermes/hermes-agent}"

NO_BACKUP=false
INSTALL_HOOK=false
SKIP_BUILD=false

for arg in "$@"; do
    case "$arg" in
        --no-backup)    NO_BACKUP=true ;;
        --install-hook) INSTALL_HOOK=true ;;
        --skip-build)   SKIP_BUILD=true ;;
        --help|-h)
            echo "Usage: $0 [--no-backup] [--install-hook] [--skip-build]"
            echo ""
            echo "  --no-backup     Skip timestamped backup of existing files"
            echo "  --install-hook  Install post-merge git hook for auto-redeploy on hermes update"
            echo "  --skip-build    Deploy existing web_dist/ without rebuilding"
            echo "  --help          Show this help"
            exit 0
            ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()  { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

# --- Pre-checks ---
[[ -d "$SOURCE_DIR" ]] || die "Source dir not found: $SOURCE_DIR"
[[ -d "$TARGET_DIR" ]] || die "Target dir not found: $TARGET_DIR (set HERMES_AGENT_DIR to override)"
[[ -f "$TARGET_DIR/.git/HEAD" ]] || die "Target is not a git repo: $TARGET_DIR"
[[ -f "$SOURCE_DIR/hermes_cli/web_server.py" ]] || die "web_server.py not in source"

# Check that web_server.py has the CORRECT HMAC formula (not the swapped one)
if grep -q 'hmac.new(_TG_BOT_TOKEN.encode(), "WebAppData".encode()' "$SOURCE_DIR/hermes_cli/web_server.py" 2>/dev/null; then
    die "web_server.py still has the BUGGY HMAC formula (swapped args). Fix before deploying."
fi

# --- Build frontend (always unless --skip-build) ---
if [[ "$SKIP_BUILD" == "false" ]]; then
    if [[ ! -d "$SOURCE_DIR/web/node_modules" ]]; then
        log "Installing frontend dependencies..."
        (cd "$SOURCE_DIR/web" && npm install --silent) || die "npm install failed"
    fi

    log "Building frontend from standalone repo source..."
    (cd "$SOURCE_DIR/web" && npm run build) || die "Frontend build failed"

    # Verify the build produced output
    [[ -d "$SOURCE_DIR/hermes_cli/web_dist" ]] || die "Build completed but web_dist/ not found"
    log "Frontend built successfully ($(du -sh "$SOURCE_DIR/hermes_cli/web_dist" | cut -f1))"
fi

# Verify web_dist exists
[[ -d "$SOURCE_DIR/hermes_cli/web_dist" ]] || die "web_dist/ not found — run with --skip-build removed or build manually"

# Check that the built frontend contains Telegram auth (not upstream vanilla)
if ! grep -q "X-Telegram-Init-Data" "$SOURCE_DIR/hermes_cli/web_dist/assets/"*.js 2>/dev/null; then
    die "Built frontend does not contain Telegram auth — rebuild with 'cd web && npm run build'"
fi

# --- Install hook (if requested) ---
if [[ "$INSTALL_HOOK" == "true" ]]; then
    HOOK_SRC="$SOURCE_DIR/hooks/post-merge"
    HOOK_DST="$TARGET_DIR/.git/hooks/post-merge"

    if [[ ! -f "$HOOK_SRC" ]]; then
        die "Hook template not found: $HOOK_SRC"
    fi

    # Replace placeholder with actual path
    log "Installing post-merge hook..."
    sed "s|__MINIAPP_REPO__|$SOURCE_DIR|g" "$HOOK_SRC" > "$HOOK_DST"
    chmod +x "$HOOK_DST"

    # Verify the replacement worked
    if grep -q '__MINIAPP_REPO__' "$HOOK_DST"; then
        die "Failed to replace __MINIAPP_REPO__ placeholder in hook"
    fi

    log "Hook installed → $HOOK_DST"
    log "Hook will auto-redeploy after every 'hermes update'"
fi

# --- Backup ---
BACKUP_DIR=""
if [[ "$NO_BACKUP" == "false" ]]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="$TARGET_DIR/hermes_cli/backups/deploy-$TIMESTAMP"
    mkdir -p "$BACKUP_DIR"

    if [[ -f "$TARGET_DIR/hermes_cli/web_server.py" ]]; then
        cp -p "$TARGET_DIR/hermes_cli/web_server.py" "$BACKUP_DIR/"
        log "Backed up web_server.py → $BACKUP_DIR/"
    fi
    if [[ -d "$TARGET_DIR/hermes_cli/web_dist" ]]; then
        cp -rp "$TARGET_DIR/hermes_cli/web_dist" "$BACKUP_DIR/"
        log "Backed up web_dist/ → $BACKUP_DIR/"
    fi
fi

# --- Deploy backend ---
log "Deploying web_server.py..."
cp -p "$SOURCE_DIR/hermes_cli/web_server.py" "$TARGET_DIR/hermes_cli/web_server.py"

# --- Deploy frontend ---
log "Deploying web_dist/..."
rm -rf "$TARGET_DIR/hermes_cli/web_dist"
cp -rp "$SOURCE_DIR/hermes_cli/web_dist" "$TARGET_DIR/hermes_cli/web_dist/"

# --- Deploy frontend source files ---
# This ensures hermes-agent's web/src/ stays in sync with our standalone repo.
# Without this, `hermes update` overwrites them with upstream vanilla code.
log "Deploying web source files..."
for src_file in \
    "web/src/lib/api.ts" \
    "web/src/App.tsx" \
    "web/src/pages/ChatPage.tsx" \
    "web/src/pages/AgentsPage.tsx" \
    "web/src/pages/StatusPage.tsx" \
    "web/src/pages/ConfigPage.tsx" \
    "web/src/pages/EnvPage.tsx" \
    "web/src/pages/SessionsPage.tsx" \
    "web/src/pages/LogsPage.tsx" \
    "web/src/pages/AnalyticsPage.tsx" \
    "web/src/pages/CronPage.tsx" \
    "web/src/pages/SkillsPage.tsx" \
    "web/src/components/Markdown.tsx" \
    "web/src/components/Toast.tsx" \
    "web/src/hooks/useToast.ts" \
    "web/src/main.tsx" \
    "web/src/index.css" \
    "web/vite.config.ts" \
    "web/tsconfig.app.json" \
    "web/tsconfig.json" \
    "web/tsconfig.node.json" \
    "web/eslint.config.js" \
    "web/index.html" \
    "web/package.json" \
; do
    src_path="$SOURCE_DIR/$src_file"
    dst_path="$TARGET_DIR/$src_file"
    if [[ -f "$src_path" ]]; then
        mkdir -p "$(dirname "$dst_path")"
        cp -p "$src_path" "$dst_path"
    fi
done

# Copy UI components
if [[ -d "$SOURCE_DIR/web/src/components/ui" ]]; then
    mkdir -p "$TARGET_DIR/web/src/components/ui"
    cp -rp "$SOURCE_DIR/web/src/components/ui/"* "$TARGET_DIR/web/src/components/ui/" 2>/dev/null || true
fi

# Copy i18n files if they exist
if [[ -d "$SOURCE_DIR/web/src/i18n" ]]; then
    mkdir -p "$TARGET_DIR/web/src/i18n"
    cp -rp "$SOURCE_DIR/web/src/i18n/"* "$TARGET_DIR/web/src/i18n/" 2>/dev/null || true
fi

# Copy public assets
if [[ -d "$SOURCE_DIR/web/public" ]]; then
    mkdir -p "$TARGET_DIR/web/public"
    cp -rp "$SOURCE_DIR/web/public/"* "$TARGET_DIR/web/public/" 2>/dev/null || true
fi

# --- Verify deployment ---
log "Verifying deployment..."
COMPILES=$(python3 -c "import py_compile; py_compile.compile('$TARGET_DIR/hermes_cli/web_server.py', doraise=True)" 2>&1 && echo "OK" || echo "FAIL")
if [[ "$COMPILES" == *"FAIL"* ]]; then
    die "Deployed web_server.py has syntax errors! Restoring backup..."
    [[ -n "$BACKUP_DIR" && -f "$BACKUP_DIR/web_server.py" ]] && cp -p "$BACKUP_DIR/web_server.py" "$TARGET_DIR/hermes_cli/web_server.py"
    exit 1
fi

HAS_TG_AUTH=$(grep -c "X-Telegram-Init-Data" "$TARGET_DIR/hermes_cli/web_dist/assets/"*.js 2>/dev/null || echo "0")
if [[ "$HAS_TG_AUTH" == "0" ]]; then
    die "Deployed frontend is missing Telegram auth headers!"
fi

# --- Git protection ---
cd "$TARGET_DIR"
git update-index --assume-unchanged hermes_cli/web_server.py 2>/dev/null || true

log "Deployment complete."
echo ""

if [[ "$INSTALL_HOOK" == "true" ]]; then
    log "post-merge hook installed — mini app will auto-redeploy after 'hermes update'"
    echo ""
fi

warn "NOTE: You must restart the web server for changes to take effect."
warn "  kill \$(pgrep -f 'web_server.*start_server.*9119')"
warn "  cd $TARGET_DIR && source venv/bin/activate"
warn "  nohup python -B -c \"from hermes_cli.web_server import start_server; start_server('127.0.0.1', 9119, False)\" > /tmp/hermes-dashboard.log 2>&1 &"
