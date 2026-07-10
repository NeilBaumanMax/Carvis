#!/usr/bin/env bash

# ============================================================
# Carvis 一键启动脚本
# 启动顺序: messagebus → agentruntime → electron
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/scripts/.pids"
LOG_DIR="$PROJECT_DIR/scripts/logs"

MESSAGEBUS_PORT="${CARVIS_MESSAGEBUS_PORT:-45931}"
ELECTRON_BIN="$PROJECT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

# -----------------------------------------------------------
# No-op cleanup - don't delete PIDs on start
# -----------------------------------------------------------
cleanup_pids() {
    rm -rf "$PID_DIR"
}

# -----------------------------------------------------------
# 5.1 Check if a process is already running by port or ps
# -----------------------------------------------------------
is_messagebus_alive() {
    lsof -iTCP:"$MESSAGEBUS_PORT" -sTCP:LISTEN -t >/dev/null 2>&1
}

is_agentruntime_alive() {
    pgrep -f "dist/agentruntime/main.js" >/dev/null 2>&1
}

is_electron_alive() {
    pgrep -f "Electron.*carvis" >/dev/null 2>&1
}

# -----------------------------------------------------------
# 检查是否已在运行 (actual process check, not just PID files)
# -----------------------------------------------------------
check_running() {
    local already=""
    is_messagebus_alive && already="$already messagebus"
    is_agentruntime_alive && already="$already agentruntime"
    is_electron_alive && already="$already electron"

    if [ -n "$already" ]; then
        echo ""
        log_warn "已有组件在运行:$already"
        echo ""
        read -r -p "是否仍要继续启动? (y/N): " answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
    # Always clean stale PID dir on fresh start
    cleanup_pids
}

# -----------------------------------------------------------
# 构建项目 (只在 dist 过期时)
# -----------------------------------------------------------
build_if_needed() {
    if [ ! -d "$PROJECT_DIR/dist" ] || [ "$PROJECT_DIR/package.json" -nt "$PROJECT_DIR/dist" ]; then
        log_step "构建项目..."
        cd "$PROJECT_DIR"
        npm run build 2>&1 | tail -3
        log_info "构建完成 ✓"
    else
        log_info "dist 已是最新，跳过构建 ✓"
    fi
}

# -----------------------------------------------------------
# 加载 API Keys (从 keys.txt)
# -----------------------------------------------------------
load_keys() {
    if [ -f "$PROJECT_DIR/keys.txt" ]; then
        log_info "从 keys.txt 加载 API Keys ..."
        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            export "$key"="$value"
        done < "$PROJECT_DIR/keys.txt"
    else
        log_warn "keys.txt 未找到，使用已有的环境变量"
    fi
}

# -----------------------------------------------------------
# 启动 Message Bus
# -----------------------------------------------------------
start_messagebus() {
    if is_messagebus_alive; then
        log_info "Message Bus 已在运行，跳过 ✓"
        return 0
    fi
    log_step "启动 Message Bus (端口: $MESSAGEBUS_PORT)..."
    nohup node "$PROJECT_DIR/dist/messagebus/main.js" \
        > "$LOG_DIR/messagebus.log" 2>&1 &
    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" > "$PID_DIR/messagebus.pid"
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
        log_info "Message Bus 已启动 (PID: $pid) ✓"
    else
        log_error "Message Bus 启动失败，查看日志: $LOG_DIR/messagebus.log"
        exit 1
    fi
}

# -----------------------------------------------------------
# 启动 Agent Runtime
# -----------------------------------------------------------
start_agentruntime() {
    if is_agentruntime_alive; then
        log_info "Agent Runtime 已在运行，跳过 ✓"
        return 0
    fi
    log_step "启动 Agent Runtime..."
    nohup node "$PROJECT_DIR/dist/agentruntime/main.js" \
        > "$LOG_DIR/agentruntime.log" 2>&1 &
    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" > "$PID_DIR/agentruntime.pid"
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        log_info "Agent Runtime 已启动 (PID: $pid) ✓"
    else
        log_error "Agent Runtime 启动失败，查看日志: $LOG_DIR/agentruntime.log"
        exit 1
    fi
}

