#!/bin/bash
# 游戏大厅（浏览器版）一键启动器
#   行为：探测端口 → 未启动则后台启动静态服务器 → 已启动则跳过 → 自动打开浏览器
#   用法：双击运行（macOS），或直接 ./start-browser-hall.command
#   可覆盖的环境变量：
#     GAME_HUB_BROWSER_ROOT  已组装的大厅目录（默认 $HOME/WorkBuddy/game_hub_browser）
#     GAME_HUB_SERVE_JS      静态服务器脚本（默认 $GAME_HUB_BROWSER_ROOT/serve.js）
#     PORT                   监听端口（默认 4180）
#     NODE_BIN               node 可执行文件（默认自动探测）

set -u

PORT="${PORT:-4180}"
URL="http://localhost:${PORT}/"
HALL_ROOT="${GAME_HUB_BROWSER_ROOT:-$HOME/WorkBuddy/game_hub_browser}"
SERVE_JS="${GAME_HUB_SERVE_JS:-$HALL_ROOT/serve.js}"

# --- 1) 解析 node ---
if [ -z "${NODE_BIN:-}" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [ -x "$HOME/.workbuddy/binaries/node/versions/22.22.2-6/bin/node" ]; then
    NODE_BIN="$HOME/.workbuddy/binaries/node/versions/22.22.2-6/bin/node"
  fi
fi
if [ -z "${NODE_BIN:-}" ]; then
  echo "错误：未找到 node，请安装 Node.js 18+，或用 NODE_BIN 指定路径。"
  exit 1
fi

# --- 2) 探活 ---
# 注意：必须 --noproxy '*'，否则 HTTP_PROXY 环境变量会让 curl 把 127.0.0.1 也发给代理，
# 代理返回 502 时 curl 退出码仍为 0，会被误判为"大厅已在运行"。故同时校验 HTTP 状态码。
alive() {
  local code
  code=$(curl -s -o /dev/null --noproxy '*' --max-time 2 -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null)
  [ "$code" = "200" ]
}

if alive; then
  echo "游戏大厅已在运行（端口 ${PORT}），直接打开浏览器。"
else
  echo "游戏大厅未运行，正在启动..."
  if [ ! -f "$SERVE_JS" ]; then
    echo "错误：找不到服务器脚本 $SERVE_JS"
    echo "提示：用 GAME_HUB_BROWSER_ROOT 指向已组装的大厅目录（该目录应含 serve.js 与 index.html）。"
    exit 1
  fi
  # nohup 使进程在终端关闭后继续存活
  nohup "$NODE_BIN" "$SERVE_JS" >/dev/null 2>&1 &
  for _ in $(seq 1 30); do
    if alive; then
      echo "启动完成。"
      break
    fi
    sleep 0.5
  done
  if ! alive; then
    echo "错误：端口 ${PORT} 在 15 秒内未就绪。"
    echo "手动排查：$NODE_BIN $SERVE_JS"
    exit 1
  fi
fi

# --- 3) 打开浏览器 ---
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
else
  echo "请手动在浏览器打开：$URL"
fi
