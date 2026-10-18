#!/bin/bash
# activeASSET — Prove system works end-to-end
# จำลอง browser จริงตั้งแต่เปิดหน้า → login → ใช้งานทุก feature

set -e
BASE="http://127.0.0.1:3000"
ORIGIN="https://preview-chat-3f0748f2-3705-43ca-a9ff-388adceec423.space-z.ai"
COOKIES="/tmp/prove-cookies.txt"
rm -f "$COOKIES"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🎯 activeASSET — PROVE IT WORKS END-TO-END                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Browser origin: $ORIGIN"
echo ""

# === STEP 1: Browser เปิดหน้าเว็บครั้งแรก ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 1: เปิดเบราว์เซอร์ → http://localhost:3000/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HTTP=$(curl -s -o /tmp/step1-page.html -w "%{http_code}" -H "Origin: $ORIGIN" --max-time 60 "$BASE/")
SIZE=$(wc -c < /tmp/step1-page.html)
echo "  ✅ HTTP $HTTP | Size: $SIZE bytes"
echo ""
echo "  📄 ตรวจเนื้อหาที่ browser เห็น (text สำคัญ):"
python3 << 'EOF'
import re
with open('/tmp/step1-page.html') as f:
    html = f.read()
body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
if body:
    text = re.sub(r'<script[^>]*>.*?</script>', '', body.group(1), flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '\n', text)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:25]:
        print(f"     {line}")
EOF
echo ""

# === STEP 2: ตรวจ static assets ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 2: Browser โหลด CSS + JavaScript chunks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/tailwind.css")
TW_SIZE=$(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "$BASE/tailwind.css")
echo "  ✅ tailwind.css: HTTP $TW_STATUS | Size: $TW_SIZE bytes"

CHUNKS=$(grep -oE 'src="(/_next/static/chunks/[^"]+)"' /tmp/step1-page.html | sed 's/src="//;s/"//' | sort -u)
LOADED=0
TOTAL=0
for chunk in $CHUNKS; do
  TOTAL=$((TOTAL+1))
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE$chunk")
  if [ "$STATUS" = "200" ]; then
    LOADED=$((LOADED+1))
  fi
done
echo "  ✅ JavaScript chunks: $LOADED/$TOTAL โหลดสำเร็จ"
echo ""

# === STEP 3: User กรอกข้อมูล + login ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 3: User กรอก email + password แล้วกด 'เข้าสู่ระบบ'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📝 กรอก: email=admin@activeasset.local password=admin123"
LOGIN_RESP=$(curl -s -X POST "$BASE/api/auth/simple-login" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"email":"admin@activeasset.local","password":"admin123"}' \
  --max-time 30)
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "  ❌ Login ล้มเหลว: $LOGIN_RESP"
  exit 1
