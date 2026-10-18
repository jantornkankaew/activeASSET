#!/bin/bash
# activeASSET — Persistent production server launcher
# ทำงานราวกับ systemd service: รันเป็น daemon แท้จริง, ไม่ตายเมื่อ parent ตาย

cd /home/z/my-project

# ปิด process เก่า
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
sleep 2

# ตรวจสอบว่า build มีอยู่จริง — ถ้าไม่มี ให้ build ใหม่อัตโนมัติ
if [ ! -f ".next/standalone/server.js" ]; then
  echo "Production build not found. Building..."
  bun run build
  if [ $? -ne 0 ]; then
    echo "Build failed — aborting"
    exit 1
  fi
fi

# เริ่ม production server ด้วยการ double-fork (POSIX daemon pattern)
(
  exec 0<&-
  exec 1>&-
  exec 2>&-

  setsid bash -c '
    cd /home/z/my-project
    exec bun .next/standalone/server.js > /home/z/my-project/prod.log 2>&1
  ' &
) 2>/dev/null

# detach
disown -a 2>/dev/null

echo "Started production server (PID=$!)"
echo "  → Listening on http://localhost:3000"
echo "  → Log file: /home/z/my-project/prod.log"
exit 0
