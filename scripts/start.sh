#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Carvis 一键启动脚本
# 启动顺序: messagebus → agentruntime → electron
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/scripts/.pids"
LOG_DIR="$PROJECT_DIR/scripts/logs"

# 默认端口
MESSAGEBUS_PORT="${CARVIS_MESSAGEBUS_PORT:-45931}"
ELECTRON_BIN="$PROJECT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

# -----------------------------------------------------------
# 清理函数
# -----------------------------------------------------------
cleanup_pids() {
    rm -rf "$PID_DIR"
}

# -----------------------------------------------------------
# 检查是否已在运行
# -----------------------------------------------------------
check_running() {
    if ls "$PID_DIR"/*.pid 2>/dev/null | grep -q .; then
        echo ""
        log_warn "Carvis 似乎已在运行。如果确定没有运行，请先执行: ./scripts/stop.sh"
        echo ""
        read -r -p "是否仍要继续启动? (y/N): " answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            exit 0
        fi
        cleanup_pids
    fi
}

# -----------------------------------------------------------
# 构建项目
# -----------------------------------------------------------
build_project() {
    log_step "构建项目..."
    cd "$PROJECT_DIR"
    npm run build 2>&1 | tail -3
    log_info "构建完成 ✓"
}

# -----------------------------------------------------------
# 加载 API Keys (从 keys.txt)
# -----------------------------------------------------------
load_keys() {
    if [ -f "$PROJECT_DIR/keys.txt" ]; then
        log_info "从 keys.txt 加载 API Keys ..."
        while IFS='=' read -r key value; do
            # 跳过空行和注释
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
    log_step "启动 Message Bus (端口: $MESSAGEBUS_PORT)..."
    CARVIS_MESSAGEBUS_PORT="$MESSAGEBUS_PORT" \
        node "$PROJECT_DIR/dist/messagebus/main.js" \
        > "$LOG_DIR/messagebus.log" 2>&1 &
    local pid=$!
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
    log_step "启动 Agent Runtime..."
    CARVIS_MESSAGEBUS_PORT="$MESSAGEBUS_PORT" \
    CARVIS_AGENTRUNTIME_REAL_PROVIDERS="${CARVIS_AGENTRUNTIME_REAL_PROVIDERS:-1}" \
    CARVIS_PROVIDER_MODE="${CARVIS_PROVIDER_MODE:-all-deepseek}" \
    CARVIS_SPEED_MODE="${CARVIS_SPEED_MODE:-auto}" \
    CARVIS_REAL_PROVIDER_MAX_ATTEMPTS="${CARVIS_REAL_PROVIDER_MAX_ATTEMPTS:-2}" \
    CARVIS_REAL_PROVIDER_MAX_BUDGET_USD="${CARVIS_REAL_PROVIDER_MAX_BUDGET_USD:-0.20}" \
    CARVIS_CLAUDE_CODE_BIN="${CARVIS_CLAUDE_CODE_BIN:-}" \
    CARVIS_CLAUDE_CODE_USE_SDK="${CARVIS_CLAUDE_CODE_USE_SDK:-1}" \
    CARVIS_CLAUDE_CODE_SDK_FALLBACK="${CARVIS_CLAUDE_CODE_SDK_FALLBACK:-1}" \
    ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}" \
    ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN:-$DEEPSEEK_API_KEY}" \
    DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
    CARVIS_DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
    CARVIS_DEEPSEEK_OPENAI_BASE_URL="${CARVIS_DEEPSEEK_OPENAI_BASE_URL:-https://api.deepseek.com}" \
    CARVIS_DEEPSEEK_RESEARCHER_MODEL="${CARVIS_DEEPSEEK_RESEARCHER_MODEL:-deepseek-chat}" \
    DASHSCOPE_API_KEY="$DASHSCOPE_API_KEY" \
    QWEN_API_KEY="$DASHSCOPE_API_KEY" \
    QWEN_OPENAI_BASE_URL="${QWEN_OPENAI_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}" \
    QWEN_OMNI_MODEL="${QWEN_OMNI_MODEL:-qwen3.5-omni-plus}" \
    QWEN_RESEARCHER_MODEL="${QWEN_RESEARCHER_MODEL:-qwen-plus}" \
    CARVIS_QWEN_IMAGE_CONCURRENCY="${CARVIS_QWEN_IMAGE_CONCURRENCY:-1}" \
    CARVIS_QWEN_RESEARCHER_SEARCH="${CARVIS_QWEN_RESEARCHER_SEARCH:-0}" \
    CARVIS_SCRAPLING_SEARCH="${CARVIS_SCRAPLING_SEARCH:-0}" \
        node "$PROJECT_DIR/dist/agentruntime/main.js" \
        > "$LOG_DIR/agentruntime.log" 2>&1 &
    local pid=$!
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
    log_step "启动 Electron 前端..."
    CARVIS_MESSAGEBUS_PORT="$MESSAGEBUS_PORT" \
    CARVIS_ELECTRON_BIN="$ELECTRON_BIN" \
        node "$PROJECT_DIR/dist/electron/runBrowserMain.js" \
        > "$LOG_DIR/electron.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_DIR/electron.pid"
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log_info "Electron 前端已启动 (PID: $pid) ✓"
    else
        log_error "Electron 启动失败，查看日志: $LOG_DIR/electron.log"
        # Electron 可能快速退出(前台进程)，实际窗口已打开
        log_warn "Electron 进程可能已转入后台，请检查是否有窗口打开"
    fi
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
    build_project
    load_keys
    start_messagebus
    start_agentruntime
    start_electron

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅  Carvis 启动完成！             ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Message Bus:   PID $(cat "$PID_DIR/messagebus.pid")${NC}"
    echo -e "${GREEN}║  Agent Runtime: PID $(cat "$PID_DIR/agentruntime.pid")${NC}"
    echo -e "${GREEN}║  Electron:      PID $(cat "$PID_DIR/electron.pid")${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  停止: ./scripts/stop.sh${NC}"
    echo -e "${GREEN}║  日志: scripts/logs/${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""
}

main
