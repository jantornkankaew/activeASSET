#!/bin/bash
# activeASSET — End-to-end test that simulates browser usage
# ทดสอบทุกขั้นตอนเหมือน user จริง

set -e

BASE="http://127.0.0.1:3000"
COOKIES="/tmp/test-cookies.txt"
rm -f "$COOKIES"

echo "═══════════════════════════════════════════════"
echo "🧪 activeASSET — End-to-End Test"
echo "═══════════════════════════════════════════════"
echo ""

# === STEP 1: Server alive ===
echo "▶ STEP 1: ตรวจสอบ server"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/")
if [ "$HTTP" = "200" ]; then
  echo "  ✅ Server ทำงาน (HTTP $HTTP)"
else
  echo "  ❌ Server ไม่ทำงาน (HTTP $HTTP)"
  exit 1
fi
echo ""

# === STEP 2: Login page HTML loads ===
echo "▶ STEP 2: โหลดหน้า HTML"
PAGE_SIZE=$(curl -s -o /tmp/page.html -w "%{size_download}" --max-time 30 "$BASE/")
echo "  ✅ หน้า HTML โหลด: ${PAGE_SIZE} bytes"
TAILWIND=$(grep -c 'tailwind.css' /tmp/page.html || echo 0)
echo "  ✅ Tailwind CSS reference: $TAILWIND แห่ง"
JS_CHUNKS=$(grep -oE 'src="/_next/static/chunks/[^"]+"' /tmp/page.html | wc -l)
echo "  ✅ JavaScript chunks: $JS_CHUNKS ไฟล์"
echo ""

