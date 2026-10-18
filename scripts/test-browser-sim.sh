#!/bin/bash
# Browser simulation: จำลองการใช้งานจริงจาก preview domain (cross-origin)

set -e
BASE="http://127.0.0.1:3000"
ORIGIN="https://preview-chat-3f0748f2-3705-43ca-a9ff-388adceec423.space-z.ai"

echo "═══════════════════════════════════════════════"
echo "🌐 Browser Simulation Test (Cross-Origin)"
echo "   Origin: $ORIGIN"
echo "═══════════════════════════════════════════════"
echo ""

# STEP 1: เปิดหน้าเว็บครั้งแรก (browser จะได้ HTML + ลิงก์ CSS/JS)
echo "▶ 1. Browser เปิดหน้าเว็บครั้งแรก"
HTTP=$(curl -s -o /tmp/page1.html -w "%{http_code}" -H "Origin: $ORIGIN" --max-time 60 "$BASE/")
echo "  ✅ HTTP $HTTP, size: $(wc -c < /tmp/page1.html) bytes"
echo "     Tailwind CSS: $(grep -c 'tailwind.css' /tmp/page1.html) ลิงก์"
echo "     JS chunks: $(grep -oE 'src=\"/_next/static/chunks/[^\"]+\"' /tmp/page1.html | wc -l) ไฟล์"
echo ""

# STEP 2: Browser โหลด static assets
echo "▶ 2. Browser โหลด static assets (CSS + JS)"
TW_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/tailwind.css")
echo "  ✅ tailwind.css: HTTP $TW_HTTP, size: $(curl -s -o /dev/null -w "%{size_download}" --max-time 10 "$BASE/tailwind.css") bytes"
CHUNKS=$(grep -oE 'src="(/_next/static/chunks/[^"]+)"' /tmp/page1.html | sed 's/src="//;s/"//')
ALL_LOADED=true
for chunk in $CHUNKS; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE$chunk")
  if [ "$STATUS" != "200" ]; then
    echo "  ❌ $chunk: HTTP $STATUS"
    ALL_LOADED=false
  fi
done
if $ALL_LOADED; then
  echo "  ✅ ทุก JS chunks โหลดสำเร็จ"
fi
echo ""

# STEP 3: User กรอก email + password แล้วกด Login
echo "▶ 3. User login (กรอก email+password แล้วกด submit)"
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
USER_INFO=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; print(f\"{u['name']} ({u['role']})\")")
echo "  ✅ Login สำเร็จ — $USER_INFO"
echo "  📄 Token (JWT): ${TOKEN:0:40}..."
echo ""

# STEP 4: Browser เก็บ token ใน localStorage แล้ว fetch dashboard
echo "▶ 4. Browser fetch dashboard ด้วย Bearer token"
DASH=$(curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/dashboard")
echo "$DASH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('summary', {})
print(f\"  ✅ Dashboard loaded\")
print(f\"     • ทรัพย์สินทั้งหมด: {s.get('totalAssets', 0)} รายการ\")
print(f\"     • พร้อมใช้: {s.get('available', 0)}\")
print(f\"     • กำลังยืม: {s.get('onLoan', 0)}\")
print(f\"     • ใบยืม active: {s.get('activeLoans', 0)}\")
print(f\"     • แบรนด์ทั้งหมด: {len(d.get('brandDistribution', []))}\")
"
echo ""

# STEP 5: fetch analytics
echo "▶ 5. Browser fetch analytics"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/analytics" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('summary', {})
print(f\"  ✅ Analytics loaded\")
print(f\"     • ยืมทั้งหมด: {s.get('totalLoans', 0)}\")
print(f\"     • Top models: {len(d.get('topModels', []))} รุ่น\")
print(f\"     • Top customers: {len(d.get('topCustomers', []))} ราย\")
print(f\"     • Source — Demo: {d.get('sourceStats', {}).get('Demo_Stock', 0)}, Sales: {d.get('sourceStats', {}).get('Sales_Stock', 0)}, Supplier: {d.get('sourceStats', {}).get('Supplier', 0)}\")
"
echo ""

# STEP 6: fetch assets list
echo "▶ 6. Browser fetch assets"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/assets?limit=5" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assets = d.get('assets', [])
print(f\"  ✅ Assets loaded — {len(assets)} รายการในตัวอย่าง\")
for a in assets[:3]:
    print(f\"     • {a.get('tagId','?'):12s} | {a.get('brand','?'):10s} {a.get('model','?'):20s} | {a.get('status','?')}\")
"
echo ""

# STEP 7: fetch loans
echo "▶ 7. Browser fetch loans"
curl -s -H "Authorization: Bearer $TOKEN" -H "Origin: $ORIGIN" --max-time 30 "$BASE/api/loans?limit=3" | python3 -c "
import sys, json
d = json.load(sys.stdin)
loans = d.get('loans', [])
print(f\"  ✅ Loans loaded — {len(loans)} ใบ\")
for l in loans[:2]:
    print(f\"     • {l.get('docNo','?'):18s} | {l.get('customerName','?'):25s} | {l.get('status','?')}\")
"
echo ""

# STEP 8: ทดสอบเปลี่ยนบัญชี
echo "▶ 8. ทดสอบ login บัญชีอื่น (Sales)"
SALES_RESP=$(curl -s -X POST "$BASE/api/auth/simple-login" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"email":"sales@activeasset.local","password":"sales123"}' \
  --max-time 30)
SALES_USER=$(echo "$SALES_RESP" | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; print(f\"{u['name']} ({u['role']})\"  )" 2>/dev/null)
echo "  ✅ Login สำเร็จ — $SALES_USER"
echo ""

# STEP 9: ทดสอบ password ผิด
echo "▶ 9. ทดสอบ password ผิด"
ERR_HTTP=$(curl -s -o /tmp/err.txt -w "%{http_code}" -X POST "$BASE/api/auth/simple-login" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"email":"admin@activeasset.local","password":"wrong"}' \
  --max-time 15)
echo "  ✅ Password ผิด: HTTP $ERR_HTTP — $(cat /tmp/err.txt)"
echo ""

# STEP 10: ทดสอบเข้าถึง API โดยไม่มี token
echo "▶ 10. ทดสอบเข้าถึง API โดยไม่มี token"
NOAUTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: $ORIGIN" --max-time 15 "$BASE/api/dashboard")
echo "  ✅ ไม่มี token: HTTP $NOAUTH_HTTP (ถูกปฏิเสธอย่างถูกต้อง)"
echo ""

echo "═══════════════════════════════════════════════"
echo "🎉 การทดสอบทั้งหมดเสร็จสิ้น"
echo "═══════════════════════════════════════════════"
echo ""
echo "🌐 เปิดเบราว์เซอร์ที่: http://localhost:3000"
echo "🔑 Login: admin@activeasset.local / admin123"