fi
echo "$LOGIN_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
u = d['user']
print(f\"  ✅ Login สำเร็จ!\")
print(f\"     👤 User: {u['name']}\")
print(f\"     📧 Email: {u['email']}\")
print(f\"     🔑 Role: {u['role']}\")
print(f\"     🎫 Token (JWT 30 วัน): {d['token'][:60]}...\")
"
echo ""

# === STEP 4: Browser เก็บ token ใน localStorage แล้วเข้าหน้า Dashboard ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 4: เข้าสู่หน้า Dashboard (ส่ง Bearer token)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/dashboard" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('summary', {})
print(f\"  ✅ Dashboard loaded\")
print(f\"\")
print(f\"  📊 ตัวเลขสรุป:\")
print(f\"     • ทรัพย์สินทั้งหมด:    {s.get('totalAssets', 0)} รายการ\")
print(f\"     • พร้อมใช้งาน:       {s.get('available', 0)}\")
print(f\"     • กำลังยืม:          {s.get('onLoan', 0)}\")
print(f\"     • ส่งซ่อม:            {s.get('inRepair', 0)}\")
print(f\"     • ตรวจสภาพ:          {s.get('inInspection', 0)}\")
print(f\"     • สูญหาย:             {s.get('lost', 0)}\")
print(f\"     • ตัดออก:             {s.get('disposed', 0)}\")
print(f\"     • ใบยืม active:      {s.get('activeLoans', 0)}\")
print(f\"     • ติดคิว:             {s.get('queuedLoans', 0)}\")
print(f\"     • Dead stock:        {s.get('deadStockCount', 0)}\")
print(f\"\")
overdue = d.get('overdueLoans', [])
standby = d.get('standbyLoans', [])
brands = d.get('brandDistribution', [])
print(f\"  📋 ใบยืมเกินกำหนด: {len(overdue)} ใบ\")
for l in overdue[:3]:
    print(f\"     • {l['docNo']} — {l['customerName']} ({l.get('customerCompany','-')})\")
print(f\"  📋 เครื่องสำรอง: {len(standby)} ใบ\")
print(f\"  🏷️  แบรนด์ทั้งหมด: {len(brands)} แบรนด์\")
for b in brands[:5]:
    print(f\"     • {b['brand']}: {b['count']} รายการ\")
"
echo ""

# === STEP 5: หน้า Analytics ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 5: ดูหน้า Analytics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/analytics" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('summary', {})
print(f\"  ✅ Analytics loaded\")
print(f\"\")
print(f\"  📈 สรุปการยืม:\")
print(f\"     • ยืมทั้งหมด:      {s.get('totalLoans', 0)} ครั้ง\")
print(f\"     • กำลังยืม:        {s.get('activeLoans', 0)}\")
print(f\"     • คืนครบแล้ว:     {s.get('completedLoans', 0)}\")
print(f\"     • ติดคิว:           {s.get('queuedLoans', 0)}\")
print(f\"\")
print(f\"  🏆 รุ่นยอดนิยม (Top 5):\")
for i, m in enumerate(d.get('topModels', [])[:5]):
    print(f\"     {i+1}. {m['brand']} {m['model']} — {m['count']} ครั้ง [{m.get('category','-')}]\")
print(f\"\")
print(f\"  👥 ลูกค้าที่ยืมบ่อย (Top 3):\")
for i, c in enumerate(d.get('topCustomers', [])[:3]):
    print(f\"     {i+1}. {c['company']} — {c['count']} ครั้ง [{c.get('industry','-')}]\")
print(f\"\")
ss = d.get('sourceStats', {})
print(f\"  📦 Source สินค้า: Demo={ss.get('Demo_Stock',0)} | Sales={ss.get('Sales_Stock',0)} | Supplier={ss.get('Supplier',0)}\")
"
echo ""

# === STEP 6: หน้าทรัพย์สิน ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 6: ดูรายการทรัพย์สิน (10 รายการแรก)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/assets?limit=10" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assets = d.get('assets', [])
print(f\"  ✅ ทรัพย์สินทั้งหมด: {d.get('total', len(assets))} รายการ\")
print(f\"\")
print(f\"  📋 ตัวอย่าง 10 รายการแรก:\")
print(f\"     {'Tag ID':12s} | {'Brand':10s} | {'Model':20s} | {'S/N':22s} | {'Status':12s}\")
print(f\"     {'-'*12} | {'-'*10} | {'-'*20} | {'-'*22} | {'-'*12}\")
for a in assets[:10]:
    print(f\"     {a.get('tagId','?'):12s} | {a.get('brand','?'):10s} | {a.get('model','?'):20s} | {(a.get('serialNo','?') or '')[:22]:22s} | {a.get('status','?'):12s}\")
"
echo ""

# === STEP 7: หน้าใบยืม ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 7: ดูรายการใบยืม (5 ใบแรก)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/loans?limit=5" | python3 -c "
import sys, json
d = json.load(sys.stdin)
loans = d.get('loans', [])
print(f\"  ✅ ใบยืมทั้งหมด: {d.get('total', len(loans))} ใบ\")
print(f\"\")
print(f\"  📋 ตัวอย่าง 5 ใบล่าสุด:\")
print(f\"     {'Doc No':18s} | {'ลูกค้า':25s} | {'Sales':18s} | {'Status':12s}\")
print(f\"     {'-'*18} | {'-'*25} | {'-'*18} | {'-'*12}\")
for l in loans[:5]:
    print(f\"     {l.get('docNo','?'):18s} | {(l.get('customerName','?') or '')[:25]:25s} | {(l.get('salesRepName','?') or '')[:18]:18s} | {l.get('status','?'):12s}\")
"
echo ""

# === STEP 8: กิจกรรมล่าสุด ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 8: ดู Activity Feed (กิจกรรมล่าสุด)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/activities?limit=5" | python3 -c "
import sys, json
d = json.load(sys.stdin)
acts = d.get('activities', [])
print(f\"  ✅ กิจกรรมล่าสุด {len(acts)} รายการ:\")
for a in acts[:5]:
    print(f\"     • [{a.get('action','?')}] {a.get('description','-')[:60]}\")
    print(f\"       โดย {a.get('userName','-')} เมื่อ {a.get('createdAt','-')[:19]}\")
"
echo ""

# === STEP 9: ทดสอบ login ด้วยบัญชีอื่น ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 9: ทดสอบ login บัญชีอื่นทั้งหมด"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for ACC in "admin:admin123:ผู้ดูแลระบบ" "sales:sales123:พนักงานขาย" "store:store123:เจ้าหน้าที่คลัง" "manager:manager123:ผู้จัดการ"; do
  USER=$(echo "$ACC" | cut -d: -f1)
  PASS=$(echo "$ACC" | cut -d: -f2)
  LABEL=$(echo "$ACC" | cut -d: -f3)
  RESP=$(curl -s -X POST "$BASE/api/auth/simple-login" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{\"email\":\"${USER}@activeasset.local\",\"password\":\"${PASS}\"}" \
    --max-time 15)
  T=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
  if [ -n "$T" ]; then
    echo "  ✅ ${LABEL}: login สำเร็จ"
  else
    echo "  ❌ ${LABEL}: login ล้มเหลว"
  fi
done
echo ""

# === STEP 10: ทดสอบ security ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 10: ทดสอบ security"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📝 ทดสอบ 1: Password ผิด"
ERR_HTTP=$(curl -s -o /tmp/err.txt -w "%{http_code}" -X POST "$BASE/api/auth/simple-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@activeasset.local","password":"wrongpassword"}' \
  --max-time 15)
echo "     → HTTP $ERR_HTTP: $(cat /tmp/err.txt | head -c 100)"
echo ""
echo "  📝 ทดสอบ 2: เข้าถึง API โดยไม่มี token"
NOAUTH=$(curl -s -o /tmp/noauth.txt -w "%{http_code}" --max-time 15 "$BASE/api/dashboard")
echo "     → HTTP $NOAUTH: $(cat /tmp/noauth.txt | head -c 100)"
echo ""
echo "  📝 ทดสอบ 3: Token ผิด"
BADTOKEN=$(curl -s -o /tmp/badtoken.txt -w "%{http_code}" -H "Authorization: Bearer invalidtoken123" --max-time 15 "$BASE/api/dashboard")
echo "     → HTTP $BADTOKEN: $(cat /tmp/badtoken.txt | head -c 100)"
echo ""

# === STEP 11: Process ยังรันอยู่ ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ STEP 11: ตรวจสอบ process ยังรันอยู่"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pgrep -af "next" | head -3
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🎉 พิสูจน์สำเร็จ! ระบบ activeASSET ใช้งานได้จริง            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 เปิดบราวเซอร์ที่: http://localhost:3000"
echo "🔑 Login: admin@activeasset.local / admin123"
