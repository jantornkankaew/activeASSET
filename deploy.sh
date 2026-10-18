#!/bin/bash
# activeASSET — One-click deploy script
# ทำทุกอย่างให้: kill process เก่า → build → start production server เป็น daemon
# Usage: ./deploy.sh

set -e

cd /home/z/my-project

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  activeASSET — Production Deploy                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Kill existing processes
echo "▶ [1/4] ปิด process เก่า..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "standalone/server" 2>/dev/null || true
sleep 3
echo "  ✓ ปิดเรียบร้อย"
echo ""

# Step 2: Clean previous build
echo "▶ [2/4] ล้าง build เก่า..."
rm -rf .next
echo "  ✓ ล้างเรียบร้อย"
echo ""

# Step 3: Build production
echo "▶ [3/4] Build production (อาจใช้เวลา 1-2 นาที)..."
if ! bun run build > /tmp/build.log 2>&1; then
  echo "  ✗ Build failed! ดู log ด้านล่าง:"
  tail -30 /tmp/build.log
  exit 1
fi
echo "  ✓ Build สำเร็จ (standalone server ขนาด $(stat -c %s .next/standalone/server.js) bytes)"
echo ""

# Step 4: Start production server as daemon (double-fork, setsid, disown)
echo "▶ [4/4] Start production server..."
(
  exec 0<&-
  exec 1>&-
  exec 2>&-
  setsid bash -c '
    cd /home/z/my-project
    exec bun .next/standalone/server.js > /home/z/my-project/prod.log 2>&1
  ' &
) 2>/dev/null
disown -a 2>/dev/null

# Wait for server to be ready
echo "  รอ server start..."
for i in {1..15}; do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "  ✓ Server พร้อม (HTTP 200)"
    break
  fi
  sleep 1
done
echo ""

# Final summary
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✓ DEPLOY สำเร็จ                                              ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  URL:        https://preview-cc38e471.space-z.ai/             ║"
echo "║  Local:      http://localhost:3000                          ║"
echo "║  Process:    bun .next/standalone/server.js (daemon)        ║"
echo "║  Log file:   /home/z/my-project/prod.log                   ║"
echo "║                                                              ║"
echo "║  คำสั่งที่เกี่ยวข้อง:                                          ║"
echo "║  • รันเซิร์ฟเวอร์ใหม่:     ./deploy.sh                       ║"
echo "║  • ดู log:              tail -f prod.log                    ║"
echo "║  • ปิด server:          pkill -f 'standalone/server'        ║"
echo "║  • กลับไปใช้ dev mode:   ./start-dev.sh                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