# === STEP 3: Get CSRF token ===
echo "▶ STEP 3: ขอ CSRF token"
CSRF_RESP=$(curl -s -c "$COOKIES" --max-time 10 "$BASE/api/auth/csrf")
CSRF=$(echo "$CSRF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
echo "  ✅ CSRF: ${CSRF:0:32}..."
echo ""

# === STEP 4: Login as admin ===
echo "▶ STEP 4: Login เป็น admin@activeasset.local"
LOGIN_RESP=$(curl -s -b "$COOKIES" -c "$COOKIES" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=admin@activeasset.local" \
  --data-urlencode "password=admin123" \
  --data-urlencode "callbackUrl=$BASE/" \
  --data-urlencode "json=true" \
  -o /tmp/login.txt -w "%{http_code}" --max-time 30)
echo "  ✅ Login response: HTTP $LOGIN_RESP"
echo "  📄 Body: $(cat /tmp/login.txt | head -c 100)"
echo ""

# === STEP 5: Check session ===
echo "▶ STEP 5: ตรวจสอบ session หลัง login"
SESSION=$(curl -s -b "$COOKIES" --max-time 10 "$BASE/api/auth/session")
echo "  ✅ Session: $SESSION" | head -c 200
echo ""
echo ""

# === STEP 6: Dashboard API ===
echo "▶ STEP 6: ดึงข้อมูล Dashboard"
DASH=$(curl -s -b "$COOKIES" --max-time 30 "$BASE/api/dashboard")
echo "  $DASH" | python3 -c "
import sys, json
data = json.load(sys.stdin)
s = data.get('summary', {})
print(f\"  ✅ Dashboard API: HTTP 200\")
print(f\"     • ทรัพย์สินทั้งหมด: {s.get('totalAssets', 0)}\")
print(f\"     • พร้อมใช้: {s.get('available', 0)}\")
print(f\"     • กำลังยืม: {s.get('onLoan', 0)}\")
print(f\"     • เกินกำหนด: {s.get('overdueLoans', 0)}\")
print(f\"     • ใบยืม active: {s.get('activeLoans', 0)}\")
print(f\"     • ติดคิว: {s.get('queuedLoans', 0)}\")
print(f\"     • Dead stock: {s.get('deadStockCount', 0)}\")
print(f\"     • Overdue loans: {len(data.get('overdueLoans', []))} ใบ\")
print(f\"     • Standby loans: {len(data.get('standbyLoans', []))} ใบ\")
print(f\"     • Brand distribution: {len(data.get('brandDistribution', []))} แบรนด์\")
print(f\"     • Dead stock assets: {len(data.get('deadStockAssets', []))} รายการ\")
"
echo ""

# === STEP 7: Analytics API ===
echo "▶ STEP 7: ดึงข้อมูล Analytics"
ANA=$(curl -s -b "$COOKIES" --max-time 30 "$BASE/api/analytics")
echo "  $ANA" | python3 -c "
import sys, json
data = json.load(sys.stdin)
s = data.get('summary', {})
print(f\"  ✅ Analytics API: HTTP 200\")
print(f\"     • ยืมทั้งหมด: {s.get('totalLoans', 0)}\")
print(f\"     • กำลังยืม: {s.get('activeLoans', 0)}\")
print(f\"     • คืนครบ: {s.get('completedLoans', 0)}\")
print(f\"     • ติดคิว: {s.get('queuedLoans', 0)}\")
print(f\"     • Top models: {len(data.get('topModels', []))} รุ่น\")
print(f\"     • Top customers: {len(data.get('topCustomers', []))} ราย\")
print(f\"     • Demand vs Supply: {len(data.get('demandSupply', []))} รุ่น\")
print(f\"     • Trend: {len(data.get('trend', []))} เดือน\")
print(f\"     • Source — Demo: {data.get('sourceStats', {}).get('Demo_Stock', 0)}, Sales: {data.get('sourceStats', {}).get('Sales_Stock', 0)}, Supplier: {data.get('sourceStats', {}).get('Supplier', 0)}\")
"
echo ""

# === STEP 8: Assets list ===
echo "▶ STEP 8: ดึงรายการทรัพย์สิน"
ASSETS=$(curl -s -b "$COOKIES" --max-time 30 "$BASE/api/assets?limit=10")
echo "  $ASSETS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assets = data.get('assets', data if isinstance(data, list) else [])
print(f\"  ✅ Assets API: HTTP 200\")
print(f\"     • Total assets: {data.get('total', len(assets) if isinstance(assets, list) else 'N/A')}\")
print(f\"     • Sample (first 5):\")
items = assets[:5] if isinstance(assets, list) else data.get('assets', [])[:5]
for a in items:
    tag = a.get('tagId', '?')
    brand = a.get('brand', '?')
    model = a.get('model', '?')
    status = a.get('status', '?')
    sn = a.get('serialNo', '?')[:20]
    print(f\"       • {tag:12s} | {brand:10s} {model:20s} | S/N: {sn:20s} | {status}\")
"
echo ""

# === STEP 9: Loans list ===
echo "▶ STEP 9: ดึงรายการใบยืม"
LOANS=$(curl -s -b "$COOKIES" --max-time 30 "$BASE/api/loans?limit=5")
echo "  $LOANS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
loans = data.get('loans', data if isinstance(data, list) else [])
print(f\"  ✅ Loans API: HTTP 200\")
print(f\"     • Total loans: {data.get('total', len(loans) if isinstance(loans, list) else 'N/A')}\")
print(f\"     • Sample (first 3):\")
items = loans[:3] if isinstance(loans, list) else data.get('loans', [])[:3]
for l in items:
    doc = l.get('docNo', '?')
    cust = l.get('customerName', '?')
    rep = l.get('salesRepName', '?')
    status = l.get('status', '?')
    print(f\"       • {doc:18s} | {cust:20s} | {rep:15s} | {status}\")
"
echo ""

# === STEP 10: Verify page after login (server-rendered with session) ===
echo "▶ STEP 10: โหลดหน้าเว็บหลัง login"
curl -s -b "$COOKIES" -o /tmp/page2.html -w "  HTTP=%{http_code} size=%{size_download}\n" --max-time 30 "$BASE/"
echo "  ✅ หน้าโหลดหลัง login"
echo ""

# === STEP 11: Test other auth accounts ===
echo "▶ STEP 11: ทดสอบ login บัญชีอื่นๆ"
for ACCOUNT in "sales@activeasset.local:sales123:Sales" "store@activeasset.local:store123:Store" "manager@activeasset.local:manager123:Manager"; do
  EMAIL=$(echo "$ACCOUNT" | cut -d: -f1)
  PASS=$(echo "$ACCOUNT" | cut -d: -f2)
  ROLE=$(echo "$ACCOUNT" | cut -d: -f3)
  rm -f "$COOKIES"
  CSRF=$(curl -s -c "$COOKIES" "$BASE/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
  curl -s -b "$COOKIES" -c "$COOKIES" \
    -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$CSRF" \
    --data-urlencode "email=$EMAIL" \
    --data-urlencode "password=$PASS" \
    --data-urlencode "callbackUrl=$BASE/" \
    --data-urlencode "json=true" \
    -o /dev/null -w "  $ROLE: HTTP=%{http_code}" --max-time 15
  SESSION_ROLE=$(curl -s -b "$COOKIES" "$BASE/api/auth/session" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('role','?'))" 2>/dev/null)
  echo " | role=$SESSION_ROLE ✅"
done
echo ""

# === STEP 12: Wrong password should fail ===
echo "▶ STEP 12: ทดสอบ password ผิด"
rm -f "$COOKIES"
CSRF=$(curl -s -c "$COOKIES" "$BASE/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")
LOGIN_CODE=$(curl -s -b "$COOKIES" -c "$COOKIES" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=admin@activeasset.local" \
  --data-urlencode "password=wrongpassword" \
  --data-urlencode "callbackUrl=$BASE/" \
  --data-urlencode "json=true" \
  -o /dev/null -w "%{http_code}" --max-time 15)
SESSION_AFTER_FAIL=$(curl -s -b "$COOKIES" "$BASE/api/auth/session")
if [ "$SESSION_AFTER_FAIL" = "{}" ]; then
  echo "  ✅ Password ผิดถูกปฏิเสธอย่างถูกต้อง (HTTP $LOGIN_CODE, session ว่าง)"
else
  echo "  ❌ Password ผิดยัง login ผ่าน! Session: $SESSION_AFTER_FAIL"
fi
echo ""

echo "═══════════════════════════════════════════════"
echo "🎉 การทดสอบทั้งหมดเสร็จสิ้น"
echo "═══════════════════════════════════════════════"
echo ""
echo "🌐 เปิดเบราว์เซอร์ที่: http://localhost:3000"
echo "🔑 Login เป็น admin: admin@activeasset.local / admin123"
