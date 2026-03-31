#!/usr/bin/env bash

set -e

OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.json"
OPENCODE_PACKAGE_FILE="$OPENCODE_CONFIG_DIR/package.json"
AGENT_SETTINGS_FILE="$HOME/.agent/settings.json"

# ─── Helper ───────────────────────────────────────────────────────────────────

print_step() { echo ""; echo "==> $1"; }
print_ok()   { echo "    [ok] $1"; }
print_skip() { echo "    [skip] $1"; }

# ─── 1. Node.js ───────────────────────────────────────────────────────────────

print_step "Checking Node.js..."

if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  print_ok "Node.js already installed ($NODE_VERSION)"
else
  echo "    Node.js not found. Installing..."
  if command -v brew &>/dev/null; then
    brew install node
  elif command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y nodejs
  else
    echo "ERROR: Could not install Node.js automatically."
    echo "       Please install Node.js v18+ from https://nodejs.org and re-run this script."
    exit 1
  fi
  print_ok "Node.js installed ($(node --version))"
fi

# ─── 2. jq ────────────────────────────────────────────────────────────────────

print_step "Checking jq..."

if command -v jq &>/dev/null; then
  print_ok "jq already installed"
else
  echo "    jq not found. Installing..."
  if command -v brew &>/dev/null; then
    brew install jq
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y jq
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y jq
  else
    echo "ERROR: Could not install jq automatically."
    echo "       Please install jq from https://jqlang.github.io/jq/ and re-run this script."
    exit 1
  fi
  print_ok "jq installed"
fi

# ─── 3. OpenCode ──────────────────────────────────────────────────────────────

print_step "Checking OpenCode..."

if command -v opencode &>/dev/null; then
  print_ok "OpenCode already installed"
else
  echo "    OpenCode not found. Installing..."
  if command -v brew &>/dev/null; then
    brew install anomalyco/tap/opencode
  elif command -v npm &>/dev/null; then
    npm install -g opencode-ai
  else
    echo "    Trying install script..."
    curl -fsSL https://opencode.ai/install | bash
  fi
  print_ok "OpenCode installed"
fi

# ─── 4. JIRA skill npm dependencies ───────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_step "Installing JIRA skill npm dependencies..."

if [ -f "$SCRIPT_DIR/package.json" ]; then
  npm install --prefix "$SCRIPT_DIR" --silent
  print_ok "Dependencies installed"
else
  print_skip "No package.json found in $SCRIPT_DIR"
fi

# ─── 5. Collect JIRA credentials ──────────────────────────────────────────────

print_step "JIRA Configuration"

echo ""
echo "Enter your JIRA instance URL (e.g. https://jira.example.com):"
read -r JIRA_URL
if [ -z "$JIRA_URL" ]; then
  echo "ERROR: JIRA URL cannot be empty."
  exit 1
fi

echo "Enter your JIRA email address:"
read -r JIRA_EMAIL
if [ -z "$JIRA_EMAIL" ]; then
  echo "ERROR: JIRA email cannot be empty."
  exit 1
fi

echo "Enter your JIRA Personal Access Token:"
read -rs JIRA_TOKEN
echo ""
if [ -z "$JIRA_TOKEN" ]; then
  echo "ERROR: JIRA token cannot be empty."
  exit 1
fi

echo "Are you using a Personal Access Token (Server/DC)? [Y/n]:"
read -r USE_PAT_INPUT
USE_PAT_INPUT="${USE_PAT_INPUT:-Y}"
if [[ "$USE_PAT_INPUT" =~ ^[Yy] ]]; then
  JIRA_USE_PAT="true"
else
  JIRA_USE_PAT="false"
fi

# ─── 6. Write ~/.agent/settings.json ──────────────────────────────────────────

print_step "Writing ~/.agent/settings.json..."

mkdir -p "$(dirname "$AGENT_SETTINGS_FILE")"

