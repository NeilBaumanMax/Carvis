#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Carvis 停止脚本
# 停止所有 Carvis 组件
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/scripts/.pids"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

killed_count=0

# -----------------------------------------------------------
# 优雅停止一个 PID
# -----------------------------------------------------------
kill_pid() {
    local pid="$1"
    local name="$2"

    if kill -0 "$pid" 2>/dev/null; then
        # 先发 SIGTERM，等待 3 秒
        kill "$pid" 2>/dev/null || true
        for i in $(seq 1 30); do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.1
        done
        # 还没退出就强杀
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
            log_warn "$name (PID: $pid) 强制终止"
        else
            log_info "$name (PID: $pid) 已停止 ✓"
        fi
        killed_count=$((killed_count + 1))
    else
        log_warn "$name (PID: $pid) 进程已不存在"
    fi
}

# -----------------------------------------------------------
# 通过 PID 文件停止
# -----------------------------------------------------------
stop_by_pidfiles() {
    if ls "$PID_DIR"/*.pid 2>/dev/null | grep -q .; then
        for pidfile in "$PID_DIR"/*.pid; do
            local name
            name=$(basename "$pidfile" .pid)
            local pid
            pid=$(cat "$pidfile" 2>/dev/null || true)
            if [ -n "$pid" ]; then
                kill_pid "$pid" "$name"
            fi
        done
        rm -rf "$PID_DIR"
    else
        log_warn "未找到 PID 文件，尝试通过进程名查找..."
    fi
}

# -----------------------------------------------------------
# 通过进程名强制清理（兜底）
# -----------------------------------------------------------
force_cleanup() {
    log_info "清理残余 Carvis 进程..."
    # 查找并杀掉所有 carvis 相关的 node 进程
    local pids
    pids=$(ps aux | grep -E 'dist/(messagebus|agentruntime|electron)/' | grep -v grep | awk '{print $2}')
    if [ -n "$pids" ]; then
        for pid in $pids; do
            kill_pid "$pid" "carvis-residual"
        done
    fi

    # 也杀掉可能的 Electron 进程
    pids=$(ps aux | grep -i 'Electron.*carvis' | grep -v grep | awk '{print $2}')
    if [ -n "$pids" ]; then
        for pid in $pids; do
            kill_pid "$pid" "electron-residual"
        done
    fi
}

# -----------------------------------------------------------
# 主流程
# -----------------------------------------------------------
main() {
    echo ""
    echo -e "${RED}╔══════════════════════════════════════╗${NC}"
    echo -e "${RED}║      🛑  Carvis 停止              ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════╝${NC}"
    echo ""

    stop_by_pidfiles
    force_cleanup

    echo ""
    if [ "$killed_count" -gt 0 ]; then
        echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║   ✅  已停止 $killed_count 个 Carvis 进程    ${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}  未发现运行中的 Carvis 进程${NC}"
    fi
    echo ""
}

main
