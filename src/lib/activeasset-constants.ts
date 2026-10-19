// ค่าคงที่และ label ภาษาไทยสำหรับ activeASSET

export const VZ = {
  primary: '#405189',
  teal: '#0ab39c',
  amber: '#f7b84b',
  rose: '#f06548',
  purple: '#a071f0',
  slate: '#74788d',
}

export const ASSET_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Available: { label: 'พร้อมใช้', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  On_Loan: { label: 'กำลังยืม', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  In_Inspection: { label: 'ตรวจสภาพ', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  In_Repair: { label: 'ส่งซ่อม', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  Lost: { label: 'สูญหาย', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  Disposed: { label: 'ตัดจำหน่าย', color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' },
  Reserved: { label: 'จองแล้ว', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  Returned_To_Supplier: { label: 'คืน Supplier แล้ว', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300' },
}

// 3-phase loan statuses
export const LOAN_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; phase: number }> = {
  Requested: { label: 'รอจัด', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', phase: 1 },
  Dispatching: { label: 'กำลังจัด', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', phase: 2 },
  Dispatched: { label: 'รอส่งมอบ', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', phase: 2 },
  Delivered: { label: 'กำลังยืม', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', phase: 3 },
  Partially_Returned: { label: 'คืนบางส่วน', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', phase: 3 },
  Returned: { label: 'คืนครบแล้ว', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200', phase: 3 },
  Queued: { label: 'ติดคิว', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', phase: 0 },
  Cancelled: { label: 'ยกเลิก', color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200', phase: -1 },
}

export const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Demo_Stock: { label: 'คลังเดโม', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  Sales_Stock: { label: 'คลังขาย', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  Supplier: { label: 'ยืมจาก Supplier', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
}

export const INDUSTRY_LABELS: Record<string, string> = {
  Logistics: 'โลจิสติกส์',
  Retail: 'ค้าปลีก',
  Garment: 'การ์เมนต์',
  Healthcare: 'การแพทย์',
  Manufacturing: 'การผลิต',
  Other: 'อื่นๆ',
}

export const PURPOSE_LABELS: Record<string, string> = {
  Demo: 'เดโมให้ลูกค้า',
  Standby_Repair: 'เครื่องสำรองระหว่างซ่อม',
  Internal_Test: 'ทดสอบภายใน',
  POC: 'POC (ทดสอบระบบ)',
}

export const GRADE_LABELS: Record<string, { label: string; description: string; color: string; bg: string }> = {
  A: { label: 'A', description: 'สมบูรณ์ 100% ไร้รอยขีดข่วน', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  B: { label: 'B', description: 'สภาพดี มีรอยตามการใช้งานปกติ', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
  C: { label: 'C', description: 'มีรอยกระแทก/ถลอก แต่ใช้งานได้', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300' },
  D: { label: 'D', description: 'ชำรุด จอแตก หัวพิมพ์ขาด ฯลฯ', color: 'text-rose-700', bg: 'bg-rose-100 border-rose-300' },
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  Company_Asset: 'ทรัพย์สินบริษัท',
  Vendor_Demo: 'เครื่องเดโมจากผู้จำหน่าย',
}

export const CATEGORY_LABELS: Record<string, string> = {
  'Mobile Computer': 'คอมพิวเตอร์เคลื่อนที่',
  'Barcode Scanner': 'สแกนเนอร์บาร์โค้ด',
  'Barcode Printer': 'เครื่องพิมพ์บาร์โค้ด',
  'RFID Reader': 'เครื่องอ่าน RFID',
  'Tablet': 'แท็บเล็ต',
}

// ฟังก์ชัน helper แปลงสถานะเป็น label
export function getAssetStatusLabel(status: string) {
  return ASSET_STATUS_LABELS[status] ?? { label: status, color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' }
}

export function getLoanStatusLabel(status: string) {
  return LOAN_STATUS_LABELS[status] ?? { label: status, color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' }
}

export function getPurposeLabel(purpose: string) {
  return PURPOSE_LABELS[purpose] ?? purpose
}

// แปลง ISO date เป็น พ.ศ. ไทย
export function formatThaiDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatThaiDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