if [ ! -f "$AGENT_SETTINGS_FILE" ]; then
  echo '{}' > "$AGENT_SETTINGS_FILE"
fi

jq \
  --arg url   "$JIRA_URL" \
  --arg email "$JIRA_EMAIL" \
  --arg token "$JIRA_TOKEN" \
  --arg pat   "$JIRA_USE_PAT" \
  '
    .env.JIRA_URL     = $url   |
    .env.JIRA_EMAIL   = $email |
    .env.JIRA_TOKEN   = $token |
    .env.JIRA_USE_PAT = $pat
  ' "$AGENT_SETTINGS_FILE" > "$AGENT_SETTINGS_FILE.tmp"

mv "$AGENT_SETTINGS_FILE.tmp" "$AGENT_SETTINGS_FILE"
print_ok "Written to $AGENT_SETTINGS_FILE"

# ─── 7. Configure OpenCode (PNNL provider) ────────────────────────────────────

print_step "Configuring OpenCode PNNL provider..."

echo "Enter your PNNL API Key:"
read -rs API_KEY
echo ""
if [ -z "$API_KEY" ]; then
  echo "ERROR: PNNL API key cannot be empty."
  exit 1
fi

mkdir -p "$OPENCODE_CONFIG_DIR"

if [ ! -f "$OPENCODE_CONFIG_FILE" ]; then
  echo '{}' > "$OPENCODE_CONFIG_FILE"
fi

jq --arg apiKey "$API_KEY" '
  .provider.pnnl = {
    npm: "@ai-sdk/openai-compatible",
    name: "PNNL AI Incubator",
    options: {
      baseURL: "https://ai-incubator-api.pnnl.gov",
      apiKey: $apiKey
    },
    models: {
      "gpt-5-birthright": {},
      "gpt-5.1-birthright": {},
      "gpt-5.2-birthright": {},
      "gpt-5.4-birthright": {},
      "gpt-4.1-birthright": {},
      "o3-birthright": {},
      "o4-mini-birthright": {},
      "grok-4-birthright": {},
      "grok-4-fast-non-reasoning-birthright": {},
      "grok-4-fast-reasoning-birthright": {},
      "claude-sonnet-4-6-birthright": {},
      "claude-sonnet-4-5-20250929-v1-birthright": {},
      "claude-sonnet-4-20250514-v1-birthright": {},
      "claude-haiku-4-5-20251001-v1-birthright": {}
    }
  }
  | .model = "pnnl/gpt-5.4-birthright"
' "$OPENCODE_CONFIG_FILE" > "$OPENCODE_CONFIG_FILE.tmp"

mv "$OPENCODE_CONFIG_FILE.tmp" "$OPENCODE_CONFIG_FILE"
print_ok "OpenCode configured at $OPENCODE_CONFIG_FILE"

if [ ! -f "$OPENCODE_PACKAGE_FILE" ]; then
  printf '{\n  "type": "module"\n}\n' > "$OPENCODE_PACKAGE_FILE"
else
  jq '.type = "module"' "$OPENCODE_PACKAGE_FILE" > "$OPENCODE_PACKAGE_FILE.tmp"
  mv "$OPENCODE_PACKAGE_FILE.tmp" "$OPENCODE_PACKAGE_FILE"
fi
print_ok "ESM package boundary set at $OPENCODE_PACKAGE_FILE"

# ─── 8. Test JIRA connection ──────────────────────────────────────────────────

print_step "Testing JIRA connection..."

if node "$SCRIPT_DIR/scripts/test-connection.js" 2>&1; then
  print_ok "JIRA connection successful"
else
  echo "    WARNING: JIRA connection test failed. Check your URL, email, and token."
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "Setup complete."
echo ""
echo "  JIRA settings : $AGENT_SETTINGS_FILE"
echo "  OpenCode config: $OPENCODE_CONFIG_FILE"
echo ""
echo "Run 'opencode' to start."