# -----------------------------------------------------------
# 启动 Electron 前端
# -----------------------------------------------------------
start_electron() {
    if is_electron_alive; then
        log_info "Electron 已在运行，跳过 ✓"
        return 0
    fi
    log_step "启动 Electron 前端..."
    # Electron needs CARVIS_MESSAGEBUS_PORT to connect
    nohup node "$PROJECT_DIR/dist/electron/runBrowserMain.js" \
        > "$LOG_DIR/electron.log" 2>&1 &
    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" > "$PID_DIR/electron.pid"
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log_info "Electron 前端已启动 (PID: $pid) ✓"
    else
        # Electron spawns child processes and the launcher may exit quickly
        log_warn "Electron 启动进程已退出，检查是否有窗口打开..."
        log_warn "查看日志: $LOG_DIR/electron.log"
    fi
}

# -----------------------------------------------------------
# 注入环境变量 (需要在启动 agentruntime 前设置)
# -----------------------------------------------------------
setup_env() {
    export CARVIS_MESSAGEBUS_PORT="$MESSAGEBUS_PORT"
    export CARVIS_ELECTRON_BIN="$ELECTRON_BIN"
    export CARVIS_AGENTRUNTIME_REAL_PROVIDERS="${CARVIS_AGENTRUNTIME_REAL_PROVIDERS:-1}"
    export CARVIS_PROVIDER_MODE="${CARVIS_PROVIDER_MODE:-all-deepseek}"
    export CARVIS_SPEED_MODE="${CARVIS_SPEED_MODE:-auto}"
    export CARVIS_REAL_PROVIDER_MAX_ATTEMPTS="${CARVIS_REAL_PROVIDER_MAX_ATTEMPTS:-2}"
    export CARVIS_REAL_PROVIDER_MAX_BUDGET_USD="${CARVIS_REAL_PROVIDER_MAX_BUDGET_USD:-0.20}"
    export CARVIS_CLAUDE_CODE_USE_SDK="${CARVIS_CLAUDE_CODE_USE_SDK:-1}"
    export CARVIS_CLAUDE_CODE_SDK_FALLBACK="${CARVIS_CLAUDE_CODE_SDK_FALLBACK:-1}"
    export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}"
    export CARVIS_DEEPSEEK_OPENAI_BASE_URL="${CARVIS_DEEPSEEK_OPENAI_BASE_URL:-https://api.deepseek.com}"
    export CARVIS_DEEPSEEK_RESEARCHER_MODEL="${CARVIS_DEEPSEEK_RESEARCHER_MODEL:-deepseek-chat}"
    export QWEN_OPENAI_BASE_URL="${QWEN_OPENAI_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}"
    export QWEN_OMNI_MODEL="${QWEN_OMNI_MODEL:-qwen3.5-omni-plus}"
    export QWEN_RESEARCHER_MODEL="${QWEN_RESEARCHER_MODEL:-qwen-plus}"
    export CARVIS_QWEN_IMAGE_CONCURRENCY="${CARVIS_QWEN_IMAGE_CONCURRENCY:-1}"
    export CARVIS_QWEN_RESEARCHER_SEARCH="${CARVIS_QWEN_RESEARCHER_SEARCH:-0}"
    export CARVIS_SCRAPLING_SEARCH="${CARVIS_SCRAPLING_SEARCH:-0}"
    # API keys from keys.txt
    [ -n "${DEEPSEEK_API_KEY:-}" ] && export ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY"
    [ -n "${DEEPSEEK_API_KEY:-}" ] && export CARVIS_DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY"
    [ -n "${DASHSCOPE_API_KEY:-}" ] && export QWEN_API_KEY="$DASHSCOPE_API_KEY"
}

# -----------------------------------------------------------
# 主流程
# -----------------------------------------------------------
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║      🚀  Carvis 一键启动            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
    echo ""

    mkdir -p "$PID_DIR" "$LOG_DIR"

    check_running
    load_keys
    setup_env
    build_if_needed
    start_messagebus
    start_agentruntime
    start_electron

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅  Carvis 启动完成！             ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    [ -f "$PID_DIR/messagebus.pid" ] && echo -e "${GREEN}║  Message Bus:   PID $(cat "$PID_DIR/messagebus.pid")${NC}"
    [ -f "$PID_DIR/agentruntime.pid" ] && echo -e "${GREEN}║  Agent Runtime: PID $(cat "$PID_DIR/agentruntime.pid")${NC}"
    [ -f "$PID_DIR/electron.pid" ] && echo -e "${GREEN}║  Electron:      PID $(cat "$PID_DIR/electron.pid")${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  停止: ./scripts/stop.sh${NC}"
    echo -e "${GREEN}║  日志: scripts/logs/${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""
}

main
