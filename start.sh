#!/bin/bash
# Alex 智能营销顾问 — 一键启动脚本
cd "$(dirname "$0")"
echo ""
echo "  正在安装依赖..."
npm install --silent
echo "  启动服务器..."
echo ""
node server.js
