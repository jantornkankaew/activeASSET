#!/bin/bash
# activeASSET — Persistent dev server launcher
# ทำงานราวกับ systemd service: รันเป็น daemon แท้จริง, ไม่ตายเมื่อ parent ตาย

cd /home/z/my-project

# ปิด process เก่า
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 2

# ล้าง cache
rm -rf .next

# เริ่ม dev server ด้วยการ double-fork (POSIX daemon pattern)
# ใช้ setsid เพื่อ detach จาก controlling terminal
# และปิด stdin/stdout/stderr เพื่อไม่ให้ bash รอ

(
  # ปิด file descriptors
  exec 0<&-
  exec 1>&-
  exec 2>&-

  # สร้าง session ใหม่
  setsid bash -c '
    cd /home/z/my-project
    # ใช้ exec เพื่อ replace shell ด้วย node (เพื่อลด process layers)
    exec ./node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1
  ' &
) 2>/dev/null

# detach
disown -a 2>/dev/null

echo "Started dev server (PID=$!)"
exit 0
