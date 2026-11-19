const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { verifySmtpCredentials, sendSmtpEmail } = require('./lib/smtp.js');
const { dispatchEmail, verifyApiKey } = require('./lib/email_service.js');
const { generateLoanPdf } = require('./lib/pdf.js');

const PORT = process.env.PORT || 3020;

// Persistent storage configuration (supports Railway persistent volume mounted at /data)
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || (fs.existsSync('/data') ? '/data' : null);
const DATA_DIR = PERSISTENT_DIR ? path.join(PERSISTENT_DIR, 'data') : path.join(__dirname, 'data');
const UPLOADS_DIR = PERSISTENT_DIR ? path.join(PERSISTENT_DIR, 'uploads') : path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'activeasset_v2.db');

// If running with a persistent volume, check if DB is missing or corrupted and initialize from bundled template
const bundledDbPath = path.join(__dirname, 'data', 'activeasset_v2.db');
if (PERSISTENT_DIR) {
  let needCopy = !fs.existsSync(dbPath);
  if (!needCopy) {
    try {
      const testDb = new DatabaseSync(dbPath);
      const res = testDb.prepare('PRAGMA quick_check').get();
      testDb.close();
      if (!res || res.quick_check !== 'ok') {
        console.warn('[Storage] Existing DB corrupted, resetting to fresh template...');
        needCopy = true;
      }
    } catch (e) {
      console.warn('[Storage] Existing DB cannot be opened:', e.message);
      needCopy = true;
    }
  }

  if (needCopy && fs.existsSync(bundledDbPath)) {
    console.log(`[Storage] Initializing persistent database from bundled template to ${dbPath}...`);
    try {
      fs.copyFileSync(bundledDbPath, dbPath);
      try { fs.unlinkSync(`${dbPath}-wal`); } catch (_) {}
      try { fs.unlinkSync(`${dbPath}-shm`); } catch (_) {}
    } catch (err) {
      console.warn('[Storage] Failed to copy baseline DB:', err);
    }
  }

  // Sync bundled uploads into persistent UPLOADS_DIR if missing
  try {
    const bundledUploads = path.join(__dirname, 'uploads');
    if (fs.existsSync(bundledUploads) && path.resolve(UPLOADS_DIR) !== path.resolve(bundledUploads)) {
      const bundledFiles = fs.readdirSync(bundledUploads);
      for (const f of bundledFiles) {
        const src = path.join(bundledUploads, f);
        const dst = path.join(UPLOADS_DIR, f);
        if (fs.statSync(src).isFile() && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
          console.log(`[Storage] Synced bundled upload ${f} to persistent uploads`);
        }
      }
    }
  } catch (err) {
    console.warn('[Storage] Failed to sync bundled uploads:', err);
  }
}

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    tag_id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    model TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    category TEXT DEFAULT '',
    serial_no TEXT DEFAULT '',
    source TEXT DEFAULT 'Demo', -- 'Demo' | 'Supplier' | 'คลังขาย'
    location TEXT DEFAULT 'Main Stock (ตู้โชว์/คลังกลาง)',
    accessories_json TEXT DEFAULT '[]',
    free_note TEXT DEFAULT '',
    status TEXT DEFAULT 'Available', -- 'Available' | 'On_Loan' | 'Issue'
    issue_note TEXT DEFAULT '',
    missing_tags_json TEXT DEFAULT '[]',
    current_loan_id TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY, -- e.g. LOAN-202610-001
    customer_name TEXT DEFAULT '',
    customer_company TEXT DEFAULT '',
    borrower_name TEXT NOT NULL, -- salesRepName
    borrower_phone TEXT DEFAULT '',
    purpose TEXT DEFAULT 'Demo',
    checkout_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT DEFAULT NULL,
    status TEXT DEFAULT 'Delivered', -- 'Requested' | 'Dispatching' | 'Dispatched' | 'Delivered' | 'Partially_Returned' | 'Returned'
    before_photos_json TEXT DEFAULT '[]',
    after_photos_json TEXT DEFAULT '[]',
    borrower_signature TEXT DEFAULT '',
    return_receiver TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS loan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    model TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    serial_no TEXT DEFAULT '',
    source_snapshot TEXT DEFAULT 'Demo',
    location_snapshot TEXT DEFAULT '',
    loan_accessories_json TEXT DEFAULT '[]',
    loan_free_note TEXT DEFAULT '',
    attachments_json TEXT DEFAULT '[]',
    returned INTEGER DEFAULT 0,
    returned_at TEXT DEFAULT NULL,
    returned_accessories_json TEXT DEFAULT '[]',
    missing_accessories_json TEXT DEFAULT '[]',
    qc_status TEXT DEFAULT NULL, -- NULL | 'Pass' | 'Fail'
    qc_note TEXT DEFAULT '',
    returned_to_location INTEGER DEFAULT 0,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    name_en TEXT DEFAULT '',
    tax_id TEXT DEFAULT '',
    source TEXT DEFAULT 'history', -- 'history' | 'dbd' | 'custom'
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  CREATE INDEX IF NOT EXISTS idx_customers_name_en ON customers(name_en);
`);

try {
  db.exec(`ALTER TABLE customers ADD COLUMN name_en TEXT DEFAULT ''`);
} catch (e) {
  // column already exists
}
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name_en ON customers(name_en)`);
} catch (e) {}

// Customer enrichment columns
try { db.exec(`ALTER TABLE customers ADD COLUMN branch TEXT DEFAULT 'สำนักงานใหญ่'`); } catch (e) {}
try { db.exec(`ALTER TABLE customers ADD COLUMN address TEXT DEFAULT ''`); } catch (e) {}
try { db.exec(`ALTER TABLE customers ADD COLUMN contact_name TEXT DEFAULT ''`); } catch (e) {}
try { db.exec(`ALTER TABLE customers ADD COLUMN phone TEXT DEFAULT ''`); } catch (e) {}
try { db.exec(`ALTER TABLE customers ADD COLUMN email TEXT DEFAULT ''`); } catch (e) {}

// Product Catalog & Master Options Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS product_catalogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    default_specs TEXT DEFAULT '',
    default_accessories TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_catalogs_model ON product_catalogs(model);
  CREATE INDEX IF NOT EXISTS idx_catalogs_brand ON product_catalogs(brand);
  CREATE INDEX IF NOT EXISTS idx_catalogs_category ON product_catalogs(category);

  CREATE TABLE IF NOT EXISTS master_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'category' | 'brand' | 'location' | 'accessory'
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(type, name)
  );
  CREATE INDEX IF NOT EXISTS idx_master_options_type ON master_options(type);
`);

try {
  db.exec(`ALTER TABLE assets ADD COLUMN image_url TEXT DEFAULT ''`);
} catch (e) {
  // column already exists
}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN images_json TEXT DEFAULT '[]'`);
} catch (e) {
  // column already exists
}

// Asset Disposition Fields & Audit Logs
try {
  db.exec(`ALTER TABLE assets ADD COLUMN disposed_at TEXT DEFAULT NULL`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN disposed_reason TEXT DEFAULT NULL`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN disposed_note TEXT DEFAULT NULL`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE assets ADD COLUMN disposed_by TEXT DEFAULT NULL`);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS asset_disposition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id TEXT NOT NULL,
      action TEXT NOT NULL, -- 'dispose' | 'reactivate'
      action_date TEXT NOT NULL,
      reason TEXT DEFAULT '',
      note TEXT DEFAULT '',
      user_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
} catch (e) {}

// Digital Signature & Timestamps for Loans
try {
  db.exec(`ALTER TABLE loans ADD COLUMN borrower_signed_at TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN dispatcher_signature TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN dispatcher_signed_at TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN receiver_signature TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN receiver_signed_at TEXT DEFAULT ''`);
} catch (e) {}

// Delivery / Handover Proof Fields (ผู้ส่ง, ผู้รับ, ถ่ายรูปส่งงาน, GPS, Timestamp)
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_sender TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_receiver TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_photos_json TEXT DEFAULT '[]'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_gps TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_timestamp TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN delivery_note TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN created_by TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN dispatcher_name TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN supplier_return_receiver TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN supplier_return_sender TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN supplier_return_timestamp TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN supplier_return_note TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN supplier_return_photos_json TEXT DEFAULT '[]'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN sale_return_sender TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN sale_return_timestamp TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN sale_return_note TEXT DEFAULT ''`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loans ADD COLUMN sale_return_action_json TEXT DEFAULT '{}'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE loan_items ADD COLUMN return_action TEXT DEFAULT ''`);
} catch (e) {}

// Users & Corporate Authentication Table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    picture TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    last_login TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);
try {
  db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
} catch (e) {}

// Deleted Users Blacklist Table (Prevents deleted users from entering or auto-recreating accounts)
db.exec(`
  CREATE TABLE IF NOT EXISTS deleted_users (
    email TEXT PRIMARY KEY,
    deleted_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

// Auto-clean & merge duplicate/erroneous model prefixes (e.g. "Honeywell Honeywell EDA52-1" -> "Honeywell EDA52-1")
try {
  db.exec(`
    UPDATE assets 
    SET model = 'EDA52-1', name = 'Honeywell EDA52-1' 
    WHERE brand = 'Honeywell' AND (model = 'Honeywell EDA52-1' OR model = 'Honeywell Honeywell EDA52-1');

    DELETE FROM product_catalogs 
    WHERE brand = 'Honeywell' AND (model = 'Honeywell EDA52-1' OR model = 'Honeywell Honeywell EDA52-1');

    UPDATE loan_items 
    SET model = 'EDA52-1' 
    WHERE brand = 'Honeywell' AND (model = 'Honeywell EDA52-1' OR model = 'Honeywell Honeywell EDA52-1');

    UPDATE assets 
    SET model = substr(model, length(brand) + 2), 
        name = brand || ' ' || substr(model, length(brand) + 2)
    WHERE model LIKE brand || ' %';

    UPDATE product_catalogs 
    SET model = substr(model, length(brand) + 2)
    WHERE model LIKE brand || ' %';
  `);
} catch (e) {
  console.error('Model merge cleanup notice:', e.message);
}

// Real-time synchronization state versioning & latest mutation tracking
let appStateVersion = Date.now();
let lastCreatedLoan = null;

function notifyStateChange(type, meta = null) {
  appStateVersion = Date.now();
  if (type === 'create_loan' && meta) {
    lastCreatedLoan = {
      id: meta.id,
      borrower_name: meta.borrower_name || '',
      customer: meta.customer || meta.customer_company || meta.customer_name || '',
      created_at: Date.now()
    };
  }
}

// Roles & Permissions Table
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_system INTEGER DEFAULT 0,
    permissions_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

const PERMISSION_KEYS = [
  { key: 'manage_settings', label: 'ตั้งค่าระบบ & ข้อมูลบริษัท', group: 'การตั้งค่าระบบ', desc: 'แก้ไขข้อมูลบริษัท, อีเมล, โดเมนองค์กร' },
  { key: 'manage_roles', label: 'จัดการบทบาท & กำหนดสิทธิ์', group: 'การตั้งค่าระบบ', desc: 'สร้าง/แก้ไข Role, ปรับสิทธิ์ on/off, เปลี่ยน Role ผู้ใช้' },
  { key: 'create_loan', label: 'ออกใบยืมสินค้า', group: 'งานเอกสารใบยืม', desc: 'สร้างเอกสารใบยืมสินค้าใหม่' },
  { key: 'edit_loan', label: 'แก้ไขใบยืมสินค้า', group: 'งานเอกสารใบยืม', desc: 'แก้ไขข้อมูลใบยืมที่ยังไม่ปิดรายการ' },
  { key: 'cancel_loan', label: 'ยกเลิกใบยืมสินค้า', group: 'งานเอกสารใบยืม', desc: 'ยกเลิกใบยืมก่อนเริ่มจัดของ' },
  { key: 'dispatch_loan', label: 'จัดของ & Match S/N', group: 'งานคลังสินค้า & ส่งมอบ', desc: 'สแกน/เลือก S/N และอุปกรณ์เสริมเพื่อจัดของ' },
  { key: 'deliver_loan', label: 'บันทึกส่งมอบสินค้า', group: 'งานคลังสินค้า & ส่งมอบ', desc: 'ส่งมอบ ถ่ายรูปหน้างาน บันทึก GPS' },
  { key: 'return_loan', label: 'ตรวจ QC & รับคืนสินค้า', group: 'งานคลังสินค้า & ส่งมอบ', desc: 'ตรวจสภาพเครื่องและอุปกรณ์เสริม นำเข้าคลัง' },
  { key: 'manage_assets', label: 'จัดการคลังเครื่อง (Add/Edit Demo)', group: 'งานคลังสินค้า & ส่งมอบ', desc: 'เพิ่มรุ่น Demo ใหม่, แก้ไขสถานที่เก็บ' },
  { key: 'delete_data', label: 'ลบข้อมูลสำคัญ', group: 'ความปลอดภัย', desc: 'ลบเครื่องออกจากคลัง หรือลบข้อมูลสำคัญ' }
];

const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'ผู้ดูแลระบบ (Admin)',
    description: 'สามารถกำหนดค่าข้อมูล แก้ไข ลบข้อมูล และจัดการสิทธิ์ผู้ใช้งานได้เต็มรูปแบบ',
    is_system: 1,
    permissions: Object.fromEntries(PERMISSION_KEYS.map(p => [p.key, true]))
  },
  {
    id: 'user',
    name: 'ผู้ใช้งานทั่วไป (User)',
    description: 'มีหน้าที่ใช้งานระบบตามปกติ ออกใบยืม จัดของ ส่งมอบ และรับคืนได้ (ไม่สามารถแก้ไขตั้งค่าระบบหรือลบข้อมูลได้)',
    is_system: 1,
    permissions: {
      manage_settings: false,
      manage_roles: false,
      create_loan: true,
      edit_loan: true,
      cancel_loan: false,
      dispatch_loan: true,
      deliver_loan: true,
      return_loan: true,
      manage_assets: false,
      delete_data: false
    }
  }
];

const roleCount = db.prepare('SELECT COUNT(*) as cnt FROM roles').get();
if (roleCount.cnt === 0) {
  const insertRole = db.prepare(`
    INSERT INTO roles (id, name, description, is_system, permissions_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const r of DEFAULT_ROLES) {
    insertRole.run(r.id, r.name, r.description, r.is_system, JSON.stringify(r.permissions));
  }
}

// Migrate existing user roles to valid role IDs
try {
  db.prepare("UPDATE users SET role = 'admin' WHERE role IN ('Administrator', 'Sales Admin', 'admin')").run();
  db.prepare("UPDATE users SET role = 'user' WHERE role NOT IN ('admin')").run();
} catch (_) {}

function getAllRoles() {
  const roles = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name ASC').all();
  const userCounts = db.prepare('SELECT role, COUNT(*) as cnt FROM users GROUP BY role').all();
  const countMap = new Map(userCounts.map(u => [u.role, u.cnt]));

  return roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    is_system: r.is_system === 1,
    permissions: JSON.parse(r.permissions_json || '{}'),
    user_count: countMap.get(r.id) || 0,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
}

function getRoleById(roleId) {
  const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    is_system: r.is_system === 1,
    permissions: JSON.parse(r.permissions_json || '{}'),
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function getUserWithRole(email) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return null;
  let role = getRoleById(user.role);
  if (!role) {
    role = getRoleById('user') || {
      id: 'user',
      name: 'ผู้ใช้งานทั่วไป (User)',
      permissions: {}
    };
  }
  return {
    email: user.email,
    name: user.name,
    role_id: role.id,
    role_name: role.name,
    status: user.status || 'active',
    picture: user.picture || '',
    domain: user.domain || '',
    permissions: role.permissions,
    last_login: user.last_login
  };
}

const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const insertUser = db.prepare('INSERT OR REPLACE INTO users (email, name, role, domain) VALUES (?, ?, ?, ?)');
  insertUser.run('admin@active5.co.th', 'ผู้ดูแลระบบ (Admin)', 'admin', 'active5.co.th');
  insertUser.run('jantorn@active5.co.th', 'จันทร ก้านแก้ว', 'admin', 'active5.co.th');
  insertUser.run('sirikanya@active5.co.th', 'สิริกัลยา ก้านแก้ว', 'user', 'active5.co.th');
  insertUser.run('nanthida@active5.co.th', 'นันทิดา โชคชัย', 'user', 'active5.co.th');
  insertUser.run('somying@active5.co.th', 'สมหญิง มั่นคง', 'user', 'active5.co.th');
  insertUser.run('warehouse@active5.co.th', 'พนักงานคลังสินค้า & QC', 'user', 'active5.co.th');
  insertUser.run('logistics@active5.co.th', 'พนักงานส่งมอบสินค้า', 'user', 'active5.co.th');
}

// Company / Issuer Settings
db.exec(`
  CREATE TABLE IF NOT EXISTS company_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
`);

const DEFAULT_COMPANY_SETTINGS = {
  company_name: 'บริษัท ไอคอนเน็กท์ จำกัด',
  company_name_en: 'ICONNECT CO., LTD.',
  company_tax_id: '0105553012345',
  company_branch: 'สำนักงานใหญ่',
  company_address: '88/19 ถนนพัฒนาการ แขวงสวนหลวง เขตสวนหลวง กรุงเทพมหานคร 10250',
  company_phone: '02-722-8888, 081-999-8888',
  company_email: 'sales@iconnect.co.th',
  company_website: 'www.iconnect.co.th',
  company_logo: '',
  dispatcher_signature: '',
  gatepass_terms: '* ผู้ยืมตกลงดูแลรักษาเครื่องและอุปกรณ์เสริมทั้งหมดให้อยู่ในสภาพสมบูรณ์ และนำส่งคืนภายในวันที่กำหนด',
  email_provider: 'resend',
  email_api_key: '',
  email_from_address: 'a5@active5.co.th',
  email_from_name: 'บริษัท แอคทีฟ 5 จำกัด',
  smtp_host: 'smtp.gmail.com',
  smtp_port: '465',
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: 'บริษัท แอคทีฟ 5 จำกัด',
  smtp_from_email: '',
  auth_require_login: '1',
  auth_allowed_domains: 'active5.co.th',
  auth_google_client_id: ''
};

const countSettings = db.prepare('SELECT COUNT(*) as cnt FROM company_settings').get();
if (countSettings.cnt === 0) {
  const insertSetting = db.prepare('INSERT OR REPLACE INTO company_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_COMPANY_SETTINGS)) {
    insertSetting.run(k, v);
  }
}

// Ensure email_from_address defaults to a5@active5.co.th
const currentEmailFrom = db.prepare("SELECT value FROM company_settings WHERE key = 'email_from_address'").get();
if (!currentEmailFrom || currentEmailFrom.value === 'onboarding@resend.dev') {
  db.prepare("INSERT OR REPLACE INTO company_settings (key, value) VALUES ('email_from_address', 'a5@active5.co.th')").run();
}

// Remove asset ACT-105 upon user request
try {
  const targetAsset = db.prepare("SELECT * FROM assets WHERE tag_id = 'ACT-105' OR serial_no = '960-001360'").get();
  if (targetAsset) {
    db.prepare("DELETE FROM loan_items WHERE tag_id = ?").run(targetAsset.tag_id);
    db.prepare("DELETE FROM asset_disposition_logs WHERE tag_id = ?").run(targetAsset.tag_id);
    db.prepare("DELETE FROM assets WHERE tag_id = ?").run(targetAsset.tag_id);
    console.log(`[CLEANUP] Deleted asset ${targetAsset.tag_id} (${targetAsset.model}) as requested`);
  }
} catch (e) {
  console.warn('[CLEANUP] Note:', e.message);
}

function getCompanySettings() {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  const settings = { ...DEFAULT_COMPANY_SETTINGS };
  for (const r of rows) {
    if (r.value !== undefined && r.value !== null) {
      settings[r.key] = r.value;
    }
  }
  // Fallback to environment variables if not set in DB
  if (!settings.email_api_key && (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY)) {
    settings.email_api_key = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY).trim();
  }
  if (!settings.smtp_pass && process.env.SMTP_PASS) {
    settings.smtp_pass = process.env.SMTP_PASS.trim();
  }
  if (!settings.smtp_user && process.env.SMTP_USER) {
    settings.smtp_user = process.env.SMTP_USER.trim();
  }
  return settings;
}

const PREFIX_REGEX = /^(บริษัท\s*มหาชน\s*จำกัด|บริษัท\s*จำกัด\s*\(มหาชน\)|บริษัท\s*\(มหาชน\)|บริษัท|บจก\.?|บมจ\.?|ห้างหุ้นส่วนจำกัด|หจก\.?|ห้างหุ้นส่วน|โรงพยาบาล|รพ\.?|ธนาคาร|บ\.?)\s*/i;
const SUFFIX_REGEX = /\s*(จำกัด\s*\(มหาชน\)|จำกัด\s*มหาชน|\(มหาชน\)|มหาชน|จำกัด|co\.,?\s*ltd\.?|co\.?\s*ltd\.?|ltd\.?|public\s*company\s*limited|plc\.?|inc\.?|corp\.?)$/i;

function stripCorporateAffixes(str) {
  if (!str) return '';
  return str.trim().replace(PREFIX_REGEX, '').replace(SUFFIX_REGEX, '').trim();
}

function cleanCompanyName(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/(จำกัด\s*)+$/i, 'จำกัด');
  s = s.replace(/\s*จำกัด\s+จำกัด(\s*\(มหาชน\))?/g, (m, pub) => pub ? ' จำกัด (มหาชน)' : ' จำกัด');
  s = s.replace(/\s*\(มหาชน\)\s*\(มหาชน\)/g, ' (มหาชน)');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

const CORPORATE_ALIASES = {
  // Retail & Wholesale
  'crc': ['เซ็นทรัล', 'เซ็นทรัลรีเทล', 'เซ็นทรัล รีเทล', 'Central Retail', 'Central', 'บมจ. เซ็นทรัล รีเทล คอร์ปอเรชั่น'],
  'cpn': ['เซ็นทรัลพัฒนา', 'เซ็นทรัล', 'Central Pattana'],
  'central': ['เซ็นทรัล', 'เซ็นทรัลพัฒนา', 'เซ็นทรัลรีเทล', 'CRC', 'CPN'],
  'เซ็นทรัล': ['CRC', 'CPN', 'Central', 'เซ็นทรัล รีเทล', 'เซ็นทรัลพัฒนา'],
  'cpall': ['ซีพี ออลล์', 'ซีพีออลล์', 'ซีพี', '7-Eleven', 'เซเว่น', 'CP ALL'],
  'cp all': ['ซีพี ออลล์', 'ซีพีออลล์', 'ซีพี', '7-Eleven', 'เซเว่น', 'CPALL'],
  'ซีพี': ['CP ALL', 'ซีพี ออลล์', 'เครือเจริญโภคภัณฑ์', 'เจริญโภคภัณฑ์อาหาร', 'CPF'],
  'cpf': ['เจริญโภคภัณฑ์อาหาร', 'ซีพีเอฟ', 'ซีพี'],
  'makro': ['สยามแม็คโคร', 'แม็คโคร', 'ซีพี แอ็กซ์ตร้า', 'CPAXT'],
  'แม็คโคร': ['สยามแม็คโคร', 'Makro', 'ซีพี แอ็กซ์ตร้า', 'CPAXT'],
  'cpaxt': ['ซีพี แอ็กซ์ตร้า', 'สยามแม็คโคร', 'แม็คโคร', 'โลตัส'],
  'lotus': ['โลตัส', 'เอก-ชัย ดิสทริบิวชั่น', 'เทสโก้ โลตัส'],
  'โลตัส': ['Lotus', 'เอก-ชัย ดิสทริบิวชั่น', 'เทสโก้ โลตัส'],
  'big c': ['บิ๊กซี', 'บิ๊กซี ซูเปอร์เซ็นเตอร์', 'BJC'],
  'บิ๊กซี': ['Big C', 'บิ๊กซี ซูเปอร์เซ็นเตอร์', 'เบอร์ลี่ ยุคเกอร์'],
  'homepro': ['โฮมโปร', 'โฮม โปรดักส์ เซ็นเตอร์', 'HMPRO'],
  'โฮมโปร': ['HomePro', 'โฮม โปรดักส์ เซ็นเตอร์', 'HMPRO'],
  'hmpro': ['โฮมโปร', 'โฮม โปรดักส์ เซ็นเตอร์', 'HomePro'],
  'dohome': ['ดูโฮม', 'DOHOME'],
  'ดูโฮม': ['DOHOME', 'ดูโฮม'],
  'global house': ['สยามโกลบอลเฮ้าส์', 'โกลบอลเฮ้าส์', 'GLOBAL'],
  'โกลบอลเฮ้าส์': ['สยามโกลบอลเฮ้าส์', 'GLOBAL'],
  'index': ['อินเด็กซ์ ลิฟวิ่งมอลล์', 'ILM'],
  'อินเด็กซ์': ['Index Living Mall', 'อินเด็กซ์ ลิฟวิ่งมอลล์'],

  // Logistics & Transport
  'dhl': ['ดีเอชแอล', 'ดีเอชแอล ซัพพลายเชน', 'ดีเอชแอล เอ๊กซ์เพรส', 'DHL Supply Chain'],
  'ดีเอชแอล': ['DHL', 'ดีเอชแอล ซัพพลายเชน', 'ดีเอชแอล เอ๊กซ์เพรส', 'DHL Supply Chain'],
  'flash': ['แฟลช เอ็กซ์เพรส', 'แฟลช', 'Flash Express'],
  'แฟลช': ['Flash', 'แฟลช เอ็กซ์เพรส', 'Flash Express'],
  'kerry': ['เคอรี่ เอ็กซ์เพรส', 'เคอรี่', 'Kerry Express', 'KEX'],
  'เคอรี่': ['Kerry', 'เคอรี่ เอ็กซ์เพรส', 'Kerry Express', 'KEX'],
  'kex': ['เคอรี่ เอ็กซ์เพรส', 'เคอรี่', 'Kerry Express'],
  'j&t': ['เจแอนด์ที', 'โกลบอล เจท เอ็กซ์เพรส', 'J&T Express', 'JNT'],
  'เจแอนด์ที': ['J&T', 'โกลบอล เจท เอ็กซ์เพรส', 'J&T Express', 'JNT'],
  'linfox': ['ลินฟอกซ์ ทรานสปอร์ต', 'ลินฟอกซ์', 'Linfox Transport'],
  'ลินฟอกซ์': ['Linfox', 'ลินฟอกซ์ ทรานสปอร์ต', 'Linfox Transport'],
  'jwd': ['เอสซีจี เจดับเบิ้ลยูดี', 'เจดับเบิ้ลยูดี', 'SCGJWD'],
  'เจดับเบิ้ลยูดี': ['JWD', 'เอสซีจี เจดับเบิ้ลยูดี', 'SCGJWD'],
  'scgjwd': ['เอสซีจี เจดับเบิ้ลยูดี', 'JWD'],
  'big box': ['บิ๊กบ็อกซ์ ลอจิสติกส์', 'บิ๊กบ็อกซ์', 'Bigbox', 'Big Box'],
  'บิ๊กบ็อกซ์': ['Big Box', 'Bigbox', 'บิ๊กบ็อกซ์ ลอจิสติกส์'],
  'bigbox': ['บิ๊กบ็อกซ์ ลอจิสติกส์', 'บิ๊กบ็อกซ์', 'Big Box'],
  'hino': ['ฮิโนะ', 'ฮิโน่', 'ฮิโนะ มอเตอร์ส', 'Hino Motors'],
  'ฮิโน่': ['ฮิโนะ', 'Hino', 'ฮิโนะ มอเตอร์ส', 'ฮิโน่ มอเตอร์ส'],
  'ฮิโนะ': ['ฮิโน่', 'Hino', 'ฮิโนะ มอเตอร์ส', 'ฮิโน่ มอเตอร์ส'],
  'toyota': ['โตโยต้า มอเตอร์', 'โตโยต้า ทูโช', 'โตโยต้า', 'TMT'],
  'โตโยต้า': ['Toyota', 'โตโยต้า มอเตอร์', 'โตโยต้า ทูโช'],
  'isuzu': ['อีซูซุมอเตอร์', 'ตรีเพชรอีซูซุเซลส์', 'อีซูซุ', 'Isuzu'],
  'อีซูซุ': ['Isuzu', 'อีซูซุมอเตอร์', 'ตรีเพชรอีซูซุเซลส์'],
  'wha': ['ดับบลิวเอชเอ คอร์ปอเรชั่น', 'ดับบลิวเอชเอ', 'WHA Corporation'],
  'ดับบลิวเอชเอ': ['WHA', 'ดับบลิวเอชเอ คอร์ปอเรชั่น'],

  // IT, Telecom & Electronics
  'active5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'บจก. แอคทีฟ 5', 'บริษัท แอคทีฟ 5 จำกัด'],
  'active 5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'บจก. แอคทีฟ 5', 'บริษัท แอคทีฟ 5 จำกัด'],
  'a5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'A5', 'บริษัท แอคทีฟ 5 จำกัด'],
  'แอคทีฟ 5': ['ACTIVE 5', 'แอคทีฟ5', 'A5', 'บริษัท แอคทีฟ 5 จำกัด'],
  'ais': ['แอดวานซ์ อินโฟร์ เซอร์วิส', 'เอไอเอส', 'ADVANC'],
  'เอไอเอส': ['AIS', 'แอดวานซ์ อินโฟร์ เซอร์วิส', 'ADVANC'],
  'true': ['ทรู คอร์ปอเรชั่น', 'ทรู', 'TRUE Corporation'],
  'ทรู': ['TRUE', 'ทรู คอร์ปอเรชั่น'],
  'dtac': ['โทเทิ่ล แอ็คเซ็ส คอมมูนิเคชั่น', 'ดีแทค', 'DTAC'],
  'ดีแทค': ['DTAC', 'โทเทิ่ล แอ็คเซ็ส'],
  'com7': ['คอมเซเว่น', 'COM7', 'บานาน่า', 'BaNANA'],
  'คอมเซเว่น': ['COM7', 'คอมเซเว่น'],
  'synnex': ['ซินเน็ค (ประเทศไทย)', 'ซินเน็ค', 'SYNEX'],
  'ซินเน็ค': ['SYNEX', 'ซินเน็ค (ประเทศไทย)'],
  'sis': ['เอสไอเอส ดิสทริบิวชั่น', 'เอสไอเอส', 'SIS Distribution'],
  'เอสไอเอส': ['SIS', 'เอสไอเอส ดิสทริบิวชั่น'],
  'advice': ['แอดไวซ์ ไอที อินฟินิท', 'แอดไวซ์', 'ADVICE'],
  'แอดไวซ์': ['ADVICE', 'แอดไวซ์'],
  'jib': ['เจ.ไอ.บี. คอมพิวเตอร์ กรุ๊ป', 'เจไอบี', 'JIB Computer'],
  'เจไอบี': ['JIB', 'เจ.ไอ.บี. คอมพิวเตอร์'],
  'jaymart': ['เจมาร์ท กรุ๊ป โฮลดิ้งส์', 'เจมาร์ท', 'JMART'],
  'เจมาร์ท': ['JMART', 'เจมาร์ท'],

  // Conglomerate, Industry & Energy
  'scg': ['ปูนซิเมนต์ไทย', 'เอสซีจี', 'ปูนใหญ่', 'SCC', 'THE SIAM CEMENT'],
  'เอสซีจี': ['SCG', 'ปูนซิเมนต์ไทย', 'ปูนใหญ่', 'SCC'],
  'ปูนซิเมนต์ไทย': ['SCG', 'เอสซีจี', 'SCC'],
  'ptt': ['ปตท.', 'ปตท', 'PTT', 'ปตท. น้ำมันและการค้าปลีก', 'OR'],
  'ปตท': ['PTT', 'ปตท.', 'ปตท. น้ำมันและการค้าปลีก', 'OR'],
  'or': ['ปตท. น้ำมันและการค้าปลีก', 'โออาร์', 'PTTOR', 'PTT OR'],
  'โออาร์': ['OR', 'ปตท. น้ำมันและการค้าปลีก'],
  'bcp': ['บางจาก คอร์ปอเรชั่น', 'บางจาก', 'BANGCHAK'],
  'บางจาก': ['BCP', 'บางจาก คอร์ปอเรชั่น'],
  'bjc': ['เบอร์ลี่ ยุคเกอร์', 'บีเจซี', 'BERLI JUCKER'],
  'เบอร์ลี่ ยุคเกอร์': ['BJC', 'บีเจซี', 'BERLI JUCKER'],
  'บีเจซี': ['BJC', 'เบอร์ลี่ ยุคเกอร์'],
  'thaibev': ['ไทยเบฟเวอเรจ', 'ไทยเบฟ', 'THBEV', 'ช้าง'],
  'ไทยเบฟ': ['ThaiBev', 'ไทยเบฟเวอเรจ', 'ช้าง'],
  'singha': ['บุญรอดบริวเวอรี่', 'สิงห์', 'บุญรอด', 'Boon Rawd'],
  'บุญรอด': ['Singha', 'บุญรอดบริวเวอรี่', 'สิงห์'],
  'สิงห์': ['Singha', 'บุญรอดบริวเวอรี่', 'บุญรอด'],
  'minor': ['เดอะ ไมเนอร์ ฟู้ด กรุ๊ป', 'ไมเนอร์ อินเตอร์เนชั่นแนล', 'MINT', 'ไมเนอร์'],
  'ไมเนอร์': ['Minor', 'เดอะ ไมเนอร์ ฟู้ด กรุ๊ป', 'MINT'],
  'cbg': ['คาราบาวกรุ๊ป', 'คาราบาว', 'CARABAO'],
  'คาราบาว': ['CBG', 'คาราบาวกรุ๊ป'],
  'osp': ['โอสถสภา', 'OSOTSPA'],
  'โอสถสภา': ['OSP', 'โอสถสภา'],

  // Hospitals & Healthcare
  'bdms': ['กรุงเทพดุสิตเวชการ', 'โรงพยาบาลกรุงเทพ', 'BDMS'],
  'กรุงเทพดุสิต': ['BDMS', 'กรุงเทพดุสิตเวชการ', 'โรงพยาบาลกรุงเทพ'],
  'bh': ['โรงพยาบาลบำรุงราษฎร์', 'บำรุงราษฎร์', 'Bumrungrad'],
  'บำรุงราษฎร์': ['BH', 'โรงพยาบาลบำรุงราษฎร์', 'Bumrungrad']
};

const BILINGUAL_MAP = {
  // Automotive
  'hino': ['ฮิโนะ', 'HINO'],
  'toyota': ['โตโยต้า', 'TOYOTA'],
  'honda': ['ฮอนด้า', 'HONDA'],
  'isuzu': ['อีซูซุ', 'ISUZU'],
  'mitsubishi': ['มิตซูบิชิ', 'MITSUBISHI'],
  'nissan': ['นิสสัน', 'NISSAN'],
  'mazda': ['มาสด้า', 'MAZDA'],
  'ford': ['ฟอร์ด', 'FORD'],
  'yamaha': ['ยามาฮ่า', 'YAMAHA'],
  'suzuki': ['ซูซูกิ', 'SUZUKI'],
  'mercedes': ['เมอร์เซเดส', 'เบนซ์', 'MERCEDES'],
  'bmw': ['บีเอ็มดับเบิลยู', 'บีเอ็ม', 'BMW'],
  'byd': ['บีวายดี', 'BYD'],
  'mg': ['เอ็มจี', 'MG'],

  // Logistics & Express
  'kerry': ['เคอรี่', 'KERRY'],
  'flash': ['แฟลช', 'FLASH'],
  'j&t': ['เจแอนด์ที', 'เจ แอนด์ ที', 'J&T'],
  'jnt': ['เจแอนด์ที', 'เจ แอนด์ ที', 'J&T'],
  'dhl': ['ดีเอชแอล', 'DHL'],
  'fedex': ['เฟดเอ็กซ์', 'FEDEX'],
  'lineman': ['ไลน์แมน', 'LINEMAN'],
  'grab': ['แกร็บ', 'GRAB'],
  'thailand post': ['ไปรษณีย์ไทย', 'THAILAND POST'],
  'post': ['ไปรษณีย์ไทย', 'ไปรษณีย์', 'POST'],

  // Conglomerates & Retail
  'scg': ['ปูนซิเมนต์ไทย', 'สยามซีเมนต์', 'เอสซีจี', 'SCG'],
  'cp': ['ซีพี', 'เจริญโภคภัณฑ์', 'CP'],
  'cp all': ['ซีพี ออลล์', 'CP ALL'],
  'cpall': ['ซีพี ออลล์', 'CP ALL'],
  'cp axtra': ['ซีพี แอ็กซ์ตร้า', 'CP AXTRA'],
  'cpaxtra': ['ซีพี แอ็กซ์ตร้า', 'CP AXTRA'],
  'makro': ['สยามแม็คโคร', 'แม็คโคร', 'MAKRO'],
  'lotus': ['โลตัส', 'เอก-ชัย', 'LOTUS'],
  'big c': ['บิ๊กซี', 'BIG C'],
  'bigc': ['บิ๊กซี', 'BIG C'],
  'central': ['เซ็นทรัล', 'CENTRAL'],
  'the mall': ['เดอะมอลล์', 'THE MALL'],
  'themall': ['เดอะมอลล์', 'THE MALL'],
  'homepro': ['โฮม โปร', 'โฮมโปร', 'HOME PRODUCT', 'HOMEPRO'],
  'home pro': ['โฮม โปร', 'โฮมโปร', 'HOME PRODUCT', 'HOMEPRO'],

  // Energy & Utilities
  'ptt': ['ปตท', 'PTT'],
  'pttor': ['ปตท. น้ำมัน', 'พีทีที โออาร์', 'PTTOR'],
  'or': ['น้ำมันและการค้าปลีก', 'โออาร์'],
  'bangchak': ['บางจาก', 'BANGCHAK'],
  'bcp': ['บางจาก', 'BANGCHAK', 'BCP'],
  'gulf': ['กัลฟ์', 'GULF'],

  // IT, Telecom & Electronics
  'brother': ['บราเดอร์', 'BROTHER'],
  'epson': ['เอปสัน', 'EPSON'],
  'canon': ['แคนนอน', 'CANON'],
  'apple': ['แอปเปิ้ล', 'APPLE'],
  'samsung': ['ซัมซุง', 'SAMSUNG'],
  'huawei': ['หัวเว่ย', 'HUAWEI'],
  'ricoh': ['ริโก้', 'RICOH'],
  'fujifilm': ['ฟูจิฟิล์ม', 'FUJIFILM'],
  'sony': ['โซนี่', 'SONY'],
  'panasonic': ['พานาโซนิค', 'PANASONIC'],
  'delta': ['เดลต้า', 'DELTA'],
  'ais': ['แอดวานซ์ อินโฟร์', 'เอไอเอส', 'ADVANCED INFO', 'AIS'],
  'true': ['ทรู คอร์ปอเรชั่น', 'ทรู', 'TRUE'],
  'dtac': ['โทเทิ่ล แอ็คเซ็ส', 'ดีแทค', 'DTAC'],
  'synnex': ['ซินเน็ค', 'SYNNEX'],
  'sis': ['เอสไอเอส', 'SIS DISTRIBUTION', 'SIS'],

  // Food, Beverage & Agribusiness
  'thaibev': ['ไทยเบฟ', 'ไทยเบฟเวอเรจ', 'THAIBEV'],
  'singha': ['บุญรอด', 'สิงห์', 'SINGHA', 'BOON RAWD'],
  'boonrawd': ['บุญรอดบริวเวอรี่', 'บุญรอด', 'BOON RAWD'],
  'betagro': ['เบทาโกร', 'BETAGRO'],
  'thai union': ['ไทยยูเนี่ยน', 'THAI UNION'],
  'thaiunion': ['ไทยยูเนี่ยน', 'THAI UNION'],

  // Banking & Financial
  'bbl': ['ธนาคารกรุงเทพ', 'BANGKOK BANK', 'BBL'],
  'bangkok bank': ['ธนาคารกรุงเทพ', 'BANGKOK BANK'],
  'kbank': ['กสิกรไทย', 'KASIKORNBANK', 'KBANK'],
  'kasikorn': ['กสิกรไทย', 'KASIKORNBANK'],
  'scb': ['ไทยพาณิชย์', 'SIAM COMMERCIAL BANK', 'SCB'],
  'ktb': ['กรุงไทย', 'KRUNG THAI BANK', 'KTB'],
  'krungthai': ['กรุงไทย', 'KRUNG THAI BANK'],
  'ttb': ['ทหารไทยธนชาต', 'TMBTHANACHART', 'TTB'],

  // Aviation
  'airasia': ['ไทยแอร์เอเชีย', 'แอร์เอเชีย', 'AIRASIA'],
  'thai airways': ['การบินไทย', 'THAI AIRWAYS'],
  'thaiairways': ['การบินไทย', 'THAI AIRWAYS'],
  'bangkok airways': ['บางกอกแอร์เวย์ส', 'BANGKOK AIRWAYS'],

  // Common Business Keywords (transliterations & industry words)
  'logistics': ['โลจิสติกส์', 'ลอจิสติกส์', 'โลจิส', 'LOGISTICS'],
  'express': ['เอ็กซ์เพรส', 'EXPRESS'],
  'transport': ['ทรานสปอร์ต', 'ขนส่ง', 'TRANSPORT'],
  'supply': ['ซัพพลาย', 'SUPPLY'],
  'technology': ['เทคโนโลยี', 'TECHNOLOGY'],
  'tech': ['เทค', 'เทคโนโลยี', 'TECH'],
  'solutions': ['โซลูชั่นส์', 'โซลูชั่น', 'SOLUTIONS'],
  'solution': ['โซลูชั่นส์', 'โซลูชั่น', 'SOLUTION'],
  'services': ['เซอร์วิสเซส', 'เซอร์วิส', 'บริการ', 'SERVICES'],
  'service': ['เซอร์วิส', 'บริการ', 'SERVICE'],
  'trading': ['เทรดดิ้ง', 'การค้า', 'TRADING'],
  'engineering': ['เอ็นจิเนียริ่ง', 'วิศวกรรม', 'ENGINEERING'],
  'construction': ['คอนสตรัคชั่น', 'ก่อสร้าง', 'CONSTRUCTION'],
  'property': ['พร็อพเพอร์ตี้', 'อสังหาริมทรัพย์', 'PROPERTY'],
  'group': ['กรุ๊ป', 'GROUP'],
  'holding': ['โฮลดิ้ง', 'HOLDING'],
  'holdings': ['โฮลดิ้งส์', 'โฮลดิ้ง', 'HOLDINGS'],
  'industry': ['อุตสาหกรรม', 'อินดัสทรี', 'INDUSTRY'],
  'manufacturing': ['แมนูแฟคเจอริ่ง', 'การผลิต', 'MANUFACTURING'],
  'distribution': ['ดิสทริบิวชั่น', 'DISTRIBUTION'],
  'consulting': ['คอนซัลติ้ง', 'คันซัลทิง', 'ที่ปรึกษา', 'CONSULTING'],
  'medical': ['เมดิคอล', 'การแพทย์', 'MEDICAL'],
  'hospital': ['โรงพยาบาล', 'HOSPITAL'],
  'packaging': ['แพคเกจจิ้ง', 'บรรจุภัณฑ์', 'PACKAGING'],
  'food': ['ฟู้ด', 'อาหาร', 'FOOD'],
  'foods': ['ฟู้ดส์', 'อาหาร', 'FOODS'],
  'energy': ['เอนเนอร์ยี่', 'พลังงาน', 'ENERGY'],
  'power': ['เพาเวอร์', 'พาวเวอร์', 'POWER'],
  'inter': ['อินเตอร์', 'INTER'],
  'international': ['อินเตอร์เนชั่นแนล', 'สากล', 'INTERNATIONAL'],
  'global': ['โกลบอล', 'GLOBAL'],
  'media': ['มีเดีย', 'MEDIA'],
  'digital': ['ดิจิทัล', 'ดิจิตอล', 'DIGITAL'],
  'center': ['เซ็นเตอร์', 'ศูนย์', 'CENTER'],
  'marketing': ['มาร์เก็ตติ้ง', 'การตลาด', 'MARKETING'],
  'management': ['แมนเนจเม้นท์', 'การจัดการ', 'MANAGEMENT'],
  'system': ['ซิสเต็ม', 'ระบบ', 'SYSTEM'],
  'systems': ['ซิสเต็มส์', 'SYSTEMS'],
  'green': ['กรีน', 'GREEN'],
  'star': ['สตาร์', 'STAR'],
  'nova': ['โนว่า', 'NOVA'],
  'prime': ['ไพรม์', 'PRIME'],
  'enterprise': ['เอ็นเตอร์ไพรส์', 'ENTERPRISE'],

  // Active 5 & Tech Solutions
  'active': ['แอคทีฟ', 'ACTIVE', 'บริษัท แอคทีฟ 5 จำกัด', 'แอคทีฟ 5'],
  'active5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'ACTIVE5', 'บริษัท แอคทีฟ 5 จำกัด', 'บจก. แอคทีฟ 5'],
  'active 5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'ACTIVE5', 'บริษัท แอคทีฟ 5 จำกัด', 'บจก. แอคทีฟ 5'],
  'a5': ['แอคทีฟ 5', 'แอคทีฟ5', 'ACTIVE 5', 'ACTIVE5', 'A5', 'บริษัท แอคทีฟ 5 จำกัด'],

  // Planet T & S
  'planet': ['แพลนเนท', 'แพลนเนทที', 'แพลนเนท ที แอนด์ เอส', 'PLANET T & S', 'PLANET T AND S', 'บริษัท แพลนเนท ที แอนด์ เอส จำกัด'],
  'planet t & s': ['แพลนเนท ที แอนด์ เอส', 'แพลนเนทที แอนด์ เอส', 'แพลนเนทที', 'PLANET T & S', 'PLANET T AND S'],
  'planet t and s': ['แพลนเนท ที แอนด์ เอส', 'แพลนเนทที แอนด์ เอส', 'PLANET T AND S'],
  'แพลนเนท': ['PLANET', 'แพลนเนท ที แอนด์ เอส', 'แพลนเนทที', 'แพลนเนทที แอนด์ เอส', 'บริษัท แพลนเนท ที แอนด์ เอส จำกัด'],
  'แพลนเนทที': ['PLANET T & S', 'แพลนเนท ที แอนด์ เอส', 'แพลนเนทที แอนด์ เอส', 'บริษัท แพลนเนท ที แอนด์ เอส จำกัด']
};

function getSearchSynonyms(query) {
  if (!query) return [];
  const qClean = query.trim();
  const qLower = qClean.toLowerCase();
  const synonyms = new Set([qClean]);

  // Stripped core name (without "บริษัท", "บจก.", "จำกัด", etc.)
  const core = stripCorporateAffixes(qClean);
  const coreLower = core.toLowerCase();
  if (core && core.length >= 2) {
    synonyms.add(core);
  }

  // Space-collapsed & space-normalized variants (e.g. "แอคทีฟ 5" <-> "แอคทีฟ5")
  const noSpace = qClean.replace(/\s+/g, '');
  if (noSpace && noSpace.length >= 2) synonyms.add(noSpace);
  if (core) {
    const coreNoSpace = core.replace(/\s+/g, '');
    if (coreNoSpace && coreNoSpace.length >= 2) synonyms.add(coreNoSpace);
  }

  // Check CORPORATE_ALIASES
  for (const [k, list] of Object.entries(CORPORATE_ALIASES)) {
    if (qLower === k || coreLower === k || qLower.includes(k) || (k.length >= 3 && k.includes(qLower))) {
      list.forEach(t => synonyms.add(t));
      synonyms.add(k);
    }
  }

  // Check BILINGUAL_MAP
  for (const [enKey, thList] of Object.entries(BILINGUAL_MAP)) {
    // English query match
    if (qLower === enKey || coreLower === enKey || (enKey.length >= 3 && (qLower.includes(enKey) || enKey.includes(qLower)))) {
      thList.forEach(t => synonyms.add(t));
      synonyms.add(enKey);
    }
    // Thai query match
    for (const th of thList) {
      if (qClean === th || core === th || (th.length >= 3 && (qClean.includes(th) || th.includes(qClean) || core.includes(th)))) {
        synonyms.add(enKey);
        synonyms.add(th);
      }
    }
  }
  return Array.from(synonyms);
}

function initCustomersTable() {
  try {
    const historical = db.prepare(`SELECT DISTINCT customer_company FROM loans WHERE customer_company != ''`).all();
    const insertHistory = db.prepare(`INSERT OR IGNORE INTO customers (name, source) VALUES (?, 'history')`);
    for (const h of historical) {
      if (h.customer_company && h.customer_company.trim()) {
        insertHistory.run(h.customer_company.trim());
      }
    }
  } catch (err) {}

  const defaultCompanies = [
    { name: 'บริษัท ฮิโนะ มอเตอร์ส แมนูแฟคเจอริ่ง (ประเทศไทย) จำกัด', name_en: 'HINO MOTORS MANUFACTURING (THAILAND) COMPANY LIMITED', tax_id: '0105507000216', source: 'dbd' },
    { name: 'บริษัท ฮิโนะ มอเตอร์ส เซลส์ (ประเทศไทย) จำกัด', name_en: 'HINO MOTORS SALES (THAILAND) COMPANY LIMITED', tax_id: '0105505001347', source: 'dbd' },
    { name: 'บริษัท โตโยต้า มอเตอร์ ประเทศไทย จำกัด', name_en: 'TOYOTA MOTOR THAILAND COMPANY LIMITED', tax_id: '0105505001649', source: 'dbd' },
    { name: 'บริษัท อีซูซุมอเตอร์ (ประเทศไทย) จำกัด', name_en: 'ISUZU MOTORS (THAILAND) COMPANY LIMITED', tax_id: '0105509000108', source: 'dbd' },
    { name: 'บริษัท ตรีเพชรอีซูซุเซลส์ จำกัด', name_en: 'TRI PETCH ISUZU SALES COMPANY LIMITED', tax_id: '0105517000551', source: 'dbd' },
    { name: 'บริษัท ฮอนด้า ออโตโมบิล (ประเทศไทย) จำกัด', name_en: 'HONDA AUTOMOBILE (THAILAND) COMPANY LIMITED', tax_id: '0105527008709', source: 'dbd' },
    { name: 'บริษัท มิตซูบิชิ มอเตอร์ส (ประเทศไทย) จำกัด', name_en: 'MITSUBISHI MOTORS (THAILAND) COMPANY LIMITED', tax_id: '0105530046849', source: 'dbd' },
    { name: 'บริษัท เคอรี่ เอ็กซ์เพรส (ประเทศไทย) จำกัด (มหาชน)', name_en: 'KERRY EXPRESS (THAILAND) PUBLIC COMPANY LIMITED', tax_id: '0107563000037', source: 'dbd' },
    { name: 'บริษัท แฟลช เอ็กซ์เพรส จำกัด', name_en: 'FLASH EXPRESS COMPANY LIMITED', tax_id: '0105560086202', source: 'dbd' },
    { name: 'บริษัท ซีพี ออลล์ จำกัด (มหาชน)', name_en: 'CP ALL PUBLIC COMPANY LIMITED', tax_id: '0107542000011', source: 'dbd' },
    { name: 'บริษัท ซีพี แอ็กซ์ตร้า จำกัด (มหาชน)', name_en: 'CP AXTRA PUBLIC COMPANY LIMITED', tax_id: '0107536000271', source: 'dbd' },
    { name: 'บริษัท บิ๊กซี ซูเปอร์เซ็นเตอร์ จำกัด (มหาชน)', name_en: 'BIG C SUPERCENTER PUBLIC COMPANY LIMITED', tax_id: '0107536000637', source: 'dbd' },
    { name: 'บริษัท ปูนซิเมนต์ไทย จำกัด (มหาชน)', name_en: 'THE SIAM CEMENT PUBLIC COMPANY LIMITED (SCG)', tax_id: '0107537000193', source: 'dbd' },
    { name: 'บริษัท ปตท. จำกัด (มหาชน)', name_en: 'PTT PUBLIC COMPANY LIMITED', tax_id: '0107544000108', source: 'dbd' },
    { name: 'บริษัท ปตท. น้ำมันและการค้าปลีก จำกัด (มหาชน)', name_en: 'PTT OIL AND RETAIL BUSINESS PUBLIC COMPANY LIMITED', tax_id: '0107561000242', source: 'dbd' },
    { name: 'บริษัท ไทยเบฟเวอเรจ แคน จำกัด', name_en: 'THAIBEV CAN COMPANY LIMITED', tax_id: '0105542017351', source: 'dbd' },
    { name: 'บริษัท ไทยยูเนี่ยน กรุ๊ป จำกัด (มหาชน)', name_en: 'THAI UNION GROUP PUBLIC COMPANY LIMITED', tax_id: '0107537000894', source: 'dbd' },
    { name: 'บริษัท เบทาโกร จำกัด (มหาชน)', name_en: 'BETAGRO PUBLIC COMPANY LIMITED', tax_id: '0107564000324', source: 'dbd' },
    { name: 'บริษัท ซินเน็ค (ประเทศไทย) จำกัด (มหาชน)', name_en: 'SYNNEX (THAILAND) PUBLIC COMPANY LIMITED', tax_id: '0107550000140', source: 'dbd' },
    { name: 'บริษัท เอสไอเอส ดิสทริบิวชั่น (ประเทศไทย) จำกัด (มหาชน)', name_en: 'SIS DISTRIBUTION (THAILAND) PUBLIC COMPANY LIMITED', tax_id: '0107547000388', source: 'dbd' },
    { name: 'บริษัท ทรู คอร์ปอเรชั่น จำกัด (มหาชน)', name_en: 'TRUE CORPORATION PUBLIC COMPANY LIMITED', tax_id: '0107535000049', source: 'dbd' },
    { name: 'บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน)', name_en: 'ADVANCED INFO SERVICE PUBLIC COMPANY LIMITED (AIS)', tax_id: '0107535000260', source: 'dbd' },
    { name: 'บริษัท บราเดอร์ คอมเมอร์เชียล (ประเทศไทย) จำกัด', name_en: 'BROTHER COMMERCIAL (THAILAND) COMPANY LIMITED', tax_id: '0105540051152', source: 'dbd' },
    { name: 'บริษัท เอปสัน (ประเทศไทย) จำกัด', name_en: 'EPSON (THAILAND) COMPANY LIMITED', tax_id: '0105533107011', source: 'dbd' },
    { name: 'บริษัท แคนนอน มาร์เก็ตติ้ง (ไทยแลนด์) จำกัด', name_en: 'CANON MARKETING (THAILAND) COMPANY LIMITED', tax_id: '0105537039091', source: 'dbd' },
    { name: 'บริษัท โฮม โปรดักส์ เซ็นเตอร์ จำกัด (มหาชน)', name_en: 'HOME PRODUCT CENTER PUBLIC COMPANY LIMITED (HOMEPRO)', tax_id: '0107544000094', source: 'dbd' },
    { name: 'บริษัท เซ็นทรัลพัฒนา จำกัด (มหาชน)', name_en: 'CENTRAL PATTANA PUBLIC COMPANY LIMITED (CPN)', tax_id: '0107536000262', source: 'dbd' },
    { name: 'บริษัท เดอะมอลล์ กรุ๊ป จำกัด', name_en: 'THE MALL GROUP COMPANY LIMITED', tax_id: '0105524003293', source: 'dbd' },
    { name: 'บริษัท ไปรษณีย์ไทย จำกัด', name_en: 'THAILAND POST COMPANY LIMITED', tax_id: '0105546095691', source: 'dbd' },
    { name: 'บริษัท ไทยแอร์เอเชีย จำกัด', name_en: 'THAI AIRASIA COMPANY LIMITED', tax_id: '0105546113941', source: 'dbd' },
    { name: 'บริษัท เดลต้า อีเลคโทรนิคส์ (ประเทศไทย) จำกัด (มหาชน)', name_en: 'DELTA ELECTRONICS (THAILAND) PUBLIC COMPANY LIMITED', tax_id: '0107538000085', source: 'dbd' },
    { name: 'บริษัท ซัมซุง อิเลคโทรนิคส์ (ประเทศไทย) จำกัด', name_en: 'SAMSUNG ELECTRONICS (THAILAND) COMPANY LIMITED', tax_id: '0105531086089', source: 'dbd' },
    { name: 'บริษัท แอปเปิ้ล เซาท์ เอเชีย (ประเทศไทย) จำกัด', name_en: 'APPLE SOUTH ASIA (THAILAND) LIMITED', tax_id: '0105542037742', source: 'dbd' },
    { name: 'บริษัท ดีเอชแอล ซัพพลายเชน (ประเทศไทย) จำกัด', name_en: 'DHL SUPPLY CHAIN (THAILAND) LIMITED', tax_id: '0105538029580', source: 'dbd' },
    { name: 'บริษัท เจแอนด์ที เอ็กซ์เพรส (ไทยแลนด์) จำกัด', name_en: 'J&T EXPRESS (THAILAND) COMPANY LIMITED', tax_id: '0105561141444', source: 'dbd' },
    { name: 'บริษัท การบินไทย จำกัด (มหาชน)', name_en: 'THAI AIRWAYS INTERNATIONAL PUBLIC COMPANY LIMITED', tax_id: '0107537001757', source: 'dbd' },
    { name: 'ธนาคารกรุงเทพ จำกัด (มหาชน)', name_en: 'BANGKOK BANK PUBLIC COMPANY LIMITED', tax_id: '0107536000378', source: 'dbd' },
    { name: 'ธนาคารกสิกรไทย จำกัด (มหาชน)', name_en: 'KASIKORNBANK PUBLIC COMPANY LIMITED', tax_id: '0107535000189', source: 'dbd' },
    { name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', name_en: 'THE SIAM COMMERCIAL BANK PUBLIC COMPANY LIMITED', tax_id: '0107536000102', source: 'dbd' },
    { name: 'ธนาคารกรุงไทย จำกัด (มหาชน)', name_en: 'KRUNG THAI BANK PUBLIC COMPANY LIMITED', tax_id: '0107537000882', source: 'dbd' },
    { name: 'ธนาคารทหารไทยธนชาต จำกัด (มหาชน)', name_en: 'TMBTHANACHART BANK PUBLIC COMPANY LIMITED (TTB)', tax_id: '0107537000011', source: 'dbd' },
    { name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด', name_en: 'BOON RAWD BREWERY COMPANY LIMITED', tax_id: '0105501000109', source: 'dbd' },
    { name: 'บริษัท แอคทีฟ 5 จำกัด', name_en: 'ACTIVE 5 CO., LTD.', tax_id: '0105564085492', source: 'history' },
    { name: 'บมจ. เซ็นทรัล รีเทล คอร์ปอเรชั่น (CRC)', name_en: 'CENTRAL RETAIL CORPORATION PUBLIC COMPANY LIMITED', tax_id: '0107562000386', source: 'history' },
    { name: 'บริษัท เซ็นทรัล รีเทล คอร์ปอเรชั่น จำกัด (มหาชน)', name_en: 'CENTRAL RETAIL CORPORATION PUBLIC COMPANY LIMITED', tax_id: '0107562000386', source: 'dbd' },
    { name: 'บริษัท บิ๊กบ็อกซ์ ลอจิสติกส์ จำกัด', name_en: 'BIGBOX LOGISTICS COMPANY LIMITED', tax_id: '0105561175659', source: 'history' },
    { name: 'บริษัท Bigbox จำกัด', name_en: 'BIGBOX LOGISTICS COMPANY LIMITED', tax_id: '0105561175659', source: 'history' },
    { name: 'บริษัท ไทยเบฟเวอเรจ จำกัด (มหาชน)', name_en: 'THAI BEVERAGE PUBLIC COMPANY LIMITED', tax_id: '0107546000343', source: 'dbd' },
    { name: 'บริษัท เดอะ ไมเนอร์ ฟู้ด กรุ๊ป จำกัด (มหาชน)', name_en: 'THE MINOR FOOD GROUP PUBLIC COMPANY LIMITED', tax_id: '0107535000031', source: 'history' },
    { name: 'บริษัท กรุงเทพดุสิตเวชการ จำกัด (มหาชน)', name_en: 'BANGKOK DUSIT MEDICAL SERVICES PUBLIC COMPANY LIMITED (BDMS)', tax_id: '0107537000059', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลบำรุงราษฎร์ จำกัด (มหาชน)', name_en: 'BUMRUNGRAD HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000940', source: 'dbd' },
    { name: 'บริษัท ดับบลิวเอชเอ คอร์ปอเรชั่น จำกัด (มหาชน)', name_en: 'WHA CORPORATION PUBLIC COMPANY LIMITED', tax_id: '0107555000082', source: 'dbd' },
    { name: 'บริษัท ลินฟอกซ์ ทรานสปอร์ต (ประเทศไทย) จำกัด', name_en: 'LINFOX TRANSPORT (THAILAND) LIMITED', tax_id: '0105536098029', source: 'history' },
    { name: 'บริษัท สยามแม็คโคร จำกัด (มหาชน)', name_en: 'SIAM MAKRO PUBLIC COMPANY LIMITED', tax_id: '0107536000271', source: 'history' },
    { name: 'บริษัท เบอร์ลี่ ยุคเกอร์ จำกัด (มหาชน)', name_en: 'BERLI JUCKER PUBLIC COMPANY LIMITED (BJC)', tax_id: '0107536000220', source: 'history' },
    { name: 'บริษัท คอมเซเว่น จำกัด (มหาชน)', name_en: 'COM7 PUBLIC COMPANY LIMITED', tax_id: '0107557000404', source: 'dbd' },
    { name: 'บริษัท แอดไวซ์ ไอที อินฟินิท จำกัด (มหาชน)', name_en: 'ADVICE IT INFINITE PUBLIC COMPANY LIMITED', tax_id: '0107565000450', source: 'dbd' },
    { name: 'บริษัท เจ.ไอ.บี. คอมพิวเตอร์ กรุ๊ป จำกัด', name_en: 'J.I.B. COMPUTER GROUP COMPANY LIMITED', tax_id: '0105544078498', source: 'dbd' },
    { name: 'บริษัท เอมิโปร โซลูชั่น จำกัด', name_en: 'EMIPRO SOLUTION COMPANY LIMITED', tax_id: '0105561089221', source: 'history' },
    { name: 'บจก. เอมิโปร โซลูชั่น', name_en: 'EMIPRO SOLUTION COMPANY LIMITED', tax_id: '0105561089221', source: 'history' },
    { name: 'ห้างหุ้นส่วนจำกัด กิตติการ์เมนต์', name_en: 'KITTI GARMENT LIMITED PARTNERSHIP', tax_id: '0103541015694', source: 'history' },
    { name: 'บริษัท นภา ลอจิสติกส์ จำกัด', name_en: 'NAPA LOGISTICS COMPANY LIMITED', tax_id: '0105556133919', source: 'history' },
    { name: 'บจก. ไทยแมนูแฟกเจอริ่ง', name_en: 'THAI MANUFACTURING COMPANY LIMITED', tax_id: '0105553018248', source: 'history' },
    { name: 'บริษัท แพลนเนท ที แอนด์ เอส จำกัด', name_en: 'PLANET T AND S COMPANY LIMITED', tax_id: '0105540006321', branch: 'สำนักงานใหญ่', address: '28 ซอยกรุงเทพกรีฑา 20 แยก 3 แขวงทับช้าง เขตสะพานสูง กรุงเทพมหานคร 10250', source: 'dbd' },

    // Major Hospitals & Healthcare (โรงพยาบาลและการแพทย์ชั้นนำ)
    { name: 'บริษัท กรุงเทพดุสิตเวชการ จำกัด (มหาชน)', name_en: 'BANGKOK DUSIT MEDICAL SERVICES PUBLIC COMPANY LIMITED (BDMS)', tax_id: '0107537000059', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลบำรุงราษฎร์ จำกัด (มหาชน)', name_en: 'BUMRUNGRAD HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000940', source: 'dbd' },
    { name: 'บริษัท สมิติเวช จำกัด (มหาชน)', name_en: 'SAMITIVEJ PUBLIC COMPANY LIMITED', tax_id: '0107536000851', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสมิติเวช ศรีนครินทร์ จำกัด', name_en: 'SAMITIVEJ SRINAKARIN HOSPITAL COMPANY LIMITED', tax_id: '0105534062407', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสมิติเวช ศรีราชา จำกัด', name_en: 'SAMITIVEJ SRIRACHA HOSPITAL COMPANY LIMITED', tax_id: '0205536001403', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสมิติเวช ธนบุรี จำกัด', name_en: 'SAMITIVEJ THONBURI HOSPITAL COMPANY LIMITED', tax_id: '0105521008685', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสมิติเวช ชลบุรี จำกัด', name_en: 'SAMITIVEJ CHONBURI HOSPITAL COMPANY LIMITED', tax_id: '0205556014498', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลนนทเวช จำกัด (มหาชน)', name_en: 'NONTHAVEJ HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000788', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลวิภาวดี จำกัด (มหาชน)', name_en: 'VIBHAVADI MEDICAL PUBLIC COMPANY LIMITED', tax_id: '0107536000737', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพระรามเก้า จำกัด (มหาชน)', name_en: 'PRARAM 9 HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107561000285', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลรามคำแหง จำกัด (มหาชน)', name_en: 'RAMKHAMHAENG HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107537001408', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลไทยนครินทร์ จำกัด (มหาชน)', name_en: 'THAINAKARIN HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000670', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลลาดพร้าว จำกัด (มหาชน)', name_en: 'LADPRAO GENERAL HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000378', source: 'dbd' },
    { name: 'บริษัท เอกชัยการแพทย์ จำกัด (มหาชน)', name_en: 'EKACHAI MEDICAL CARE PUBLIC COMPANY LIMITED', tax_id: '0107558000459', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลจุฬารัตน์ จำกัด (มหาชน)', name_en: 'CHULARAT HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107547000570', source: 'dbd' },
    { name: 'บริษัท ศรีวิชัยเวชวิวัฒน์ จำกัด (มหาชน)', name_en: 'SRIVICHAIVEJVIVAT PUBLIC COMPANY LIMITED', tax_id: '0107553000043', source: 'dbd' },
    { name: 'บริษัท เชียงใหม่รามธุรกิจการแพทย์ จำกัด (มหาชน)', name_en: 'CHIANG MAI RAM MEDICAL BUSINESS PUBLIC COMPANY LIMITED', tax_id: '0107536000173', source: 'dbd' },
    { name: 'บริษัท บางกอก เชน ฮอสปิทอล จำกัด (มหาชน)', name_en: 'BANGKOK CHAIN HOSPITAL PUBLIC COMPANY LIMITED (KASEMRAD)', tax_id: '0107547000154', source: 'dbd' },
    { name: 'บริษัท ธนบุรี เฮลท์แคร์ กรุ๊ป จำกัด (มหาชน)', name_en: 'THONBURI HEALTHCARE GROUP PUBLIC COMPANY LIMITED (THG)', tax_id: '0107537002048', source: 'dbd' },
    { name: 'บริษัท มหาชัยเวชการ จำกัด (มหาชน)', name_en: 'MAHACHAI HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107537001491', source: 'dbd' },
    { name: 'บริษัท ศิครินทร์ จำกัด (มหาชน)', name_en: 'SIKARIN PUBLIC COMPANY LIMITED', tax_id: '0107536000301', source: 'dbd' },
    { name: 'บริษัท แพทย์รังสิตเฮลท์แคร์กรุ๊ป จำกัด (มหาชน)', name_en: 'PATRANGSIT HEALTHCARE GROUP PUBLIC COMPANY LIMITED', tax_id: '0107565000417', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเจ้าพระยา จำกัด (มหาชน)', name_en: 'CHAOPHYA HOSPITAL PUBLIC COMPANY LIMITED', tax_id: '0107536000394', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพญาไท 1 จำกัด', name_en: 'PHYATHAI 1 HOSPITAL COMPANY LIMITED', tax_id: '0105517000771', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพญาไท 2 จำกัด', name_en: 'PHYATHAI 2 HOSPITAL COMPANY LIMITED', tax_id: '0105528033286', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพญาไท 3 จำกัด', name_en: 'PHYATHAI 3 HOSPITAL COMPANY LIMITED', tax_id: '0105537042531', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพญาไท นวมินทร์ จำกัด', name_en: 'PHYATHAI NAWAMIN HOSPITAL COMPANY LIMITED', tax_id: '0105537006887', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเปาโลเมโมเรียล จำกัด', name_en: 'PAOLO MEMORIAL HOSPITAL COMPANY LIMITED', tax_id: '0105515003110', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเปาโลเมโมเรียลสมุทรปราการ จำกัด', name_en: 'PAOLO MEMORIAL SAMUTPRAKARN HOSPITAL COMPANY LIMITED', tax_id: '0115536000591', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเปาโลเมโมเรียลโชคชัย 4 จำกัด', name_en: 'PAOLO MEMORIAL CHOKCHAI 4 HOSPITAL COMPANY LIMITED', tax_id: '0105533036496', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเปาโลเมโมเรียลเกษตร จำกัด', name_en: 'PAOLO MEMORIAL KASET HOSPITAL COMPANY LIMITED', tax_id: '0105512001647', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสินแพทย์ จำกัด', name_en: 'SYNPHAETH HOSPITAL COMPANY LIMITED', tax_id: '0105535035414', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสินแพทย์ เทพารักษ์ จำกัด', name_en: 'SYNPHAETH THEPHARAK HOSPITAL COMPANY LIMITED', tax_id: '0115560010996', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสินแพทย์ ลำลูกกา จำกัด', name_en: 'SYNPHAETH LUMLUKKA HOSPITAL COMPANY LIMITED', tax_id: '0135559005911', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลสินแพทย์ เสรีรักษ์ จำกัด', name_en: 'SYNPHAETH SERIRUK HOSPITAL COMPANY LIMITED', tax_id: '0105547076615', source: 'dbd' },
    { name: 'บริษัท บางปะกอก ฮอสพิทอล กรุ๊ป จำกัด', name_en: 'BANGPAKOK HOSPITAL GROUP COMPANY LIMITED', tax_id: '0105553013891', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลบางปะกอก 9 อินเตอร์เนชั่นแนล จำกัด', name_en: 'BANGPAKOK 9 INTERNATIONAL HOSPITAL COMPANY LIMITED', tax_id: '0105546029051', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลบางปะกอก 1 จำกัด', name_en: 'BANGPAKOK 1 HOSPITAL COMPANY LIMITED', tax_id: '0105524018223', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลบางปะกอก 3 จำกัด', name_en: 'BANGPAKOK 3 HOSPITAL COMPANY LIMITED', tax_id: '0115538006091', source: 'dbd' },
    { name: 'บริษัท มงกุฎวัฒนะการแพทย์ จำกัด', name_en: 'MONGKUTWATTANA GENERAL HOSPITAL COMPANY LIMITED', tax_id: '0105525016500', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลหัวเฉียว จำกัด', name_en: 'HUACHIEW HOSPITAL COMPANY LIMITED', tax_id: '0105522002346', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลมิชชั่น จำกัด', name_en: 'MISSION HOSPITAL COMPANY LIMITED', tax_id: '0105545089335', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลกรุงเทพคริสเตียน จำกัด', name_en: 'BANGKOK CHRISTIAN HOSPITAL COMPANY LIMITED', tax_id: '0105501000109', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเซนต์หลุยส์ จำกัด', name_en: 'SAINT LOUIS HOSPITAL COMPANY LIMITED', tax_id: '0105513000571', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลวิมุต จำกัด', name_en: 'VIMUT HOSPITAL COMPANY LIMITED', tax_id: '0105560032641', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลเมดพาร์ค จำกัด', name_en: 'MEDPARK HOSPITAL COMPANY LIMITED', tax_id: '0105560195222', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลธนบุรี บำรุงเมือง จำกัด', name_en: 'THONBURI BAMRUNGMUANG HOSPITAL COMPANY LIMITED', tax_id: '0105561081700', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลพริ้นซ์ สุวรรณภูมิ จำกัด', name_en: 'PRINC HOSPITAL SUVARNABHUMI COMPANY LIMITED', tax_id: '0115560008541', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลรวมใจรักษ์ จำกัด', name_en: 'RUAMJAIRAK HOSPITAL COMPANY LIMITED', tax_id: '0105561142548', source: 'dbd' },
    { name: 'บริษัท การแพทย์สยาม จำกัด', name_en: 'SIAM MEDICAL COMPANY LIMITED (PIYAVATE HOSPITAL)', tax_id: '0105515003306', source: 'dbd' },
    { name: 'บริษัท วิชัยยุทธ จำกัด', name_en: 'VICHAIYUT COMPANY LIMITED (VICHAIYUT HOSPITAL)', tax_id: '0105517006842', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลวัฒโนสถ จำกัด', name_en: 'WATTANOSOTH HOSPITAL COMPANY LIMITED', tax_id: '0105549079971', source: 'dbd' },
    { name: 'บริษัท นวมินทร์รวมแพทย์ จำกัด', name_en: 'NAVAMIN 9 HOSPITAL COMPANY LIMITED', tax_id: '0105536066275', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลกรุงเทพพัทยา จำกัด', name_en: 'BANGKOK HOSPITAL PATTAYA COMPANY LIMITED', tax_id: '0205533003057', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลกรุงเทพภูเก็ต จำกัด', name_en: 'BANGKOK HOSPITAL PHUKET COMPANY LIMITED', tax_id: '0835536001643', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลกรุงเทพระยอง จำกัด', name_en: 'BANGKOK HOSPITAL RAYONG COMPANY LIMITED', tax_id: '0215544001929', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลกรุงเทพเชียงใหม่ จำกัด', name_en: 'BANGKOK HOSPITAL CHIANGMAI COMPANY LIMITED', tax_id: '0505554003328', source: 'dbd' },
    { name: 'บริษัท โรงพยาบาลอินซ์ จำกัด', name_en: 'INZ HOSPITAL COMPANY LIMITED', tax_id: '0105562095691', source: 'dbd' },

    // Retail, Wholesale, Hypermarkets (ห้างสรรพสินค้า ค้าปลีก ค้าส่ง)
    { name: 'บริษัท เอก-ชัย ดีสทริบิวชั่น ซิสเทม จำกัด', name_en: 'EK-CHAI DISTRIBUTION SYSTEM COMPANY LIMITED (LOTUS)', tax_id: '0105536050549', source: 'dbd' },
    { name: 'บริษัท สยามพิวรรธน์ จำกัด', name_en: 'SIAM PIWAT COMPANY LIMITED', tax_id: '0105502000072', source: 'dbd' },
    { name: 'บริษัท สยามพารากอน ดีเวลลอปเม้นท์ จำกัด', name_en: 'SIAM PARAGON DEVELOPMENT COMPANY LIMITED', tax_id: '0105545107023', source: 'dbd' },
    { name: 'บริษัท เซ็นทรัล ฟู้ด รีเทล จำกัด', name_en: 'CENTRAL FOOD RETAIL COMPANY LIMITED (TOPS)', tax_id: '0105539061452', source: 'dbd' },
    { name: 'บริษัท ซีอาร์ซี ไทวัสดุ จำกัด', name_en: 'CRC THAI WATSADU COMPANY LIMITED', tax_id: '0105553046209', source: 'dbd' },
    { name: 'บริษัท สยามโกลบอลเฮ้าส์ จำกัด (มหาชน)', name_en: 'SIAM GLOBAL HOUSE PUBLIC COMPANY LIMITED', tax_id: '0107551000216', source: 'dbd' },
    { name: 'บริษัท ดูโฮม จำกัด (มหาชน)', name_en: 'DOHOME PUBLIC COMPANY LIMITED', tax_id: '0107561000439', source: 'dbd' },
    { name: 'บริษัท เมกา โฮม เซ็นเตอร์ จำกัด', name_en: 'MEGA HOME CENTER COMPANY LIMITED', tax_id: '0105555099300', source: 'dbd' },
    { name: 'บริษัท บุญถาวร เซรามิค จำกัด', name_en: 'BOONTHAVORN CERAMIC COMPANY LIMITED', tax_id: '0105523000622', source: 'dbd' },
    { name: 'บริษัท เจมาร์ท โมบาย จำกัด', name_en: 'JAYMART MOBILE COMPANY LIMITED', tax_id: '0105559092822', source: 'dbd' },
    { name: 'บริษัท ซีเอ็ดยูเคชั่น จำกัด (มหาชน)', name_en: 'SE-EDUCATION PUBLIC COMPANY LIMITED', tax_id: '0107536000289', source: 'dbd' },
    { name: 'บริษัท ซีอาร์ซี สปอร์ต จำกัด', name_en: 'CRC SPORTS COMPANY LIMITED (SUPERSPORTS)', tax_id: '0105539091998', source: 'dbd' },
    { name: 'บริษัท เพาเวอร์บาย จำกัด', name_en: 'POWER BUY COMPANY LIMITED', tax_id: '0105539091726', source: 'dbd' },
    { name: 'บริษัท ออฟฟิศเมท (ไทย) จำกัด', name_en: 'OFFICEMATE (THAI) COMPANY LIMITED', tax_id: '0105551046775', source: 'dbd' },
    { name: 'บริษัท บีทูเอส จำกัด', name_en: 'B2S COMPANY LIMITED', tax_id: '0105543085520', source: 'dbd' },

    // Logistics, Courier & Supply Chain (ขนส่งและโลจิสติกส์)
    { name: 'บริษัท นินจา โลจิสติกส์ (ประเทศไทย) จำกัด', name_en: 'NINJA LOGISTICS (THAILAND) COMPANY LIMITED', tax_id: '0105559132174', source: 'dbd' },
    { name: 'บริษัท เบสท์ โลจิสติกส์ เทคโนโลยี (ประเทศไทย) จำกัด', name_en: 'BEST LOGISTICS TECHNOLOGY (THAILAND) COMPANY LIMITED', tax_id: '0105561081696', source: 'dbd' },
    { name: 'บริษัท เอสซีจี เจดับเบิ้ลยูดี โลจิสติกส์ จำกัด (มหาชน)', name_en: 'SCG JWD LOGISTICS PUBLIC COMPANY LIMITED', tax_id: '0107557000188', source: 'dbd' },
    { name: 'บริษัท เมโทรซิสเต็มส์คอร์ปอเรชั่น จำกัด (มหาชน)', name_en: 'METRO SYSTEMS CORPORATION PUBLIC COMPANY LIMITED', tax_id: '0107538000611', source: 'dbd' },
    { name: 'บริษัท ยูไนเต็ด พาร์เซล เซอร์วิส (ประเทศไทย) จำกัด', name_en: 'UNITED PARCEL SERVICE (THAILAND) LIMITED (UPS)', tax_id: '0105531024342', source: 'dbd' },
    { name: 'บริษัท เฟดเดอรัล เอ็กซ์เพรส (ประเทศไทย) จำกัด', name_en: 'FEDERAL EXPRESS (THAILAND) LIMITED (FEDEX)', tax_id: '0105538081191', source: 'dbd' },

    // Manufacturing, Auto & Tech (อุตสาหกรรม ยานยนต์ และเทคโนโลยี)
    { name: 'บริษัท นิสสัน มอเตอร์ (ประเทศไทย) จำกัด', name_en: 'NISSAN MOTOR (THAILAND) COMPANY LIMITED', tax_id: '0105517006834', source: 'dbd' },
    { name: 'บริษัท ฟอร์ด มอเตอร์ คัมปะนี (ประเทศไทย) จำกัด', name_en: 'FORD MOTOR COMPANY (THAILAND) LIMITED', tax_id: '0105538137359', source: 'dbd' },
    { name: 'บริษัท มาสด้า เซลส์ (ประเทศไทย) จำกัด', name_en: 'MAZDA SALES (THAILAND) COMPANY LIMITED', tax_id: '0105542079038', source: 'dbd' },
    { name: 'บริษัท บีเอ็มดับเบิลยู (ประเทศไทย) จำกัด', name_en: 'BMW (THAILAND) COMPANY LIMITED', tax_id: '0105541058227', source: 'dbd' },
    { name: 'บริษัท เมอร์เซเดส-เบนซ์ (ประเทศไทย) จำกัด', name_en: 'MERCEDES-BENZ (THAILAND) LIMITED', tax_id: '0105541065169', source: 'dbd' },
    { name: 'บริษัท บีวายดี ออโต้ (ประเทศไทย) จำกัด', name_en: 'BYD AUTO (THAILAND) COMPANY LIMITED', tax_id: '0105565147574', source: 'dbd' },
    { name: 'บริษัท ซีเกท เทคโนโลยี (ประเทศไทย) จำกัด', name_en: 'SEAGATE TECHNOLOGY (THAILAND) LIMITED', tax_id: '0105526019570', source: 'dbd' },
    { name: 'บริษัท เวสเทิร์น ดิจิตอล (ประเทศไทย) จำกัด', name_en: 'WESTERN DIGITAL (THAILAND) COMPANY LIMITED', tax_id: '0105540026212', source: 'dbd' },
    { name: 'บริษัท คาล-คอมพ์ อีเล็คโทรนิคส์ (ประเทศไทย) จำกัด (มหาชน)', name_en: 'CAL-COMP ELECTRONICS (THAILAND) PUBLIC COMPANY LIMITED', tax_id: '0107544000183', source: 'dbd' },
    { name: 'บริษัท ฟาบริเนท จำกัด', name_en: 'FABRINET COMPANY LIMITED', tax_id: '0105542072386', source: 'dbd' },
    { name: 'บริษัท ไมโครชิพ เทคโนโลยี (ไทยแลนด์) จำกัด', name_en: 'MICROCHIP TECHNOLOGY (THAILAND) COMPANY LIMITED', tax_id: '0105538059888', source: 'dbd' },
    { name: 'บริษัท มูราตะ อิเล็กทรอนิกส์ (ประเทศไทย) จำกัด', name_en: 'MURATA ELECTRONICS (THAILAND) LIMITED', tax_id: '0105531062601', source: 'dbd' },

    // Food, Consumer & Services (อาหาร เครื่องดื่ม สินค้าอุปโภค)
    { name: 'บริษัท โอสถสภา จำกัด (มหาชน)', name_en: 'OSOTSPA PUBLIC COMPANY LIMITED', tax_id: '0107561000102', source: 'dbd' },
    { name: 'บริษัท คาราบาวกรุ๊ป จำกัด (มหาชน)', name_en: 'CARABAO GROUP PUBLIC COMPANY LIMITED', tax_id: '0107557000285', source: 'dbd' },
    { name: 'บริษัท อิชิตัน กรุ๊ป จำกัด (มหาชน)', name_en: 'ICHITAN GROUP PUBLIC COMPANY LIMITED', tax_id: '0107556000281', source: 'dbd' },
    { name: 'บริษัท ไทยเพรซิเดนท์ฟูดส์ จำกัด (มหาชน)', name_en: 'THAI PRESIDENT FOODS PUBLIC COMPANY LIMITED (MAMA)', tax_id: '0107560000303', source: 'dbd' },
    { name: 'บริษัท เอ็มเค เรสโตรองต์ กรุ๊ป จำกัด (มหาชน)', name_en: 'MK RESTAURANT GROUP PUBLIC COMPANY LIMITED', tax_id: '0107555000317', source: 'dbd' },
    { name: 'บริษัท เดอะ ไมเนอร์ ฟู้ด กรุ๊ป จำกัด (มหาชน)', name_en: 'THE MINOR FOOD GROUP PUBLIC COMPANY LIMITED', tax_id: '0107535000031', source: 'dbd' },
    { name: 'บริษัท ยัม เรสเทอรองตส์ อินเตอร์เนชั่นแนล (ประเทศไทย) จำกัด', name_en: 'YUM RESTAURANTS INTERNATIONAL (THAILAND) CO., LTD. (KFC)', tax_id: '0105526016147', source: 'dbd' },
    { name: 'บริษัท คอฟฟี่ คอนเซ็ปต์ รีเทล จำกัด', name_en: 'COFFEE CONCEPT RETAIL COMPANY LIMITED (STARBUCKS)', tax_id: '0105562086438', source: 'dbd' },
    { name: 'บริษัท ยูนิลีเวอร์ ไทย เทรดดิ้ง จำกัด', name_en: 'UNILEVER THAI TRADING LIMITED', tax_id: '0105538059284', source: 'dbd' },
    { name: 'บริษัท พรอคเตอร์ แอนด์ แกมเบิล เทรดดิ้ง (ประเทศไทย) จำกัด', name_en: 'PROCTER & GAMBLE TRADING (THAILAND) LIMITED', tax_id: '0105538078971', source: 'dbd' },
    { name: 'บริษัท เนสท์เล่ (ไทย) จำกัด', name_en: 'NESTLE (THAI) LIMITED', tax_id: '0105536098029', source: 'dbd' },
    { name: 'บริษัท อายิโนะโมะโต๊ะ (ประเทศไทย) จำกัด', name_en: 'AJINOMOTO (THAILAND) COMPANY LIMITED', tax_id: '0105503000670', source: 'dbd' },
    { name: 'บริษัท ดัชมิลล์ จำกัด', name_en: 'DUTCH MILL COMPANY LIMITED', tax_id: '0105527011980', source: 'dbd' }
  ];

  const upsertDbd = db.prepare(`
    INSERT INTO customers (name, name_en, tax_id, source)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      name_en = CASE WHEN excluded.name_en != '' THEN excluded.name_en ELSE customers.name_en END,
      tax_id = CASE WHEN customers.tax_id = '' THEN excluded.tax_id ELSE customers.tax_id END,
      source = excluded.source
  `);

  const updateTax = db.prepare(`
    UPDATE customers
    SET tax_id = CASE WHEN tax_id = '' THEN ? ELSE tax_id END,
        name_en = CASE WHEN name_en = '' THEN ? ELSE name_en END
    WHERE name = ?
  `);

  try {
    for (const c of defaultCompanies) {
      upsertDbd.run(c.name, c.name_en || '', c.tax_id || '', c.source);
      updateTax.run(c.tax_id || '', c.name_en || '', c.name);
    }
  } catch (err) {
    console.warn('[Customers] Note during init:', err.message);
  }

  // Ensure current company profile is always in customers
  try {
    const compSetting = db.prepare("SELECT value FROM company_settings WHERE key = 'company_name'").get();
    const compTax = db.prepare("SELECT value FROM company_settings WHERE key = 'company_tax_id'").get();
    const compEn = db.prepare("SELECT value FROM company_settings WHERE key = 'company_name_en'").get();
    if (compSetting?.value) {
      upsertDbd.run(cleanCompanyName(compSetting.value), compEn?.value || '', compTax?.value || '', 'history');
    }
  } catch (_) {}

  // Automatic migration: clean duplicated "จำกัด จำกัด" and collapse multiple spaces
  try {
    const dirty = db.prepare(`
      SELECT id, name FROM customers 
      WHERE name LIKE '%จำกัด%จำกัด%' OR name LIKE '%  %' OR name LIKE '%(มหาชน)%(มหาชน)%'
    `).all();
    if (dirty && dirty.length > 0) {
      const updateStmt = db.prepare('UPDATE customers SET name = ? WHERE id = ?');
      db.exec('BEGIN TRANSACTION');
      for (const r of dirty) {
        const cleaned = cleanCompanyName(r.name);
        if (cleaned && cleaned !== r.name) {
          try {
            updateStmt.run(cleaned, r.id);
          } catch (_) {
            db.prepare('DELETE FROM customers WHERE id = ?').run(r.id);
          }
        }
      }
      db.exec('COMMIT');
    }
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
  }
}
initCustomersTable();

function searchOnlineDBD(query) {
  return new Promise((resolve) => {
    if (!query || query.trim().length < 2) return resolve([]);
    const https = require('node:https');
    const url = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=10`;
    const req = https.get(url, { headers: { 'User-Agent': 'activeASSET/2.0' }, timeout: 3500 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = [];
          if (json.success && json.result?.results) {
            for (const item of json.result.results) {
              const name = String(item.title || item.name || '').trim();
              if (name && (name.includes('บริษัท') || name.includes('บจก') || name.includes('ห้าง') || name.includes('จำกัด'))) {
                results.push({ name, tax_id: '', source: 'dbd' });
              }
            }
          }
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      try { req.destroy(); } catch (_) {}
      resolve([]);
    });
  });
}

try {
  db.exec(`ALTER TABLE loans ADD COLUMN customer_phone TEXT DEFAULT ''`);
} catch (e) {
  // column already exists
}

try {
  db.exec(`ALTER TABLE loans ADD COLUMN customer_email TEXT DEFAULT ''`);
} catch (e) {
  // column already exists
}

try {
  db.exec(`ALTER TABLE loan_items ADD COLUMN attachments_json TEXT DEFAULT '[]'`);
} catch (e) {
  // column already exists
}

function mapV1Source(src) {
  if (src === 'Supplier') return 'Supplier';
  if (src === 'Sales_Stock' || src === 'คลังขาย') return 'คลังขาย';
  if (src === 'ทดแทนระหว่างซ่อม' || src === 'Replacement') return 'ทดแทนระหว่างซ่อม';
  return 'Demo';
}

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateStr(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'number') {
    const dt = new Date(val);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const s = String(val);
  if (s.length >= 10 && s.includes('-')) return s.slice(0, 10);
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return fallback;
}

function seedFromV1IfNeeded() {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM assets').get();
  if (countRow && countRow.c > 0) return;

  const v1DbFile = path.join(__dirname, 'v1_reference.db');
  if (fs.existsSync(v1DbFile)) {
    const v1 = new DatabaseSync(v1DbFile, { readOnly: true });
    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Migrate all 158 AssetUnits from v1
      const v1Assets = v1.prepare(`
        SELECT a.tagId, a.serialNo, a.source, a.status, a.registeredAccessories, a.notes,
               c.model, c.brand, c.category, c.defaultSpecs, c.defaultAccessories,
               l.name as locName
        FROM AssetUnit a
        LEFT JOIN ProductCatalog c ON a.catalogId = c.id
        LEFT JOIN Location l ON a.locationId = l.id
        ORDER BY a.tagId ASC
      `).all();

      const insertAsset = db.prepare(`
        INSERT OR IGNORE INTO assets (
          tag_id, name, model, brand, category, serial_no,
          source, location, accessories_json, free_note, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')
      `);

      for (const a of v1Assets) {
        let acc = [];
        try {
          acc = JSON.parse(a.registeredAccessories || a.defaultAccessories || '[]');
        } catch {
          acc = [];
        }
        // Filter out redundant self-model name tag if present, or keep clean tags
        acc = acc.filter(Boolean);
        const source = mapV1Source(a.source);
        const location = a.locName || (source === 'คลังขาย' ? 'คลังขาย (Sales Stock)' : source === 'Supplier' ? 'คลัง Supplier' : source === 'ทดแทนระหว่างซ่อม' ? 'เครื่องสำรองระหว่างซ่อม (Repair Swap)' : 'Mobile Computer ตู้ A1');

        insertAsset.run(
          a.tagId,
          `${a.brand || ''} ${a.model || ''}`.trim(),
          a.model || '',
          a.brand || '',
          a.category || 'Mobile Computer',
          a.serialNo || '-',
          source,
          location,
          JSON.stringify(acc),
          a.notes || ''
        );
      }

      // 2. Migrate LoanTransactions from v1 so the Kanban columns match activeASSET v1 immediately
      const v1Loans = v1.prepare(`
        SELECT * FROM LoanTransaction
        WHERE status IN ('Requested', 'Dispatching', 'Dispatched', 'Delivered', 'Partially_Returned', 'Returned')
        ORDER BY docNo ASC
      `).all();

      const insertLoan = db.prepare(`
        INSERT OR IGNORE INTO loans (
          id, customer_name, customer_company, borrower_name, borrower_phone,
          purpose, checkout_date, due_date, return_date, status, created_at
        ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)
      `);

      const insertLoanItem = db.prepare(`
        INSERT INTO loan_items (
          loan_id, tag_id, model, brand, serial_no,
          source_snapshot, location_snapshot, loan_accessories_json, loan_free_note,
          returned, returned_at, returned_accessories_json, missing_accessories_json, qc_status, qc_note, returned_to_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, '', ?)
      `);

      for (const l of v1Loans) {
        const checkoutDate = toDateStr(l.checkoutDate || l.requestedAt, getTodayStr());
        const dueDate = toDateStr(l.expectedReturnDate, getTodayStr());
        const returnDate = toDateStr(l.closedAt, null);

        insertLoan.run(
          l.docNo,
          l.customerName || '',
          l.customerCompany || '',
          l.salesRepName || 'พนักงานขาย',
          l.purpose || 'Demo',
          checkoutDate,
          dueDate,
          returnDate,
          l.status,
          checkoutDate
        );

        // Get actual LoanLineItems
        const v1Lines = v1.prepare(`
          SELECT li.*, a.serialNo, a.source as assetSource, c.model, c.brand, loc.name as locName
          FROM LoanLineItem li
          LEFT JOIN AssetUnit a ON li.assetTagId = a.tagId
          LEFT JOIN ProductCatalog c ON a.catalogId = c.id
          LEFT JOIN Location loc ON a.locationId = loc.id
          WHERE li.loanDocNo = ?
        `).all(l.docNo);

        if (v1Lines.length > 0) {
          for (const li of v1Lines) {
            if (!li.assetTagId) continue;
            let acc = [];
            try {
              acc = JSON.parse(li.accessoriesHandedOver || '[]');
            } catch {
              acc = [];
            }
            const isReturned = li.status === 'Returned' || Boolean(li.returnedAt);
            const src = mapV1Source(li.source || li.assetSource);
            const loc = li.locName || 'Mobile Computer ตู้ A1';

            insertLoanItem.run(
              l.docNo,
              li.assetTagId,
              li.model || '',
              li.brand || '',
              li.serialNo || '',
              src,
              loc,
              JSON.stringify(acc),
              li.notes || '',
              isReturned ? 1 : 0,
              toDateStr(li.returnedAt, null),
              isReturned ? JSON.stringify(acc) : '[]',
              isReturned ? 'Pass' : null,
              isReturned ? 1 : 0
            );

            if (!isReturned && l.status !== 'Returned') {
              db.prepare(`UPDATE assets SET status = 'On_Loan', current_loan_id = ? WHERE tag_id = ?`).run(l.docNo, li.assetTagId);
            }
          }
        } else {
          // For Requested loans that only had LoanRequestLine in v1, pick available assets of that catalog so every card has concrete rows
          const reqLines = v1.prepare(`
            SELECT rl.*, c.model, c.brand
            FROM LoanRequestLine rl
            LEFT JOIN ProductCatalog c ON rl.catalogId = c.id
            WHERE rl.loanDocNo = ?
          `).all(l.docNo);

          for (const rl of reqLines) {
            const avail = db.prepare(`
              SELECT * FROM assets WHERE model = ? AND status = 'Available' LIMIT ?
            `).all(rl.model, rl.quantity || 1);

            for (const asset of avail) {
              insertLoanItem.run(
                l.docNo,
                asset.tag_id,
                asset.model,
                asset.brand,
                asset.serial_no,
                asset.source,
                asset.location,
                asset.accessories_json,
                rl.notes || '',
                0,
                null,
                '[]',
                null,
                0
              );
              db.prepare(`UPDATE assets SET status = 'On_Loan', current_loan_id = ? WHERE tag_id = ?`).run(l.docNo, asset.tag_id);
            }
          }
        }
      }

      db.exec('COMMIT');
      console.log(`Seeded ${v1Assets.length} assets and ${v1Loans.length} loans from activeASSET v1.`);
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('Seed from v1 error:', err);
    } finally {
      v1.close();
    }
  }
}

seedFromV1IfNeeded();

function seedMasterDataIfNeeded() {
  try {
    // 1. Seed product_catalogs if empty
    const catCount = db.prepare('SELECT COUNT(*) as c FROM product_catalogs').get()?.c || 0;
    if (catCount === 0) {
      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO product_catalogs (brand, model, category, default_specs, default_accessories)
        VALUES (?, ?, ?, ?, ?)
      `);

      const v1DbFile = path.join(__dirname, 'v1_reference.db');
      if (fs.existsSync(v1DbFile)) {
        try {
          const v1 = new DatabaseSync(v1DbFile, { readOnly: true });
          const v1Cats = v1.prepare('SELECT * FROM ProductCatalog').all();
          for (const c of v1Cats) {
            insertCat.run(c.brand || 'Unknow', c.model, c.category || 'Mobile Computer', c.defaultSpecs || '', c.defaultAccessories || '[]');
          }
          v1.close();
        } catch (_) {}
      }

      // Also ensure all distinct models currently in assets are in product_catalogs
      const assetModels = db.prepare("SELECT DISTINCT brand, model, category FROM assets WHERE model != ''").all();
      for (const m of assetModels) {
        insertCat.run(m.brand || 'Unknow', m.model, m.category || 'Mobile Computer', '', '[]');
      }
    }

    // 2. Seed master_options if empty
    const optCount = db.prepare('SELECT COUNT(*) as c FROM master_options').get()?.c || 0;
    if (optCount === 0) {
      const insertOpt = db.prepare(`
        INSERT OR IGNORE INTO master_options (type, name, sort_order)
        VALUES (?, ?, ?)
      `);

      // Categories
      const categories = db.prepare("SELECT DISTINCT category FROM assets WHERE category != ''").all();
      categories.forEach((c, idx) => insertOpt.run('category', c.category, idx));

      // Brands
      const brands = db.prepare("SELECT DISTINCT brand FROM assets WHERE brand != ''").all();
      brands.forEach((b, idx) => insertOpt.run('brand', b.brand, idx));

      // Locations
      const locations = db.prepare("SELECT DISTINCT location FROM assets WHERE location != ''").all();
      locations.forEach((l, idx) => insertOpt.run('location', l.location, idx));

      // Preset Accessories
      const PRESET_ACCS = ['สาย USB', 'Power Adapter', 'Power Cord', 'แบตเตอรี่', 'Cradle / แท่นชาร์จ', 'ขาตั้ง Stand', 'สายสะพาย', 'เคสกันกระแทก', 'ปากกา Stylus'];
      PRESET_ACCS.forEach((a, idx) => insertOpt.run('accessory', a, idx));
    }

    // 3. Enrich customer contact info from v1 if present
    const v1DbFile = path.join(__dirname, 'v1_reference.db');
    if (fs.existsSync(v1DbFile)) {
      try {
        const v1 = new DatabaseSync(v1DbFile, { readOnly: true });
        const v1Custs = v1.prepare('SELECT * FROM Customer').all();
        for (const c of v1Custs) {
          const custName = c.company || c.name;
          const existing = db.prepare('SELECT * FROM customers WHERE name = ?').get(custName);
          if (existing) {
            db.prepare(`
              UPDATE customers 
              SET contact_name = COALESCE(NULLIF(contact_name, ''), ?),
                  phone = COALESCE(NULLIF(phone, ''), '')
              WHERE id = ?
            `).run(c.name || '', c.phone || '', existing.id);
          } else {
            db.prepare(`
              INSERT OR IGNORE INTO customers (name, contact_name, phone, source)
              VALUES (?, ?, ?, 'custom')
            `).run(custName, c.name || '', c.phone || '');
          }
        }
        v1.close();
      } catch (_) {}
    }
  } catch (err) {
    console.error('seedMasterDataIfNeeded error:', err);
  }
}

seedMasterDataIfNeeded();

function saveBase64Image(dataUrl, prefix = 'photo') {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  if (dataUrl.startsWith('/uploads/')) return dataUrl;
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!match) return '';
  const ext = match[1] === 'png' ? 'png' : match[1] === 'webp' ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

function daysUntil(dueDateStr, todayStr) {
  const due = new Date(dueDateStr.slice(0, 10) + 'T00:00:00');
  const today = new Date(todayStr.slice(0, 10) + 'T00:00:00');
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function getFullState() {
  const today = getTodayStr();
  const rawAssets = db.prepare('SELECT * FROM assets ORDER BY tag_id ASC').all();
  const rawLoans = db.prepare('SELECT * FROM loans ORDER BY id ASC').all();
  const rawLoanItems = db.prepare('SELECT * FROM loan_items ORDER BY id ASC').all();

  const itemsByLoan = new Map();
  for (const li of rawLoanItems) {
    const parsed = {
      ...li,
      loan_accessories: JSON.parse(li.loan_accessories_json || '[]'),
      returned_accessories: JSON.parse(li.returned_accessories_json || '[]'),
      missing_accessories: JSON.parse(li.missing_accessories_json || '[]'),
      attachments: JSON.parse(li.attachments_json || '[]'),
      returned: Boolean(li.returned),
      returned_to_location: Boolean(li.returned_to_location)
    };
    if (!itemsByLoan.has(li.loan_id)) itemsByLoan.set(li.loan_id, []);
    itemsByLoan.get(li.loan_id).push(parsed);
  }

  const loansMap = new Map();
  const loans = rawLoans.map(l => {
    const items = itemsByLoan.get(l.id) || [];
    const days = daysUntil(l.due_date, today);
    const isOverdue = ['Delivered', 'Partially_Returned'].includes(l.status) && days < 0;
    const isDueSoon = ['Delivered', 'Partially_Returned'].includes(l.status) && days >= 0 && days <= 3;

    // Match activeASSET v1 exact columns & sub-groups:
    // Column 1: requesting ('รอจัดของ') -> subGroup 'Requested' ('รอจัด') | 'Dispatching' ('กำลังจัด')
    // Column 2: dispatched ('รอส่งมอบ') -> subGroup 'Dispatched' ('รอส่งมอบ')
    // Column 3: in-use ('กำลังยืม') -> subGroup 'Delivered' ('กำลังยืม', days >= 0)
    // Column 4: overdue-and-partial ('เกินกำหนด / คืนไม่ครบ') -> subGroup 'Overdue' ('เกินกำหนด') | 'Partially_Returned' ('คืนไม่ครบ')
    // Column 5 (optional/history): returned ('คืนครบแล้ว')
    let mainColumn = 'in-use';
    let subGroup = 'Delivered';

    if (l.status === 'Requested') {
      mainColumn = 'requesting';
      subGroup = 'Requested';
    } else if (l.status === 'Dispatching') {
      mainColumn = 'requesting';
      subGroup = 'Dispatching';
    } else if (l.status === 'Dispatched') {
      mainColumn = 'dispatched';
      subGroup = 'Dispatched';
    } else if (l.status === 'Delivered') {
      if (days < 0) {
        mainColumn = 'overdue-and-partial';
        subGroup = 'Overdue';
      } else {
        mainColumn = 'in-use';
        subGroup = 'Delivered';
      }
    } else if (l.status === 'Pending_QC') {
      mainColumn = 'qc';
      subGroup = 'Pending_QC';
    } else if (l.status === 'Pending_Return_Supplier_Sale') {
      mainColumn = 'supplier-sale-return';
      subGroup = 'Pending_Supplier_Return';
    } else if (l.status === 'Partially_Returned') {
      mainColumn = 'overdue-and-partial';
      subGroup = days < 0 ? 'Overdue' : 'Partially_Returned';
    } else if (l.status === 'Returned') {
      mainColumn = 'returned';
      subGroup = 'Returned';
    }

    const totalItems = items.length;
    const returnedCount = items.filter(i => i.returned).length;

    const loanObj = {
      ...l,
      before_photos: JSON.parse(l.before_photos_json || '[]'),
      after_photos: JSON.parse(l.after_photos_json || '[]'),
      delivery_photos: JSON.parse(l.delivery_photos_json || '[]'),
      supplier_return_photos: JSON.parse(l.supplier_return_photos_json || '[]'),
      sale_return_action: JSON.parse(l.sale_return_action_json || '{}'),
      items,
      days_until: days,
      is_overdue: isOverdue,
      overdue_days: isOverdue ? Math.abs(days) : 0,
      is_due_soon: isDueSoon,
      main_column: mainColumn,
      sub_group: subGroup,
      total_items: totalItems,
      returned_items: returnedCount
    };
    loansMap.set(l.id, loanObj);
    return loanObj;
  });

  const allTagSuggestions = new Set([
    'แบตเตอรี่',
    'Power Adapter',
    'Power Cord',
    'USB Cable',
    'USB-C Cable',
    'Cradle',
    'Stand',
    'สายคล้องมือ',
    'กล่อง',
    'Ribbon Core 1"',
    'Adapter 24V'
  ]);
  const allLocations = new Set();

  function isMainUnitTag(t) {
    if (!t) return false;
    const str = String(t).trim();
    return str.startsWith('เครื่อง') || str.startsWith('สแกนเนอร์') || str === 'iPad 10th' || str === 'Galaxy Tab A9';
  }

  const assets = rawAssets.map(a => {
    const rawAccessories = JSON.parse(a.accessories_json || '[]');
    const accessories = rawAccessories.filter(t => !isMainUnitTag(t));
    const missingTags = JSON.parse(a.missing_tags_json || '[]');
    accessories.forEach(t => allTagSuggestions.add(t));
    if (a.location) allLocations.add(a.location);

    let activeLoan = null;
    if (a.current_loan_id && loansMap.has(a.current_loan_id)) {
      const loan = loansMap.get(a.current_loan_id);
      activeLoan = {
        id: loan.id,
        borrower_name: loan.borrower_name,
        customer_name: loan.customer_name,
        customer_company: loan.customer_company,
        due_date: loan.due_date,
        status: loan.status
      };
    }

    let images = [];
    try {
      images = a.images_json ? JSON.parse(a.images_json) : [];
    } catch (e) {
      images = [];
    }
    if (images.length === 0 && a.image_url) {
      images = [a.image_url];
    }

    return {
      ...a,
      image_url: images[0] || a.image_url || '',
      images,
      accessories,
      missing_tags: missingTags,
      active_loan: activeLoan
    };
  });

  // Build Model Catalog summary from assets for model-only selection when creating a loan
  const catalogMap = new Map();
  for (const a of assets) {
    if (a.status === 'Disposed') continue; // Disposed assets cannot be requested for loan
    const key = `${a.brand}||${a.model}`;
    if (!catalogMap.has(key)) {
      catalogMap.set(key, {
        brand: a.brand,
        model: a.model,
        category: a.category,
        default_accessories: a.accessories || [],
        total_count: 0,
        available_count: 0
      });
    }
    const entry = catalogMap.get(key);
    entry.total_count++;
    if (a.status === 'Available') entry.available_count++;
    if (entry.default_accessories.length === 0 && a.accessories && a.accessories.length > 0) {
      entry.default_accessories = a.accessories;
    }
  }

  return {
    today,
    assets,
    catalogs: [...catalogMap.values()],
    loans,
    accessorySuggestions: [...allTagSuggestions],
    locations: [...allLocations],
    companySettings: getCompanySettings(),
    roles: getAllRoles(),
    permissionKeys: PERMISSION_KEYS,
    users: db.prepare("SELECT email, name, role FROM users WHERE status = 'active'").all(),
    version: appStateVersion
  };
}

function generateNextLoanId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `LOAN-${y}${m}-`;
  const rows = db.prepare(`SELECT id FROM loans WHERE id LIKE ?`).all(`${prefix}%`);
  let maxSeq = 0;
  for (const r of rows) {
    const parts = r.id.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

function getNextActTagId() {
  const rows = db.prepare("SELECT tag_id FROM assets WHERE tag_id LIKE 'ACT-%'").all();
  let maxNum = 0;
  for (const r of rows) {
    const match = r.tag_id.match(/^ACT-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `ACT-${String(maxNum + 1).padStart(3, '0')}`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    if (pathname === '/api/state' && req.method === 'GET') {
      return sendJson(res, 200, getFullState());
    }

    // Lightweight Real-time Sync & Heartbeat (< 1ms execution, ~50 bytes response)
    if (pathname === '/api/sync/heartbeat' && req.method === 'GET') {
      const clientVer = parseInt(urlObj.searchParams.get('v') || '0', 10);
      const clientEmail = (urlObj.searchParams.get('user') || '').trim().toLowerCase();

      // Real-time verification of user session validity
      if (clientEmail) {
        const isDel = db.prepare('SELECT 1 FROM deleted_users WHERE email = ?').get(clientEmail);
        if (isDel) {
          return sendJson(res, 200, { valid: false, reason: 'deleted', error: 'บัญชีผู้ใช้นี้ถูกลบออกจากระบบแล้ว' });
        }
        const u = db.prepare('SELECT status FROM users WHERE email = ?').get(clientEmail);
        if (!u) {
          return sendJson(res, 200, { valid: false, reason: 'not_found', error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
        }
        if (u.status === 'disabled') {
          return sendJson(res, 200, { valid: false, reason: 'disabled', error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานแล้ว' });
        }
      }

      const hasChanged = clientVer !== appStateVersion;
      return sendJson(res, 200, {
        valid: true,
        changed: hasChanged,
        v: appStateVersion,
        latestLoan: hasChanged ? lastCreatedLoan : null
      });
    }

    // Explicit User Verification on App Startup
    if (pathname === '/api/auth/verify' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        return sendJson(res, 400, { success: false, valid: false, error: 'กรุณาระบุอีเมล' });
      }

      const isDel = db.prepare('SELECT 1 FROM deleted_users WHERE email = ?').get(email);
      if (isDel) {
        return sendJson(res, 401, { success: false, valid: false, reason: 'deleted', error: 'บัญชีผู้ใช้นี้ถูกลบออกจากระบบแล้ว' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return sendJson(res, 401, { success: false, valid: false, reason: 'not_found', error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
      }

      if (user.status === 'disabled') {
        return sendJson(res, 401, { success: false, valid: false, reason: 'disabled', error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
      }

      return sendJson(res, 200, {
        success: true,
        valid: true,
        user: getUserWithRole(email)
      });
    }

    // Company / Issuer Settings
    if (pathname === '/api/company-settings' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, settings: getCompanySettings() });
    }

    if (pathname === '/api/company-settings' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.dispatcher_signature && typeof body.dispatcher_signature === 'string' && body.dispatcher_signature.startsWith('data:image/')) {
        body.dispatcher_signature = saveBase64Image(body.dispatcher_signature, 'dispatcher-sig');
      }
      const upsert = db.prepare(`
        INSERT INTO company_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      db.exec('BEGIN TRANSACTION');
      try {
        for (const [k, v] of Object.entries(body)) {
          if (typeof v === 'string') {
            upsert.run(k, v);
          }
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 500, { error: err.message });
      }
      return sendJson(res, 200, { success: true, settings: getCompanySettings() });
    }

    // Auth & Google Workspace Config
    if (pathname === '/api/auth/config' && req.method === 'GET') {
      const settings = getCompanySettings();
      return sendJson(res, 200, {
        require_login: settings.auth_require_login !== '0',
        allowed_domains: settings.auth_allowed_domains || 'active5.co.th',
        google_client_id: settings.auth_google_client_id || ''
      });
    }

    // Auth Users List (Directory)
    if (pathname === '/api/auth/users' && req.method === 'GET') {
      const users = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
      const enriched = users.map(u => getUserWithRole(u.email));
      return sendJson(res, 200, { success: true, users: enriched });
    }

    // -------------------------------------------------------------
    // Roles & Permissions API
    // -------------------------------------------------------------
    if (pathname === '/api/roles' && req.method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        roles: getAllRoles(),
        permissionKeys: PERMISSION_KEYS
      });
    }

    if (pathname === '/api/roles' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let roleId = String(body.id || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      const name = String(body.name || '').trim();
      const description = String(body.description || '').trim();
      const permissions = typeof body.permissions === 'object' && body.permissions !== null ? body.permissions : {};

      if (!name) {
        return sendJson(res, 400, { error: 'กรุณาระบุชื่อบทบาท (Role Name)' });
      }

      if (!roleId) {
        roleId = 'role-' + Date.now();
      }

      // If updating system admin, protect critical permissions
      if (roleId === 'admin') {
        permissions.manage_settings = true;
        permissions.manage_roles = true;
      }

      const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
      if (existing) {
        db.prepare(`
          UPDATE roles
          SET name = ?,
              description = ?,
              permissions_json = ?,
              updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(name, description, JSON.stringify(permissions), roleId);
      } else {
        db.prepare(`
          INSERT INTO roles (id, name, description, is_system, permissions_json)
          VALUES (?, ?, ?, 0, ?)
        `).run(roleId, name, description, JSON.stringify(permissions));
      }

      return sendJson(res, 200, {
        success: true,
        message: existing ? `บันทึกการแก้ไขบทบาท "${name}" เรียบร้อยแล้ว` : `สร้างบทบาท "${name}" เรียบร้อยแล้ว`,
        roles: getAllRoles(),
        role: getRoleById(roleId)
      });
    }

    if (pathname.match(/^\/api\/roles\/[^/]+$/) && req.method === 'DELETE') {
      const roleId = pathname.split('/')[3];
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
      if (!role) {
        return sendJson(res, 404, { error: 'ไม่พบบทบาทนี้' });
      }
      if (role.is_system === 1 || roleId === 'admin' || roleId === 'user') {
        return sendJson(res, 400, { error: 'ไม่สามารถลบบทบาทมาตรฐานของระบบ (admin หรือ user) ได้' });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        // Reassign all users with this role to 'user'
        db.prepare("UPDATE users SET role = 'user' WHERE role = ?").run(roleId);
        db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 500, { error: 'ลบบทบาทไม่สำเร็จ: ' + err.message });
      }

      return sendJson(res, 200, {
        success: true,
        message: `ลบบทบาท ${role.name} เรียบร้อยแล้ว (ผู้ใช้ที่เคยมีบทบาทนี้ถูกปรับเป็น User)`,
        roles: getAllRoles()
      });
    }

    // -------------------------------------------------------------
    // Users Role Assignment API
    // -------------------------------------------------------------
    if (pathname === '/api/users' && req.method === 'GET') {
      const users = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
      const enriched = users.map(u => getUserWithRole(u.email));
      return sendJson(res, 200, { success: true, users: enriched });
    }

    if (pathname.match(/^\/api\/users\/[^/]+\/role$/) && req.method === 'PATCH') {
      const email = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      const newRoleId = String(body.role || '').trim();

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) return sendJson(res, 404, { error: 'ไม่พบผู้ใช้นี้ในระบบ' });

      const roleObj = db.prepare('SELECT * FROM roles WHERE id = ?').get(newRoleId);
      if (!roleObj) return sendJson(res, 400, { error: `ไม่พบบทบาท "${newRoleId}" ในระบบ` });

      // Protect at least one admin existing
      if (user.role === 'admin' && newRoleId !== 'admin') {
        const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get();
        if (adminCount.cnt <= 1) {
          return sendJson(res, 400, { error: 'ต้องมีผู้ดูแลระบบ (Admin) อย่างน้อย 1 คนในระบบ' });
        }
      }

      db.prepare('UPDATE users SET role = ? WHERE email = ?').run(newRoleId, email);
      notifyStateChange('user_role', { email, role: newRoleId });
      return sendJson(res, 200, {
        success: true,
        message: `เปลี่ยนบทบาทของ ${user.name} เป็น ${roleObj.name} เรียบร้อยแล้ว`,
        user: getUserWithRole(email),
        users: db.prepare('SELECT * FROM users ORDER BY name ASC').all().map(u => getUserWithRole(u.email))
      });
    }

    if (pathname.match(/^\/api\/users\/[^/]+\/status$/) && req.method === 'PATCH') {
      const email = decodeURIComponent(pathname.split('/')[3]);
      const body = await parseJsonBody(req);
      const newStatus = body.status === 'disabled' ? 'disabled' : 'active';

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) return sendJson(res, 404, { error: 'ไม่พบผู้ใช้นี้ในระบบ' });

      // Protect last active admin from being disabled
      if (user.role === 'admin' && newStatus === 'disabled') {
        const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND (status IS NULL OR status != 'disabled')").get();
        if (adminCount.cnt <= 1) {
          return sendJson(res, 400, { error: 'ไม่สามารถระงับการใช้งานผู้ดูแลระบบ (Admin) ที่เปิดใช้งานอยู่คนสุดท้ายได้' });
        }
      }

      db.prepare('UPDATE users SET status = ? WHERE email = ?').run(newStatus, email);
      notifyStateChange('user_status', { email, status: newStatus });
      return sendJson(res, 200, {
        success: true,
        message: newStatus === 'disabled'
          ? `ระงับการใช้งานของ ${user.name} เรียบร้อยแล้ว`
          : `เปิดใช้งานบัญชีของ ${user.name} เรียบร้อยแล้ว`,
        user: getUserWithRole(email),
        users: db.prepare('SELECT * FROM users ORDER BY name ASC').all().map(u => getUserWithRole(u.email))
      });
    }

    if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'DELETE') {
      const email = decodeURIComponent(pathname.split('/')[3]);

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) return sendJson(res, 404, { error: 'ไม่พบผู้ใช้นี้ในระบบ' });

      // Protect last admin from being deleted
      if (user.role === 'admin') {
        const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get();
        if (adminCount.cnt <= 1) {
          return sendJson(res, 400, { error: 'ไม่สามารถลบผู้ดูแลระบบ (Admin) คนสุดท้ายของระบบได้' });
        }
      }

      // Record in deleted_users blacklist so they cannot auto-recreate account or bypass login
      db.prepare("INSERT OR REPLACE INTO deleted_users (email, deleted_at) VALUES (?, datetime('now', 'localtime'))").run(email);
      db.prepare('DELETE FROM users WHERE email = ?').run(email);
      notifyStateChange('user_deleted', { email });
      return sendJson(res, 200, {
        success: true,
        message: `ลบผู้ใช้งาน ${user.name} (${email}) ออกจากระบบเรียบร้อยแล้ว`,
        users: db.prepare('SELECT * FROM users ORDER BY name ASC').all().map(u => getUserWithRole(u.email))
      });
    }

    // =============================================================
    // MASTER DATA (ข้อมูลหลัก) APIs
    // =============================================================

    // 1. Master Data Summary Counts
    if (pathname === '/api/master/summary' && req.method === 'GET') {
      const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get()?.c || 0;
      const catCount = db.prepare('SELECT COUNT(*) as c FROM product_catalogs').get()?.c || 0;
      const catOptCount = db.prepare("SELECT COUNT(*) as c FROM master_options WHERE type = 'category'").get()?.c || 0;
      const brandOptCount = db.prepare("SELECT COUNT(*) as c FROM master_options WHERE type = 'brand'").get()?.c || 0;
      const locOptCount = db.prepare("SELECT COUNT(*) as c FROM master_options WHERE type = 'location'").get()?.c || 0;
      const accOptCount = db.prepare("SELECT COUNT(*) as c FROM master_options WHERE type = 'accessory'").get()?.c || 0;

      return sendJson(res, 200, {
        success: true,
        counts: {
          customers: custCount,
          catalogs: catCount,
          categories: catOptCount,
          brands: brandOptCount,
          locations: locOptCount,
          accessories: accOptCount
        }
      });
    }

    // 2. Customers List & Search (Paginated)
    if (pathname === '/api/master/customers' && req.method === 'GET') {
      const q = (urlObj.searchParams.get('q') || '').trim();
      const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(5, parseInt(urlObj.searchParams.get('limit') || '25', 10)));
      const offset = (page - 1) * limit;

      let whereSql = '';
      let countSql = 'SELECT COUNT(*) as c FROM customers';
      let dataSql = 'SELECT * FROM customers';
      const params = [];

      if (q) {
        const qClean = q.trim();
        const qNoSpace = qClean.replace(/\s+/g, '');
        const qDigits = qClean.replace(/\D/g, '');
        const like = `%${qClean}%`;

        const conds = [
          'name LIKE ?',
          'name_en LIKE ?',
          'tax_id LIKE ?',
          'contact_name LIKE ?',
          'phone LIKE ?',
          'email LIKE ?'
        ];
        params.push(like, like, like, like, like, like);

        if (qNoSpace && qNoSpace.length >= 2) {
          conds.push("REPLACE(name, ' ', '') LIKE ?", "REPLACE(name_en, ' ', '') LIKE ?");
          params.push(`%${qNoSpace}%`, `%${qNoSpace}%`);
        }

        if (qDigits && qDigits.length >= 3) {
          conds.push("REPLACE(REPLACE(tax_id, '-', ''), ' ', '') LIKE ?");
          params.push(`%${qDigits}%`);
        }

        // Add search synonyms (e.g. planet <-> แพลนเนท)
        const synonyms = getSearchSynonyms(qClean);
        for (const s of synonyms) {
          if (s !== qClean && s !== qNoSpace) {
            conds.push('name LIKE ?', 'name_en LIKE ?');
            params.push(`%${s}%`, `%${s}%`);
          }
        }

        whereSql = ' WHERE ' + conds.join(' OR ');
      }

      const total = db.prepare(countSql + whereSql).get(...params)?.c || 0;
      const orderSql = ` ORDER BY CASE WHEN source = 'custom' THEN 0 WHEN source = 'history' THEN 1 ELSE 2 END, id DESC LIMIT ? OFFSET ?`;
      const customers = db.prepare(dataSql + whereSql + orderSql).all(...params, limit, offset);
      customers.forEach(c => { if (c.name) c.name = cleanCompanyName(c.name); });

      return sendJson(res, 200, {
        success: true,
        customers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    }

    // 3. Create Customer
    if (pathname === '/api/master/customers' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const name = cleanCompanyName((body.name || '').trim());
      if (!name) return sendJson(res, 400, { error: 'กรุณาระบุชื่อลูกค้าหรือชื่อบริษัท' });

      const name_en = (body.name_en || '').trim();
      const tax_id = (body.tax_id || '').trim();
      const branch = (body.branch || 'สำนักงานใหญ่').trim();
      const address = (body.address || '').trim();
      const contact_name = (body.contact_name || '').trim();
      const phone = (body.phone || '').trim();
      const email = (body.email || '').trim().toLowerCase();

      const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(name);
      if (existing) {
        return sendJson(res, 400, { error: `มีลูกค้ารายชื่อ "${name}" อยู่ในระบบแล้ว` });
      }

      const info = db.prepare(`
        INSERT INTO customers (name, name_en, tax_id, branch, address, contact_name, phone, email, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom')
      `).run(name, name_en, tax_id, branch, address, contact_name, phone, email);

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { success: true, customer, message: 'เพิ่มข้อมูลลูกค้าเรียบร้อยแล้ว' });
    }

    // 4. Update Customer
    if (pathname.match(/^\/api\/master\/customers\/\d+$/) && req.method === 'PUT') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบข้อมูลลูกค้ารายนี้' });

      const body = await parseJsonBody(req);
      const name = cleanCompanyName((body.name || '').trim()) || cleanCompanyName(existing.name);
      const name_en = body.name_en !== undefined ? String(body.name_en).trim() : existing.name_en;
      const tax_id = body.tax_id !== undefined ? String(body.tax_id).trim() : existing.tax_id;
      const branch = body.branch !== undefined ? String(body.branch).trim() : existing.branch;
      const address = body.address !== undefined ? String(body.address).trim() : existing.address;
      const contact_name = body.contact_name !== undefined ? String(body.contact_name).trim() : existing.contact_name;
      const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
      const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email;

      db.prepare(`
        UPDATE customers
        SET name = ?, name_en = ?, tax_id = ?, branch = ?, address = ?, contact_name = ?, phone = ?, email = ?
        WHERE id = ?
      `).run(name, name_en, tax_id, branch, address, contact_name, phone, email, id);

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, customer: updated, message: 'บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว' });
    }

    // 5. Delete Customer
    if (pathname.match(/^\/api\/master\/customers\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบข้อมูลลูกค้ารายนี้' });

      // Check if used in any loans
      const loanCount = db.prepare('SELECT COUNT(*) as c FROM loans WHERE customer_name = ? OR customer_company = ?').get(existing.name, existing.name)?.c || 0;
      if (loanCount > 0) {
        return sendJson(res, 400, { error: `ไม่สามารถลบลูกค้ารายนี้ได้ เนื่องจากมีประวัติการยืมในระบบ (พบ ${loanCount} ใบยืม)` });
      }

      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      return sendJson(res, 200, { success: true, message: `ลบข้อมูลลูกค้า "${existing.name}" เรียบร้อยแล้ว` });
    }

    // 6. Product Catalogs List
    if (pathname === '/api/master/catalogs' && req.method === 'GET') {
      const q = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
      const category = (urlObj.searchParams.get('category') || '').trim();
      const brand = (urlObj.searchParams.get('brand') || '').trim();

      const conds = [];
      const params = [];
      if (q) {
        conds.push('(LOWER(c.model) LIKE ? OR LOWER(c.brand) LIKE ? OR LOWER(c.category) LIKE ? OR LOWER(c.default_specs) LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      if (category) {
        conds.push('c.category = ?');
        params.push(category);
      }
      if (brand) {
        conds.push('c.brand = ?');
        params.push(brand);
      }

      const whereSql = conds.length > 0 ? ` WHERE ${conds.join(' AND ')}` : '';
      const sql = `
        SELECT c.*, 
               (SELECT COUNT(*) FROM assets a WHERE a.model = c.model AND a.status != 'Disposed') as asset_count
        FROM product_catalogs c
        ${whereSql}
        ORDER BY c.brand ASC, c.model ASC
      `;
      const catalogs = db.prepare(sql).all(...params);

      return sendJson(res, 200, { success: true, catalogs });
    }

    // 7. Create Product Catalog
    if (pathname === '/api/master/catalogs' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const model = (body.model || '').trim();
      const brand = (body.brand || '').trim();
      const category = (body.category || 'Mobile Computer').trim();
      const default_specs = (body.default_specs || '').trim();
      let default_accessories = '[]';
      if (Array.isArray(body.default_accessories)) {
        default_accessories = JSON.stringify(body.default_accessories);
      } else if (typeof body.default_accessories === 'string') {
        default_accessories = body.default_accessories.trim() || '[]';
      }

      if (!model) return sendJson(res, 400, { error: 'กรุณาระบุชื่อรุ่นสินค้า (Model)' });
      if (!brand) return sendJson(res, 400, { error: 'กรุณาระบุยี่ห้อสินค้า (Brand)' });

      const existing = db.prepare('SELECT id FROM product_catalogs WHERE model = ?').get(model);
      if (existing) {
        return sendJson(res, 400, { error: `มีรุ่นสินค้า "${model}" อยู่ในแคตตาล็อกแล้ว` });
      }

      const info = db.prepare(`
        INSERT INTO product_catalogs (brand, model, category, default_specs, default_accessories)
        VALUES (?, ?, ?, ?, ?)
      `).run(brand, model, category, default_specs, default_accessories);

      // Auto ensure brand and category exist in master_options
      db.prepare("INSERT OR IGNORE INTO master_options (type, name) VALUES ('brand', ?)").run(brand);
      db.prepare("INSERT OR IGNORE INTO master_options (type, name) VALUES ('category', ?)").run(category);

      const catalog = db.prepare('SELECT * FROM product_catalogs WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { success: true, catalog, message: 'เพิ่มรุ่นสินค้าใหม่เข้าแคตตาล็อกเรียบร้อยแล้ว' });
    }

    // 8. Update Product Catalog
    if (pathname.match(/^\/api\/master\/catalogs\/\d+$/) && req.method === 'PUT') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM product_catalogs WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบแคตตาล็อกรุ่นนี้' });

      const body = await parseJsonBody(req);
      const model = (body.model || '').trim() || existing.model;
      const brand = (body.brand || '').trim() || existing.brand;
      const category = (body.category || '').trim() || existing.category;
      const default_specs = body.default_specs !== undefined ? String(body.default_specs).trim() : existing.default_specs;
      let default_accessories = existing.default_accessories;
      if (Array.isArray(body.default_accessories)) {
        default_accessories = JSON.stringify(body.default_accessories);
      } else if (typeof body.default_accessories === 'string') {
        default_accessories = body.default_accessories.trim() || '[]';
      }

      // Check unique model
      if (model !== existing.model) {
        const dup = db.prepare('SELECT id FROM product_catalogs WHERE model = ? AND id != ?').get(model, id);
        if (dup) return sendJson(res, 400, { error: `ชื่อรุ่น "${model}" ซ้ำกับรายการอื่นในแคตตาล็อก` });
      }

      db.prepare(`
        UPDATE product_catalogs
        SET brand = ?, model = ?, category = ?, default_specs = ?, default_accessories = ?
        WHERE id = ?
      `).run(brand, model, category, default_specs, default_accessories, id);

      // If model name changed, cascade update to assets if needed
      if (model !== existing.model) {
        try {
          db.prepare('UPDATE assets SET model = ?, brand = ?, category = ? WHERE model = ?').run(model, brand, category, existing.model);
        } catch (_) {}
      }

      const updated = db.prepare('SELECT * FROM product_catalogs WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, catalog: updated, message: 'บันทึกข้อมูลแคตตาล็อกเรียบร้อยแล้ว' });
    }

    // 9. Delete Product Catalog
    if (pathname.match(/^\/api\/master\/catalogs\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM product_catalogs WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบแคตตาล็อกรุ่นนี้' });

      const assetCount = db.prepare('SELECT COUNT(*) as c FROM assets WHERE model = ?').get(existing.model)?.c || 0;
      if (assetCount > 0) {
        return sendJson(res, 400, { error: `ไม่สามารถลบรุ่นนี้ได้ เนื่องจากมีเครื่องในคลังที่ใช้รุ่นนี้อยู่ (${assetCount} เครื่อง)` });
      }

      db.prepare('DELETE FROM product_catalogs WHERE id = ?').run(id);
      return sendJson(res, 200, { success: true, message: `ลบรุ่น "${existing.model}" ออกจากแคตตาล็อกเรียบร้อยแล้ว` });
    }

    // 10. Master Options (Categories, Brands, Locations, Accessories)
    if (pathname === '/api/master/options' && req.method === 'GET') {
      const type = (urlObj.searchParams.get('type') || '').trim();
      let sql = 'SELECT * FROM master_options';
      const params = [];
      if (type) {
        sql += ' WHERE type = ?';
        params.push(type);
      }
      sql += ' ORDER BY type ASC, sort_order ASC, name ASC';
      const options = db.prepare(sql).all(...params);

      // Add asset count for each option
      const enriched = options.map(opt => {
        let count = 0;
        if (opt.type === 'category') {
          count = db.prepare("SELECT COUNT(*) as c FROM assets WHERE category = ? AND status != 'Disposed'").get(opt.name)?.c || 0;
        } else if (opt.type === 'brand') {
          count = db.prepare("SELECT COUNT(*) as c FROM assets WHERE brand = ? AND status != 'Disposed'").get(opt.name)?.c || 0;
        } else if (opt.type === 'location') {
          count = db.prepare("SELECT COUNT(*) as c FROM assets WHERE location = ? AND status != 'Disposed'").get(opt.name)?.c || 0;
        }
        return { ...opt, asset_count: count };
      });

      return sendJson(res, 200, { success: true, options: enriched });
    }

    // 11. Create Master Option
    if (pathname === '/api/master/options' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const type = (body.type || '').trim();
      const name = (body.name || '').trim();
      const code = (body.code || '').trim();

      if (!type || !name) return sendJson(res, 400, { error: 'กรุณาระบุประเภท (type) และชื่อรายการ (name)' });

      const existing = db.prepare('SELECT id FROM master_options WHERE type = ? AND name = ?').get(type, name);
      if (existing) {
        return sendJson(res, 400, { error: `มีรายการ "${name}" อยู่ในประเภทนี้แล้ว` });
      }

      const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM master_options WHERE type = ?').get(type)?.m || 0;
      const info = db.prepare('INSERT INTO master_options (type, name, code, sort_order) VALUES (?, ?, ?, ?)').run(type, name, code, maxSort + 1);

      const option = db.prepare('SELECT * FROM master_options WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { success: true, option, message: `เพิ่มรายการ ${name} เรียบร้อยแล้ว` });
    }

    // 12. Update Master Option
    if (pathname.match(/^\/api\/master\/options\/\d+$/) && req.method === 'PUT') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM master_options WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบรายการนี้' });

      const body = await parseJsonBody(req);
      const name = (body.name || '').trim() || existing.name;
      const code = body.code !== undefined ? String(body.code).trim() : existing.code;

      if (name !== existing.name) {
        const dup = db.prepare('SELECT id FROM master_options WHERE type = ? AND name = ? AND id != ?').get(existing.type, name, id);
        if (dup) return sendJson(res, 400, { error: `มีรายการชื่อ "${name}" ในประเภทนี้อยู่แล้ว` });
      }

      db.prepare('UPDATE master_options SET name = ?, code = ? WHERE id = ?').run(name, code, id);

      // Cascade update to assets if category, brand, or location was renamed
      if (name !== existing.name) {
        try {
          if (existing.type === 'category') {
            db.prepare('UPDATE assets SET category = ? WHERE category = ?').run(name, existing.name);
            db.prepare('UPDATE product_catalogs SET category = ? WHERE category = ?').run(name, existing.name);
          } else if (existing.type === 'brand') {
            db.prepare('UPDATE assets SET brand = ? WHERE brand = ?').run(name, existing.name);
            db.prepare('UPDATE product_catalogs SET brand = ? WHERE brand = ?').run(name, existing.name);
          } else if (existing.type === 'location') {
            db.prepare('UPDATE assets SET location = ? WHERE location = ?').run(name, existing.name);
          }
        } catch (_) {}
      }

      const updated = db.prepare('SELECT * FROM master_options WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, option: updated, message: 'บันทึกเรียบร้อยแล้ว' });
    }

    // 13. Delete Master Option
    if (pathname.match(/^\/api\/master\/options\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[4], 10);
      const existing = db.prepare('SELECT * FROM master_options WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'ไม่พบรายการนี้' });

      // Check if used in assets
      let count = 0;
      if (existing.type === 'category') {
        count = db.prepare('SELECT COUNT(*) as c FROM assets WHERE category = ?').get(existing.name)?.c || 0;
      } else if (existing.type === 'brand') {
        count = db.prepare('SELECT COUNT(*) as c FROM assets WHERE brand = ?').get(existing.name)?.c || 0;
      } else if (existing.type === 'location') {
        count = db.prepare('SELECT COUNT(*) as c FROM assets WHERE location = ?').get(existing.name)?.c || 0;
      }

      if (count > 0) {
        const typeLabel = existing.type === 'category' ? 'หมวดหมู่นี้' : existing.type === 'brand' ? 'ยี่ห้อนี้' : 'สถานที่เก็บนี้';
        return sendJson(res, 400, { error: `ไม่สามารถลบได้ เนื่องจากมีเครื่องในคลังที่ใช้${typeLabel}อยู่ (${count} เครื่อง)` });
      }

      db.prepare('DELETE FROM master_options WHERE id = ?').run(id);
      return sendJson(res, 200, { success: true, message: `ลบรายการ "${existing.name}" เรียบร้อยแล้ว` });
    }

    // Login with Google Workspace / Corporate Email
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let email = (body.email || '').trim().toLowerCase();
      let name = (body.name || '').trim();
      let picture = (body.picture || '').trim();

      // If Google Credential JWT from Google One Tap / Sign In button
      if (body.credential) {
        try {
          const parts = body.credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.email) email = payload.email.trim().toLowerCase();
            if (payload.name) name = payload.name.trim();
            if (payload.picture) picture = payload.picture.trim();
          }
        } catch (e) {
          return sendJson(res, 400, { error: 'รหัสรับรอง Google ID Token ไม่ถูกต้อง' });
        }
      }

      if (!email) {
        return sendJson(res, 400, { error: 'กรุณาระบุอีเมลองค์กรที่ถูกต้อง' });
      }

      // Auto-append @active5.co.th if local username was provided without domain
      if (!email.includes('@')) {
        email = email + '@active5.co.th';
      }

      const emailDomain = email.split('@')[1]?.toLowerCase() || '';
      const settings = getCompanySettings();
      const allowedDomains = (settings.auth_allowed_domains || '')
        .split(',')
        .map(d => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);

      // Ensure active5.co.th is always recognized as valid corporate domain
      if (!allowedDomains.includes('active5.co.th')) {
        allowedDomains.push('active5.co.th');
      }

      // Check Domain Whitelist
      if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
        return sendJson(res, 403, {
          error: `ไม่อนุญาตให้อีเมลจากโดเมน @${emailDomain} เข้าใช้งาน (ระบบจำกัดสิทธิ์เฉพาะบุคลากรภายใน: ${allowedDomains.map(d => '@' + d).join(', ')})`,
          domain: emailDomain,
          allowed_domains: allowedDomains
        });
      }

      // Check if user was explicitly deleted by Admin
      const wasDeleted = db.prepare('SELECT 1 FROM deleted_users WHERE email = ?').get(email);
      if (wasDeleted) {
        return sendJson(res, 403, {
          error: 'บัญชีผู้ใช้นี้ถูกลบออกจากระบบแล้ว ไม่อนุญาตให้เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ (Admin)'
        });
      }

      // If name not provided, lookup from existing or derive
      if (!name) {
        const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (existing && existing.name) {
          name = existing.name;
        } else {
          const localPart = email.split('@')[0];
          name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
        }
      }

      // Resolve user role:
      // 1. If existing user in database, preserve their current role
      // 2. If new user:
      //    - If pre-designated bootstrap admin (admin@active5.co.th or jantorn@active5.co.th), assign admin
      //    - For ANY other new user from active5.co.th, automatically assign 'user' role
      let userRole = 'user';
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingUser) {
        if (existingUser.status === 'disabled') {
          return sendJson(res, 403, {
            error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ (Admin)'
          });
        }
        userRole = existingUser.role || 'user';
      } else {
        if (email === 'admin@active5.co.th' || email === 'jantorn@active5.co.th' || email.startsWith('admin@')) {
          userRole = 'admin';
        } else {
          // Automatic assignment of 'user' role for all new users from active5.co.th
          userRole = 'user';
        }
      }

      db.prepare(`
        INSERT INTO users (email, name, role, picture, domain, last_login)
        VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(email) DO UPDATE SET
          name = CASE WHEN excluded.name != '' THEN excluded.name ELSE users.name END,
          picture = CASE WHEN excluded.picture != '' THEN excluded.picture ELSE users.picture END,
          domain = excluded.domain,
          last_login = datetime('now', 'localtime')
      `).run(email, name, userRole, picture, emailDomain);

      const userObj = getUserWithRole(email);
      return sendJson(res, 200, {
        success: true,
        message: existingUser ? `เข้าสู่ระบบสำเร็จ` : `ยินดีต้อนรับพนักงานใหม่! ระบบกำหนดสิทธิ์ผู้ใช้งาน (User) ให้คุณโดยอัตโนมัติเรียบร้อยแล้ว`,
        is_new_user: !existingUser,
        user: userObj
      });
    }

    // Test SMTP Connection
    if (pathname === '/api/smtp/test' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const settings = getCompanySettings();
      const host = body.host || settings.smtp_host || 'smtp.gmail.com';
      const port = parseInt(body.port || settings.smtp_port || 465, 10);
      const user = (body.user !== undefined ? body.user : settings.smtp_user) || '';
      const pass = (body.pass !== undefined ? body.pass : settings.smtp_pass) || '';

      if (!user || !pass) {
        return sendJson(res, 400, { error: 'กรุณากรอกอีเมล Gmail และ Google App Password ให้ครบถ้วน' });
      }

      const testRes = await verifySmtpCredentials({ host, port, user, pass });
      if (!testRes.success) {
        return sendJson(res, 400, { error: testRes.error });
      }
      return sendJson(res, 200, { success: true, message: 'การเชื่อมต่อและยืนยันตัวตนกับ Gmail สำเร็จเรียบร้อย' });
    }

    // Test Email API Key (Resend / SendGrid)
    if (pathname === '/api/email/test-api-key' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const provider = body.provider || 'resend';
      const apiKey = String(body.apiKey || '').trim();

      if (!apiKey) {
        return sendJson(res, 400, { error: 'กรุณากรอก API Key ที่ต้องการทดสอบ' });
      }

      try {
        const testRes = await verifyApiKey({ provider, apiKey });
        return sendJson(res, 200, testRes);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    async function fetchExternalCompanySuggestions(query, existingMatches = []) {
      if (!query || query.trim().length < 2) return [];
      const q = query.trim();
      const existingNames = new Set(existingMatches.map(m => m.name.replace(/\s+/g, '').toLowerCase()));

      const queries = [];
      if (!q.startsWith('บริษัท') && !q.startsWith('ห้างหุ้นส่วน') && !q.startsWith('บจก') && !q.startsWith('หจก')) {
        queries.push(`บริษัท ${q}`);
      }
      queries.push(q);

      const results = [];
      const added = new Set();

      for (const item of queries) {
        try {
          const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=th&q=${encodeURIComponent(item)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(1800) });
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data[1]) ? data[1] : [];

          for (let s of list) {
            if (typeof s !== 'string') continue;
            s = s.trim();

            const sNoSpace = s.replace(/\s+/g, '').toLowerCase();
            if (sNoSpace.includes('สมัครงาน') || sNoSpace.includes('pantip') || sNoSpace.includes('รีวิว') || sNoSpace.includes('ผู้ถือหุ้น') || sNoSpace.includes('เบอร์โทร') || sNoSpace.includes('ราคาหุ้น') || sNoSpace.includes('งบการเงิน') || sNoSpace.includes('สวัสดิการ') || sNoSpace.includes('ฝึกงาน') || sNoSpace.includes('โบนัส')) {
              continue;
            }

            s = s.replace(/จํากัด/g, 'จำกัด').replace(/สํานักงาน/g, 'สำนักงาน').replace(/\s+/g, ' ').trim();
            // Clean up common search suffixes
            s = s.replace(/\s+(?:โทร|เบอร์โทร|เบอร์โทรศัพท์|ที่อยู่|ที่\s*อยู่|ติดต่อ|แผนที่|สาขา|สำนักงานใหญ่|pantip|job|career).*$/gi, '').trim();

            // Ensure proper Thai corporate spacing: "บริษัท ... จำกัด"
            s = s.replace(/^(บริษัท|บมจ\.?|บจก\.?|ห้างหุ้นส่วนจำกัด|หจก\.?)(?!\s)/, '$1 ');
            s = s.replace(/(?<!\s)(จำกัด)(\s*\(มหาชน\))?$/, ' $1$2');
            s = cleanCompanyName(s);

            const isCorp = s.includes('บริษัท') || s.includes('ห้างหุ้นส่วน') || s.includes('จำกัด') || s.includes('มหาชน') || s.toLowerCase().includes('co., ltd') || s.toLowerCase().includes('ltd');
            if (!isCorp) continue;

            const normKey = s.replace(/\s+/g, '').toLowerCase();
            if (existingNames.has(normKey) || added.has(normKey)) continue;

            added.add(normKey);
            results.push({
              id: `online_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: s,
              name_en: '',
              tax_id: '',
              branch: 'สำนักงานใหญ่',
              address: '',
              contact_name: '',
              phone: '',
              email: '',
              source: 'online'
            });

            if (results.length >= 25) break;
          }
        } catch (_) {}
        if (results.length >= 25) break;
      }
      return results;
    }

    // Smart Customer Search (Tax ID 13 digits, Aliases, Acronyms, Stripped Core Name & Fuzzy Matching)
    if (pathname === '/api/customers/search' && req.method === 'GET') {
      const q = (urlObj.searchParams.get('q') || '').trim();

      if (!q) {
        const recent = db.prepare(`
          SELECT id, name, name_en, tax_id, branch, address, contact_name, phone, email, source FROM customers
          ORDER BY CASE WHEN source = 'history' THEN 0 WHEN source = 'custom' THEN 1 ELSE 2 END, id DESC
          LIMIT 25
        `).all();
        recent.forEach(r => { if (r.name) r.name = cleanCompanyName(r.name); });
        return sendJson(res, 200, { success: true, results: recent, fromOnline: false });
      }

      // Step 1: Detect digits (13-digit Juristic ID or numeric sequence)
      const digitsOnly = q.replace(/\D/g, '');
      const core = stripCorporateAffixes(q);
      const coreLower = core.toLowerCase();
      const terms = getSearchSynonyms(q);
      const conds = [];
      const params = [];

      // 1.1 Match by Tax ID if numbers are typed
      if (digitsOnly.length >= 3) {
        conds.push("REPLACE(REPLACE(tax_id, '-', ''), ' ', '') LIKE ?");
        params.push('%' + digitsOnly + '%');
      }

      // 1.2 Match by all synonym and alias terms
      for (const t of terms) {
        conds.push('name LIKE ?', 'LOWER(name_en) LIKE ?');
        params.push('%' + t + '%', '%' + t.toLowerCase() + '%');

        const tNoSpace = t.replace(/\s+/g, '');
        if (tNoSpace.length >= 2) {
          conds.push("REPLACE(name, ' ', '') LIKE ?", "LOWER(REPLACE(name_en, ' ', '')) LIKE ?");
          params.push('%' + tNoSpace + '%', '%' + tNoSpace.toLowerCase() + '%');
        }
      }

      const qLower = q.toLowerCase();
      const searchSql = `
        SELECT id, name, name_en, tax_id, branch, address, contact_name, phone, email, source FROM customers
        WHERE ${conds.join(' OR ')}
        ORDER BY
          CASE 
            WHEN tax_id = ? OR REPLACE(tax_id, '-', '') = ? THEN 0
            WHEN name = ? OR LOWER(name_en) = ? THEN 1
            WHEN name LIKE ? OR LOWER(name_en) LIKE ? THEN 2
            WHEN ? != '' AND (name LIKE ? OR LOWER(name_en) LIKE ?) THEN 3
            ELSE 4
          END,
          CASE WHEN source = 'history' THEN 0 WHEN source = 'custom' THEN 1 ELSE 2 END,
          LENGTH(name) ASC
        LIMIT 60
      `;

      const searchParams = [
        ...params,
        digitsOnly, digitsOnly,
        q, qLower,
        q + '%', qLower + '%',
        core, '%' + core + '%', '%' + coreLower + '%'
      ];

      const matches = db.prepare(searchSql).all(...searchParams);
      matches.forEach(m => { if (m.name) m.name = cleanCompanyName(m.name); });

      // If local matches are under 25 and query length >= 2, search free external corporate data!
      let onlineResults = [];
      if (matches.length < 25 && q.length >= 2 && !digitsOnly) {
        onlineResults = await fetchExternalCompanySuggestions(q, matches);
      }

      const combined = [...matches, ...onlineResults];

      return sendJson(res, 200, {
        success: true,
        results: combined,
        fromOnline: onlineResults.length > 0,
        hasExactMatch: combined.some(m => m.name.toLowerCase() === qLower || (m.name_en && m.name_en.toLowerCase() === qLower))
      });
    }

    // Auto-Learn / Auto-Save Customer to Master Data
    if (pathname === '/api/customers/learn' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const name = cleanCompanyName(String(body.name || '').trim());
      if (!name) return sendJson(res, 400, { error: 'กรุณาระบุชื่อลูกค้า/บริษัท' });

      const nameEn = String(body.name_en || '').trim();
      const taxId = String(body.tax_id || '').trim();
      const branch = String(body.branch || 'สำนักงานใหญ่').trim();
      const address = String(body.address || '').trim();
      const contactName = String(body.contact_name || '').trim();
      const phone = String(body.phone || '').trim();
      const email = String(body.email || '').trim();

      try {
        const existing = db.prepare('SELECT * FROM customers WHERE name = ?').get(name);
        if (existing) {
          db.prepare(`
            UPDATE customers
            SET tax_id = CASE WHEN tax_id = '' THEN ? ELSE tax_id END,
                name_en = CASE WHEN name_en = '' THEN ? ELSE name_en END,
                contact_name = CASE WHEN contact_name = '' THEN ? ELSE contact_name END,
                phone = CASE WHEN phone = '' THEN ? ELSE phone END,
                email = CASE WHEN email = '' THEN ? ELSE email END
            WHERE id = ?
          `).run(taxId, nameEn, contactName, phone, email, existing.id);
          const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
          return sendJson(res, 200, { success: true, customer: updated, isNew: false, message: `อัปเดตข้อมูล "${name}" เรียบร้อยแล้ว` });
        } else {
          const info = db.prepare(`
            INSERT INTO customers (name, name_en, tax_id, branch, address, contact_name, phone, email, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom')
          `).run(name, nameEn, taxId, branch, address, contactName, phone, email);
          const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
          return sendJson(res, 201, { success: true, customer: created, isNew: true, message: `บันทึก "${name}" เข้าสู่ข้อมูลหลักอัตโนมัติแล้ว` });
        }
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // File upload endpoint for note attachments (images, PDF, documents)
    if (pathname === '/api/upload' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const fileName = String(body.name || 'file').trim();
      const fileData = body.data; // Base64 data URL
      const fileSize = Number(body.size || 0);
      const fileType = String(body.type || '');

      if (!fileData) {
        return sendJson(res, 400, { error: 'No file data provided' });
      }

      const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return sendJson(res, 400, { error: 'Invalid data URL format' });
      }

      const mime = match[1];
      const buffer = Buffer.from(match[2], 'base64');

      if (buffer.length > 25 * 1024 * 1024) {
        return sendJson(res, 400, { error: 'ไฟล์มีขนาดใหญ่เกิน 25MB' });
      }

      let ext = 'bin';
      if (fileName && fileName.includes('.')) {
        ext = fileName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
      } else if (mime.includes('pdf')) ext = 'pdf';
      else if (mime.includes('png')) ext = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('word') || mime.includes('docx')) ext = 'docx';
      else if (mime.includes('sheet') || mime.includes('xlsx')) ext = 'xlsx';
      else if (mime.includes('text')) ext = 'txt';

      const safeBase = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_').slice(0, 30);
      const storedName = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeBase}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, storedName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${storedName}`;
      return sendJson(res, 200, {
        success: true,
        name: fileName,
        url: fileUrl,
        size: fileSize || buffer.length,
        type: fileType || mime
      });
    }

    // Create a new Loan (+ ออกใบยืม from Kanban page: Model-only, no Tag ID or S/N required!)
    if (pathname === '/api/loans' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const borrowerName = String(body.borrower_name || '').trim();
      const customerName = String(body.customer_name || '').trim();
      const customerCompany = cleanCompanyName(String(body.customer_company || '').trim());
      const borrowerPhone = String(body.customer_phone || body.borrower_phone || '').trim();
      const customerPhone = borrowerPhone;
      const purpose = String(body.purpose || 'Demo').trim();
      const checkoutDate = body.checkout_date || getTodayStr();
      const dueDate = body.due_date;
      const initialStatus = body.status || 'Requested';
      const items = Array.isArray(body.items) ? body.items : [];

      if (!borrowerName) {
        return sendJson(res, 400, { error: 'กรุณาระบุชื่อผู้ยืม' });
      }
      if (!customerCompany) {
        return sendJson(res, 400, { error: 'กรุณาระบุบริษัทลูกค้า' });
      }
      if (!customerName) {
        return sendJson(res, 400, { error: 'กรุณาระบุชื่อผู้ติดต่อ' });
      }
      if (!dueDate) return sendJson(res, 400, { error: 'กรุณาระบุวันกำหนดคืน' });
      if (items.length === 0) return sendJson(res, 400, { error: 'กรุณาเลือกรุ่นสินค้าอย่างน้อย 1 รายการ' });

      const loanId = generateNextLoanId();
      const beforePhotos = (Array.isArray(body.before_photos) ? body.before_photos : [])
        .map(p => saveBase64Image(p, `out-${loanId}`))
        .filter(Boolean);
      const signatureUrl = body.borrower_signature
        ? saveBase64Image(body.borrower_signature, `sig-${loanId}`)
        : '';

      let createdBy = String(body.created_by || '').trim();
      if (!createdBy.includes('@') && borrowerName) {
        const cleanName = borrowerName.replace(/\s*\([^)]*\)/g, '').trim();
        const u = db.prepare("SELECT email FROM users WHERE name = ? OR name LIKE '%' || ? || '%'").get(cleanName, cleanName);
        if (u && u.email) createdBy = u.email;
      }
      if (!createdBy) createdBy = (borrowerName || '').trim();

      const defaultDispatcherSig = (getCompanySettings().dispatcher_signature || '').trim();
      const initialDispatcherSig = body.dispatcher_signature 
        ? saveBase64Image(body.dispatcher_signature, `sig-dispatcher-${loanId}`) 
        : defaultDispatcherSig;
      const initialDispatcherSignedAt = initialDispatcherSig ? (body.dispatcher_signed_at || new Date().toISOString()) : '';

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          INSERT INTO loans (
            id, customer_name, customer_company, borrower_name, borrower_phone, customer_phone,
            purpose, checkout_date, due_date, status, before_photos_json, borrower_signature, created_by,
            dispatcher_signature, dispatcher_signed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          loanId,
          customerName || borrowerName,
          customerCompany,
          borrowerName || customerName,
          customerPhone,
          customerPhone,
          purpose,
          checkoutDate,
          dueDate,
          initialStatus,
          JSON.stringify(beforePhotos),
          signatureUrl,
          createdBy,
          initialDispatcherSig,
          initialDispatcherSignedAt
        );

        if (customerCompany && customerCompany.trim()) {
          try {
            db.prepare(`
              INSERT INTO customers (name, contact_name, phone, source) VALUES (?, ?, ?, 'custom')
              ON CONFLICT(name) DO UPDATE SET 
                contact_name = CASE WHEN customers.contact_name = '' AND excluded.contact_name != '' THEN excluded.contact_name ELSE customers.contact_name END,
                phone = CASE WHEN customers.phone = '' AND excluded.phone != '' THEN excluded.phone ELSE customers.phone END,
                created_at = datetime('now', 'localtime')
            `).run(customerCompany.trim(), customerName || '', customerPhone || '');
          } catch (_) {}
        }

        const insertItem = db.prepare(`
          INSERT INTO loan_items (
            loan_id, tag_id, model, brand, serial_no,
            source_snapshot, location_snapshot, loan_accessories_json, loan_free_note, attachments_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let totalUnits = 0;
        let unitsWithSn = 0;

        for (const it of items) {
          const modelName = String(it.model || '').trim();
          const brandName = String(it.brand || '').trim();
          if (!modelName) throw new Error('กรุณาเลือกรุ่นสินค้าให้ครบทุกแถว');

          const qty = Math.max(1, parseInt(it.qty || 1, 10) || 1);
          const itemAcc = Array.isArray(it.accessories) ? it.accessories : [];
          const itemNote = String(it.free_note || '').trim();
          const itemSource = it.source || 'Demo';
          const itemSerials = Array.isArray(it.serials) ? it.serials.map(s => String(s || '').trim()).filter(Boolean) : [];
          const itemAttachments = Array.isArray(it.attachments) ? it.attachments : [];

          // ตรวจสอบตามเงื่อนไข: "ถ้าจะมีการใส่ s/n ต้องใส่ให้ครบตามจำนวนที่กำหนด"
          if (itemSerials.length > 0 && itemSerials.length !== qty) {
            throw new Error(`รุ่น ${brandName} ${modelName} ระบุจำนวน ${qty} เครื่อง แต่ใส่ S/N มา ${itemSerials.length} เครื่อง (หากจะใส่ S/N ต้องใส่ให้ครบตามจำนวนที่กำหนด หรือเว้นว่างทั้งหมด)`);
          }

          // Auto-register brand and catalog for Supplier and คลังขาย
          if (itemSource === 'Supplier' || itemSource === 'คลังขาย') {
            if (brandName) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO master_options (type, name, code)
                  VALUES ('brand', ?, ?)
                `).run(brandName, brandName.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              } catch (_) {}
            }
            try {
              db.prepare(`
                INSERT OR IGNORE INTO product_catalogs (brand, model, category, default_specs, default_accessories)
                VALUES (?, ?, 'General', '', ?)
              `).run(brandName || 'Other', modelName, JSON.stringify(itemAcc));
            } catch (_) {}
          }

          totalUnits += qty;

          for (let q = 0; q < qty; q++) {
            const sn = itemSerials[q] || '';
            let matchedTagId = '';
            let matchedLocation = '';

            if (sn) {
              unitsWithSn++;
              let asset = db.prepare(`
                SELECT * FROM assets 
                WHERE (serial_no = ? OR tag_id = ?) 
                AND status = 'Available'
              `).get(sn, sn);

              if (!asset && (itemSource === 'Supplier' || itemSource === 'คลังขาย')) {
                // Auto-create asset into assets DB for Supplier / คลังขาย
                const newTagId = getNextActTagId();
                const fullName = brandName ? `${brandName} ${modelName}` : modelName;
                const defaultLocation = itemSource === 'Supplier' ? 'Supplier (ยืมภายนอก)' : 'คลังขาย (สต็อกขาย)';
                db.prepare(`
                  INSERT INTO assets (
                    tag_id, name, model, brand, category, serial_no,
                    source, location, accessories_json, free_note, status, current_loan_id, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'On_Loan', ?, datetime('now', 'localtime'))
                `).run(
                  newTagId,
                  fullName,
                  modelName,
                  brandName,
                  'General',
                  sn,
                  itemSource,
                  defaultLocation,
                  JSON.stringify(itemAcc),
                  itemNote,
                  loanId
                );
                matchedTagId = newTagId;
                matchedLocation = defaultLocation;
              } else if (asset) {
                matchedTagId = asset.tag_id;
                matchedLocation = asset.location || '';
                db.prepare(`
                  UPDATE assets 
                  SET status = 'On_Loan', current_loan_id = ?, updated_at = datetime('now', 'localtime')
                  WHERE tag_id = ?
                `).run(loanId, asset.tag_id);
              }
            }

            insertItem.run(
              loanId,
              matchedTagId,
              modelName,
              brandName,
              sn,
              itemSource,
              matchedLocation,
              JSON.stringify(itemAcc),
              itemNote,
              JSON.stringify(itemAttachments)
            );
          }
        }

        // สถานะ: "รายการที่มี s/n ถือว่า complete จัดของเสร็จแล้วพร้อมส่ง"
        if (totalUnits > 0 && unitsWithSn === totalUnits) {
          db.prepare(`UPDATE loans SET status = 'Dispatched' WHERE id = ?`).run(loanId);
        } else if (unitsWithSn > 0) {
          db.prepare(`UPDATE loans SET status = 'Dispatching' WHERE id = ?`).run(loanId);
        }

        db.exec('COMMIT');
        notifyStateChange('create_loan', {
          id: loanId,
          borrower_name: borrowerName,
          customer: customerCompany || customerName
        });
        return sendJson(res, 201, { loanId, state: getFullState() });
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Cancel Loan (เฉพาะใบที่ยังไม่ได้จัดของ: Requested หรือ Dispatching)
    if (((pathname.match(/^\/api\/loans\/[^/]+\/cancel$/) && req.method === 'POST') ||
         (pathname.match(/^\/api\/loans\/[^/]+$/) && req.method === 'DELETE'))) {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      // อนุญาตให้ยกเลิกได้เฉพาะก่อนส่งมอบสินค้า (Requested, Dispatching หรือ Dispatched)
      if (loan.status !== 'Requested' && loan.status !== 'Dispatching' && loan.status !== 'Dispatched') {
        return sendJson(res, 400, { error: `ไม่สามารถยกเลิกใบยืมสถานะ "${loan.status}" ได้ (ยกเลิกได้เฉพาะใบที่ยังไม่ได้ส่งมอบสินค้า)` });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        // ปลดเครื่องที่ถูกจองหรือผูกไว้กับใบยืมนี้ให้กลับเป็น Available
        const items = db.prepare('SELECT tag_id FROM loan_items WHERE loan_id = ?').all(loanId);
        for (const it of items) {
          if (it.tag_id) {
            db.prepare(`UPDATE assets SET status = 'Available', current_loan_id = NULL WHERE tag_id = ?`).run(it.tag_id);
          }
        }
        db.prepare(`UPDATE assets SET status = 'Available', current_loan_id = NULL WHERE current_loan_id = ?`).run(loanId);

        // ลบรายการสินค้าและใบยืม
        db.prepare('DELETE FROM loan_items WHERE loan_id = ?').run(loanId);
        db.prepare('DELETE FROM loans WHERE id = ?').run(loanId);

        db.exec('COMMIT');
        notifyStateChange('cancel_loan', { id: loanId });
        return sendJson(res, 200, { success: true, message: `ยกเลิกใบยืม ${loanId} เรียบร้อยแล้ว`, state: getFullState() });
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 500, { error: 'เกิดข้อผิดพลาดในการยกเลิกใบยืม: ' + err.message });
      }
    }

    // Delete individual item from loan (เฉพาะใบที่ยังไม่ได้จัดของ: Requested หรือ กำลังจัดของ: Dispatching)
    if (pathname.match(/^\/api\/loans\/[^/]+\/items\/[^/]+$/) && req.method === 'DELETE') {
      const parts = pathname.split('/');
      const loanId = decodeURIComponent(parts[3]);
      const itemIdentifier = decodeURIComponent(parts[5]);

      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      // อนุญาตให้ลบได้เฉพาะสถานะ Requested, Dispatching หรือ Dispatched (ก่อนส่งมอบ)
      if (loan.status !== 'Requested' && loan.status !== 'Dispatching' && loan.status !== 'Dispatched') {
        return sendJson(res, 400, {
          error: `ไม่สามารถลบรายการในใบยืมสถานะ "${loan.status}" ได้ (ลบได้เฉพาะใบที่ยังไม่ได้ส่งมอบสินค้า)`
        });
      }

      const allItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
      if (allItems.length <= 1) {
        return sendJson(res, 400, {
          error: 'ไม่สามารถลบรายการสุดท้ายได้ (ใบยืมต้องมีสินค้าอย่างน้อย 1 รายการ หากต้องการยกเลิกใบยืมทั้งหมด กรุณาใช้ปุ่มยกเลิกใบยืม)'
        });
      }

      const targetItem = allItems.find(i => String(i.id) === itemIdentifier || i.tag_id === itemIdentifier);
      if (!targetItem) {
        return sendJson(res, 404, { error: 'ไม่พบรายการสินค้าที่ระบุในใบยืมนี้' });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        // If this item was linked to an asset, release it back to Available
        if (targetItem.tag_id) {
          db.prepare(`UPDATE assets SET status = 'Available', current_loan_id = NULL WHERE tag_id = ? AND current_loan_id = ?`).run(targetItem.tag_id, loanId);
        }

        db.prepare('DELETE FROM loan_items WHERE id = ? AND loan_id = ?').run(targetItem.id, loanId);

        // Re-check remaining items and update loan status if needed
        const remainingItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
        const hasPicked = remainingItems.some(i => i.tag_id && i.serial_no);

        if (loan.status === 'Dispatching' && !hasPicked) {
          db.prepare(`UPDATE loans SET status = 'Requested' WHERE id = ?`).run(loanId);
        }

        db.exec('COMMIT');

        const updatedState = getFullState();
        const updatedLoan = updatedState.loans.find(l => l.id === loanId);
        return sendJson(res, 200, {
          success: true,
          message: `ลบรายการ ${targetItem.model || ''} ออกจากใบยืมเรียบร้อยแล้ว`,
          loan: updatedLoan,
          state: updatedState
        });
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 500, { error: 'ลบรายการไม่สำเร็จ: ' + err.message });
      }
    }

    // Dispatch & Match S/N (คนจัดของหยิบ S/N มา Match กับรุ่นที่ขอ แล้วเปลี่ยนสถานะเป็น Dispatched "รอส่งมอบ")
    if (pathname.match(/^\/api\/loans\/[^/]+\/dispatch$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });
      if (loan.status !== 'Requested' && loan.status !== 'Dispatching' && loan.status !== 'Dispatched') {
        return sendJson(res, 400, { error: 'ใบยืมนี้ส่งมอบหรือปิดรายการไปแล้ว ไม่สามารถแก้ไขได้' });
      }

      const body = await parseJsonBody(req);
      const matchedItems = Array.isArray(body.items) ? body.items : [];
      if (matchedItems.length === 0) {
        return sendJson(res, 400, { error: 'ไม่มีรายการเครื่องที่จะจัดของ' });
      }

      const newBeforePhotos = (Array.isArray(body.before_photos) ? body.before_photos : [])
        .map(p => saveBase64Image(p, `out-${loanId}`))
        .filter(Boolean);
      const existingBefore = JSON.parse(loan.before_photos_json || '[]');
      const finalBefore = body.before_photos !== undefined ? newBeforePhotos : existingBefore;

      db.exec('BEGIN TRANSACTION');
      try {
        // Release any previously linked assets for this loan first
        const prevItems = db.prepare('SELECT tag_id FROM loan_items WHERE loan_id = ?').all(loanId);
        for (const p of prevItems) {
          if (p.tag_id) {
            db.prepare(`UPDATE assets SET status = 'Available', current_loan_id = NULL WHERE tag_id = ?`).run(p.tag_id);
          }
        }

        const usedTags = new Set();
        for (const mi of matchedItems) {
          const tagId = String(mi.tag_id || '').trim();
          if (!tagId) {
            throw new Error(`กรุณาเลือก S/N (รหัสเครื่อง) สำหรับรุ่น ${mi.brand || ''} ${mi.model || ''} ให้ครบทุกเครื่อง`);
          }
          if (usedTags.has(tagId)) {
            throw new Error(`เลือกเครื่องซ้ำกัน (${tagId}) กรุณาเลือกคนละ S/N`);
          }
          usedTags.add(tagId);

          let asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
          if (!asset && mi.serial_no) {
            asset = db.prepare('SELECT * FROM assets WHERE serial_no = ?').get(mi.serial_no);
          }
          if (!asset && (mi.source === 'Supplier' || mi.source === 'คลังขาย')) {
            const newTagId = getNextActTagId();
            const brand = String(mi.brand || '').trim();
            const model = String(mi.model || '').trim();
            const fullName = brand ? `${brand} ${model}` : model;
            const defaultLocation = mi.source === 'Supplier' ? 'Supplier (ยืมภายนอก)' : 'คลังขาย (สต็อกขาย)';
            const acc = Array.isArray(mi.accessories) ? mi.accessories : [];
            const note = String(mi.free_note || '').trim();

            db.prepare(`
              INSERT INTO assets (
                tag_id, name, model, brand, category, serial_no,
                source, location, accessories_json, free_note, status, current_loan_id, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, datetime('now', 'localtime'))
            `).run(
              newTagId,
              fullName,
              model,
              brand,
              'General',
              mi.serial_no || newTagId,
              mi.source,
              defaultLocation,
              JSON.stringify(acc),
              note,
              loanId
            );
            asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(newTagId);
          }
          if (!asset) throw new Error(`ไม่พบเครื่องรหัส ${tagId} ในคลัง`);
          if (asset.status !== 'Available') {
            if (asset.status === 'Disposed') {
              throw new Error(`เครื่อง ${tagId} (S/N: ${asset.serial_no}) ถูกจำหน่ายออกจากระบบแล้ว ไม่สามารถนำมาจ่ายยืมได้`);
            }
            throw new Error(`เครื่อง ${tagId} (S/N: ${asset.serial_no}) ถูกยืมอยู่ในใบอื่นแล้ว`);
          }

          const itemAcc = Array.isArray(mi.accessories)
            ? mi.accessories
            : JSON.parse(asset.accessories_json || '[]');
          const itemNote = mi.free_note !== undefined ? mi.free_note : '';
          const itemSource = mi.source || asset.source || 'Demo';
          const itemAttachments = Array.isArray(mi.attachments) ? mi.attachments : [];

          db.prepare(`
            UPDATE loan_items
            SET tag_id = ?,
                serial_no = ?,
                model = ?,
                brand = ?,
                source_snapshot = ?,
                location_snapshot = ?,
                loan_accessories_json = ?,
                loan_free_note = ?,
                attachments_json = ?
            WHERE id = ? AND loan_id = ?
          `).run(
            asset.tag_id,
            asset.serial_no,
            asset.model,
            asset.brand,
            itemSource,
            asset.location || 'Mobile Computer ตู้ A1',
            JSON.stringify(itemAcc),
            itemNote,
            JSON.stringify(itemAttachments),
            mi.id,
            loanId
          );

          db.prepare(`
            UPDATE assets
            SET status = 'On_Loan',
                current_loan_id = ?,
                source = ?,
                accessories_json = ?,
                updated_at = datetime('now', 'localtime')
            WHERE tag_id = ?
          `).run(loanId, itemSource, JSON.stringify(itemAcc), asset.tag_id);
        }

        const sigUrl = body.borrower_signature
          ? saveBase64Image(body.borrower_signature, `sig-${loanId}`)
          : loan.borrower_signature;
        const dispatcherName = (body.dispatcher_name || '').trim();

        db.prepare(`
          UPDATE loans
          SET status = 'Dispatched',
              before_photos_json = ?,
              borrower_signature = COALESCE(NULLIF(?, ''), borrower_signature),
              dispatcher_name = COALESCE(NULLIF(?, ''), dispatcher_name)
          WHERE id = ?
        `).run(JSON.stringify(finalBefore), sigUrl, dispatcherName, loanId);

        db.exec('COMMIT');
        notifyStateChange('dispatch_loan', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Deliver Loan (บันทึกส่งมอบสินค้า: ผู้ส่ง, ผู้รับ, ถ่ายรูปส่งงาน, GPS, Timestamp)
    if (pathname.match(/^\/api\/loans\/[^/]+\/deliver$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });
      if (loan.status !== 'Dispatched') {
        return sendJson(res, 400, { error: 'ใบยืมต้องอยู่ในสถานะ "รอส่งมอบ" เท่านั้นจึงจะทำการส่งมอบได้' });
      }

      const body = await parseJsonBody(req);
      const sender = String(body.sender || loan.borrower_name || '').trim();
      const receiver = String(body.receiver || loan.customer_name || '').trim();
      const gps = String(body.gps || '').trim();
      const timestamp = String(body.timestamp || new Date().toISOString()).trim();
      const note = String(body.note || '').trim();

      const newDeliveryPhotos = (Array.isArray(body.photos) ? body.photos : [])
        .map(p => saveBase64Image(p, `deliv-${loanId}`))
        .filter(Boolean);
      const existingPhotos = JSON.parse(loan.delivery_photos_json || '[]');
      const finalPhotos = body.photos !== undefined ? newDeliveryPhotos : existingPhotos;

      db.prepare(`
        UPDATE loans
        SET status = 'Delivered',
            delivery_sender = ?,
            delivery_receiver = ?,
            delivery_photos_json = ?,
            delivery_gps = ?,
            delivery_timestamp = ?,
            delivery_note = ?
        WHERE id = ?
      `).run(
        sender,
        receiver,
        JSON.stringify(finalPhotos),
        gps,
        timestamp,
        note,
        loanId
      );

      notifyStateChange('deliver_loan', { id: loanId });
      return sendJson(res, 200, getFullState());
    }

    // Update existing Loan (Dispatched allowed full edit/add items, Delivered allows note-only edit)
    if (pathname.match(/^\/api\/loans\/[^/]+\/update$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const body = await parseJsonBody(req);
      const isDeliveredStage = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
      const isFullEditable = ['Requested', 'Dispatching', 'Dispatched'].includes(loan.status);

      // Case 1: Delivered Stage - Note-only editing ("ถ้าส่งมอบไปแล้ว แก้ไขได้แค่หมายเหตุ")
      if (isDeliveredStage) {
        db.exec('BEGIN TRANSACTION');
        try {
          if (body.delivery_note !== undefined) {
            db.prepare('UPDATE loans SET delivery_note = ? WHERE id = ?').run(String(body.delivery_note || '').trim(), loanId);
          }
          if (Array.isArray(body.items)) {
            const existingItems = db.prepare('SELECT id FROM loan_items WHERE loan_id = ? ORDER BY id ASC').all(loanId);
            for (let i = 0; i < body.items.length; i++) {
              const it = body.items[i];
              const note = String(it.free_note || it.loan_free_note || '').trim();
              if (it.id) {
                db.prepare('UPDATE loan_items SET loan_free_note = ? WHERE id = ? AND loan_id = ?').run(note, it.id, loanId);
              } else if (existingItems[i]) {
                db.prepare('UPDATE loan_items SET loan_free_note = ? WHERE id = ? AND loan_id = ?').run(note, existingItems[i].id, loanId);
              }
            }
          }
          db.exec('COMMIT');
          notifyStateChange('update_loan_notes', { id: loanId });
          return sendJson(res, 200, getFullState());
        } catch (err) {
          db.exec('ROLLBACK');
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Case 2: Status transition from Dispatched -> Delivered (via dispatch deliver flow)
      if (body.status === 'Delivered' && loan.status === 'Dispatched') {
        db.prepare('UPDATE loans SET status = ? WHERE id = ?').run('Delivered', loanId);
        notifyStateChange('deliver_loan', { id: loanId });
        return sendJson(res, 200, getFullState());
      }

      // Block uneditable statuses
      if (!isFullEditable) {
        return sendJson(res, 400, { error: 'ไม่สามารถแก้ไขใบยืมในสถานะนี้ได้' });
      }

      if (body.borrower_name !== undefined && !String(body.borrower_name).trim()) {
        return sendJson(res, 400, { error: 'กรุณาระบุชื่อผู้ยืม' });
      }
      if (body.customer_company !== undefined && !String(body.customer_company).trim()) {
        return sendJson(res, 400, { error: 'กรุณาระบุบริษัทลูกค้า' });
      }
      if (body.customer_name !== undefined && !String(body.customer_name).trim()) {
        return sendJson(res, 400, { error: 'กรุณาระบุชื่อผู้ติดต่อ' });
      }

      let nextStatus = body.status || loan.status;
      const newBeforePhotos = (Array.isArray(body.before_photos) ? body.before_photos : [])
        .map(p => saveBase64Image(p, `out-${loanId}`))
        .filter(Boolean);
      const existingBefore = JSON.parse(loan.before_photos_json || '[]');
      const finalBefore = body.before_photos !== undefined ? newBeforePhotos : existingBefore;
      const sigUrl = body.borrower_signature
        ? saveBase64Image(body.borrower_signature, `sig-${loanId}`)
        : loan.borrower_signature;

      const cleanedCompany = body.customer_company !== undefined ? cleanCompanyName(body.customer_company) : null;

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          UPDATE loans
          SET status = ?,
              customer_name = COALESCE(?, customer_name),
              customer_company = COALESCE(?, customer_company),
              customer_phone = COALESCE(?, customer_phone),
              borrower_phone = COALESCE(?, borrower_phone),
              borrower_name = COALESCE(?, borrower_name),
              purpose = COALESCE(?, purpose),
              checkout_date = COALESCE(?, checkout_date),
              due_date = COALESCE(?, due_date),
              delivery_note = COALESCE(?, delivery_note),
              before_photos_json = ?,
              borrower_signature = ?
          WHERE id = ?
        `).run(
          nextStatus,
          body.customer_name !== undefined ? body.customer_name : null,
          cleanedCompany,
          body.customer_phone !== undefined ? body.customer_phone : null,
          body.customer_phone !== undefined ? body.customer_phone : (body.borrower_phone !== undefined ? body.borrower_phone : null),
          body.borrower_name !== undefined ? body.borrower_name : null,
          body.purpose !== undefined ? body.purpose : null,
          body.checkout_date !== undefined ? body.checkout_date : null,
          body.due_date !== undefined ? body.due_date : null,
          body.delivery_note !== undefined ? body.delivery_note : null,
          JSON.stringify(finalBefore),
          sigUrl,
          loanId
        );

        if (cleanedCompany && cleanedCompany.trim()) {
          try {
            db.prepare(`
              INSERT INTO customers (name, contact_name, phone, source) VALUES (?, ?, ?, 'custom')
              ON CONFLICT(name) DO UPDATE SET 
                contact_name = CASE WHEN customers.contact_name = '' AND excluded.contact_name != '' THEN excluded.contact_name ELSE customers.contact_name END,
                phone = CASE WHEN customers.phone = '' AND excluded.phone != '' THEN excluded.phone ELSE customers.phone END,
                created_at = datetime('now', 'localtime')
            `).run(cleanedCompany.trim(), body.customer_name || '', body.customer_phone || '');
          } catch (_) {}
        }

        if (Array.isArray(body.items)) {
          const oldItems = db.prepare('SELECT tag_id FROM loan_items WHERE loan_id = ?').all(loanId);
          for (const old of oldItems) {
            if (old.tag_id) {
              db.prepare(`UPDATE assets SET status = 'Available', current_loan_id = NULL WHERE tag_id = ?`).run(old.tag_id);
            }
          }
          db.prepare('DELETE FROM loan_items WHERE loan_id = ?').run(loanId);

          const insertItem = db.prepare(`
            INSERT INTO loan_items (
              loan_id, tag_id, model, brand, serial_no,
              source_snapshot, location_snapshot, loan_accessories_json, loan_free_note, attachments_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          let totalUnits = 0;
          let unitsWithSn = 0;

          for (const it of body.items) {
            const modelName = String(it.model || '').trim();
            const brandName = String(it.brand || '').trim();
            if (!modelName) throw new Error('กรุณาเลือกรุ่นสินค้าให้ครบทุกแถว');
            const qty = Math.max(1, parseInt(it.qty || 1, 10) || 1);
            const itemAcc = Array.isArray(it.accessories) ? it.accessories : [];
            const itemNote = String(it.free_note || it.loan_free_note || '').trim();
            const itemSource = it.source || 'Demo';
            const itemSerials = Array.isArray(it.serials) ? it.serials.map(s => String(s || '').trim()).filter(Boolean) : [];
            const itemAttachments = Array.isArray(it.attachments) ? it.attachments : [];

            // ตรวจสอบ: "ถ้าจะมีการใส่ s/n ต้องใส่ให้ครบตามจำนวนที่กำหนด"
            if (itemSerials.length > 0 && itemSerials.length !== qty) {
              throw new Error(`รุ่น ${brandName} ${modelName} ระบุจำนวน ${qty} เครื่อง แต่ใส่ S/N มา ${itemSerials.length} เครื่อง (หากจะใส่ S/N ต้องใส่ให้ครบตามจำนวนที่กำหนด หรือเว้นว่างทั้งหมด)`);
            }

            // Auto-register brand and catalog for Supplier and คลังขาย
            if (itemSource === 'Supplier' || itemSource === 'คลังขาย') {
              if (brandName) {
                try {
                  db.prepare(`
                    INSERT OR IGNORE INTO master_options (type, name, code)
                    VALUES ('brand', ?, ?)
                  `).run(brandName, brandName.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                } catch (_) {}
              }
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO product_catalogs (brand, model, category, default_specs, default_accessories)
                  VALUES (?, ?, 'General', '', ?)
                `).run(brandName || 'Other', modelName, JSON.stringify(itemAcc));
              } catch (_) {}
            }

            totalUnits += qty;

            for (let q = 0; q < qty; q++) {
              const sn = itemSerials[q] || '';
              let matchedTagId = '';
              let matchedLocation = '';

              if (sn) {
                unitsWithSn++;
                let asset = db.prepare(`
                  SELECT * FROM assets 
                  WHERE (serial_no = ? OR tag_id = ?) 
                  AND (status = 'Available' OR current_loan_id = ?)
                `).get(sn, sn, loanId);

                if (!asset && (itemSource === 'Supplier' || itemSource === 'คลังขาย')) {
                  // Auto-create asset into assets DB for Supplier / คลังขาย
                  const newTagId = getNextActTagId();
                  const fullName = brandName ? `${brandName} ${modelName}` : modelName;
                  const defaultLocation = itemSource === 'Supplier' ? 'Supplier (ยืมภายนอก)' : 'คลังขาย (สต็อกขาย)';
                  db.prepare(`
                    INSERT INTO assets (
                      tag_id, name, model, brand, category, serial_no,
                      source, location, accessories_json, free_note, status, current_loan_id, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'On_Loan', ?, datetime('now', 'localtime'))
                  `).run(
                    newTagId,
                    fullName,
                    modelName,
                    brandName,
                    'General',
                    sn,
                    itemSource,
                    defaultLocation,
                    JSON.stringify(itemAcc),
                    itemNote,
                    loanId
                  );
                  matchedTagId = newTagId;
                  matchedLocation = defaultLocation;
                } else if (asset) {
                  matchedTagId = asset.tag_id;
                  matchedLocation = asset.location || '';
                  db.prepare(`
                    UPDATE assets 
                    SET status = 'On_Loan', current_loan_id = ?, updated_at = datetime('now', 'localtime')
                    WHERE tag_id = ?
                  `).run(loanId, asset.tag_id);
                }
              }

              insertItem.run(
                loanId,
                matchedTagId,
                modelName,
                brandName,
                sn,
                itemSource,
                matchedLocation,
                JSON.stringify(itemAcc),
                itemNote,
                JSON.stringify(itemAttachments)
              );
            }
          }

          // อัปเดตสถานะอัตโนมัติ: ถ้ามี S/N ครบทุกรายการเป็น Dispatched, ถ้ามีบางส่วนเป็น Dispatching, ถ้าไม่มีเลยเป็น Requested
          if (totalUnits > 0 && unitsWithSn === totalUnits) {
            db.prepare(`UPDATE loans SET status = 'Dispatched' WHERE id = ?`).run(loanId);
          } else if (unitsWithSn > 0) {
            db.prepare(`UPDATE loans SET status = 'Dispatching' WHERE id = ?`).run(loanId);
          } else {
            db.prepare(`UPDATE loans SET status = 'Requested' WHERE id = ?`).run(loanId);
          }
        }

        db.exec('COMMIT');
        notifyStateChange('update_loan', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Digital Signature Endpoint (Borrower, Dispatcher, QC Receiver)
    if (pathname.match(/^\/api\/loans\/[^/]+\/signature$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const body = await parseJsonBody(req);
      const role = String(body.role || 'borrower').trim(); // 'borrower' | 'dispatcher' | 'receiver'
      const isClear = Boolean(body.clear);

      const isDelivered = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
      if (isDelivered && role !== 'receiver') {
        return sendJson(res, 403, { error: 'ใบยืมนี้ส่งมอบแล้ว ไม่สามารถแก้ไขหรือลบลายเซ็นต์ผู้ยืมและผู้จ่ายเครื่องได้' });
      }

      let sigCol = 'borrower_signature';
      let dateCol = 'borrower_signed_at';
      if (role === 'dispatcher') {
        sigCol = 'dispatcher_signature';
        dateCol = 'dispatcher_signed_at';
      } else if (role === 'receiver') {
        sigCol = 'receiver_signature';
        dateCol = 'receiver_signed_at';
      }

      if (isClear) {
        db.prepare(`UPDATE loans SET ${sigCol} = '', ${dateCol} = '' WHERE id = ?`).run(loanId);
      } else {
        if (!body.signature) {
          return sendJson(res, 400, { error: 'กรุณาแนบหรือวาดลายเซ็น' });
        }
        const sigUrl = saveBase64Image(body.signature, `sig-${role}-${loanId}`);
        const nowStr = body.signed_at || new Date().toISOString();
        db.prepare(`UPDATE loans SET ${sigCol} = ?, ${dateCol} = ? WHERE id = ?`).run(sigUrl, nowStr, loanId);

        if (role === 'dispatcher' && body.save_as_default) {
          db.prepare(`
            INSERT INTO company_settings (key, value)
            VALUES ('dispatcher_signature', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `).run(sigUrl);
        }
      }

      return sendJson(res, 200, getFullState());
    }

    // Update Customer Email for Loan
    if (pathname.match(/^\/api\/loans\/[^/]+\/customer-email$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });
      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim();
      db.prepare('UPDATE loans SET customer_email = ? WHERE id = ?').run(email, loanId);
      return sendJson(res, 200, getFullState());
    }

    // Direct PDF Download of Loan Gate Pass
    if (pathname.match(/^\/api\/loans\/[^/]+\/pdf$/) && req.method === 'GET') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      try {
        const pdfBuffer = await generateLoanPdf(loanId, { serverPort: PORT });
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${loanId}.pdf"`,
          'Content-Length': pdfBuffer.length
        });
        return res.end(pdfBuffer);
      } catch (err) {
        return sendJson(res, 500, { error: `สร้างไฟล์ PDF ไม่สำเร็จ: ${err.message}` });
      }
    }

    // Direct Email Dispatch with PDF Attachment (supports Resend, SendGrid, and Gmail SMTP)
    if (pathname.match(/^\/api\/loans\/[^/]+\/send-email-direct$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const settings = getCompanySettings();
      const body = await parseJsonBody(req);
      const to = String(body.to || '').trim();
      const cc = String(body.cc || '').trim();
      const subject = String(body.subject || `ใบยืมอุปกรณ์ / Gate Pass ${loanId}`).trim();
      const bodyText = String(body.body || '').trim();

      if (!to) {
        return sendJson(res, 400, { error: 'กรุณากรอกอีเมลผู้รับ (To)' });
      }

      // Check if credentials are present
      const hasApiKey = Boolean((settings.email_api_key || '').trim());
      const hasSmtp = Boolean((settings.smtp_user || '').trim() && (settings.smtp_pass || '').trim());
      if (!hasApiKey && !hasSmtp) {
        return sendJson(res, 400, {
          error: 'ยังไม่ได้ตั้งค่า Email API Key หรือ SMTP สำหรับส่งอีเมล กรุณากดปุ่ม "ข้อมูลบริษัท > ตั้งค่าการส่ง Email" เพื่อกรอก API Key (เช่น Resend หรือ SendGrid) ก่อนส่ง'
        });
      }

      // 1. Generate PDF of loan document
      let pdfBuffer;
      try {
        pdfBuffer = await generateLoanPdf(loanId, { serverPort: PORT });
      } catch (pdfErr) {
        return sendJson(res, 500, { error: `สร้างไฟล์ PDF ไม่สำเร็จ: ${pdfErr.message}` });
      }

      // 2. Dispatch via Email Service (Resend / SendGrid / SMTP)
      try {
        const mailRes = await dispatchEmail(settings, {
          to,
          cc,
          subject,
          bodyText,
          attachments: [
            {
              filename: `${loanId}.pdf`,
              contentType: 'application/pdf',
              content: pdfBuffer
            }
          ]
        });

        // 3. Update customer_email on loan
        try {
          db.prepare('UPDATE loans SET customer_email = ? WHERE id = ?').run(to, loanId);
        } catch (_) {}

        const providerLabel = mailRes.provider === 'resend' ? 'Resend API' : mailRes.provider === 'sendgrid' ? 'SendGrid API' : 'Gmail SMTP';
        return sendJson(res, 200, {
          success: true,
          provider: mailRes.provider,
          message: `ส่งอีเมลผ่าน ${providerLabel} พร้อมแนบเอกสาร PDF (${loanId}.pdf) ให้ ${to} เรียบร้อยแล้ว`,
          state: getFullState()
        });
      } catch (mailErr) {
        return sendJson(res, 500, { error: `ส่งอีเมลไม่สำเร็จ: ${mailErr.message}` });
      }
    }

    // Receive Loan Items from Customer and move to Pending_QC
    if (pathname.match(/^\/api\/loans\/[^/]+\/receive-for-qc$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const body = await parseJsonBody(req).catch(() => ({}));
      const returnReceiver = String(body.return_receiver || '').trim();

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`
          UPDATE loans
          SET status = 'Pending_QC',
              return_receiver = COALESCE(NULLIF(?, ''), return_receiver)
          WHERE id = ?
        `).run(returnReceiver, loanId);

        // Update assets to In_QC status while awaiting QC inspection
        const loanItems = db.prepare('SELECT tag_id FROM loan_items WHERE loan_id = ? AND returned = 0').all(loanId);
        for (const item of loanItems) {
          if (item.tag_id) {
            db.prepare(`
              UPDATE assets
              SET status = 'In_QC',
                  updated_at = datetime('now', 'localtime')
              WHERE tag_id = ?
            `).run(item.tag_id);
          }
        }

        db.exec('COMMIT');
        notifyStateChange('receive_for_qc', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Revert QC back to Delivered (in case of misclick)
    if (pathname.match(/^\/api\/loans\/[^/]+\/revert-qc$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare(`UPDATE loans SET status = 'Delivered' WHERE id = ?`).run(loanId);
        const loanItems = db.prepare('SELECT tag_id FROM loan_items WHERE loan_id = ? AND returned = 0').all(loanId);
        for (const item of loanItems) {
          if (item.tag_id) {
            db.prepare(`
              UPDATE assets
              SET status = 'On_Loan',
                  updated_at = datetime('now', 'localtime')
              WHERE tag_id = ?
            `).run(item.tag_id);
          }
        }
        db.exec('COMMIT');
        notifyStateChange('revert_qc', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Return & QC Inspection
    if (pathname.match(/^\/api\/loans\/[^/]+\/return$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const body = await parseJsonBody(req);
      const returnItems = Array.isArray(body.items) ? body.items : [];
      if (returnItems.length === 0) return sendJson(res, 400, { error: 'กรุณาเลือกรายการเครื่องที่รับคืน' });

      const newAfterPhotos = (Array.isArray(body.after_photos) ? body.after_photos : [])
        .map(p => saveBase64Image(p, `in-${loanId}`))
        .filter(Boolean);
      const existingAfterPhotos = JSON.parse(loan.after_photos_json || '[]');
      const combinedAfterPhotos = [...existingAfterPhotos, ...newAfterPhotos];
      const returnReceiver = String(body.return_receiver || '').trim();

      const isQcPhase = loan.status === 'Pending_QC' || Boolean(body.is_qc_completion);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const ri of returnItems) {
          const loanItem = db.prepare('SELECT * FROM loan_items WHERE loan_id = ? AND tag_id = ?').get(loanId, ri.tag_id);
          if (!loanItem) continue;

          const returnedAcc = Array.isArray(ri.returned_accessories) ? ri.returned_accessories : [];
          const missingAcc = Array.isArray(ri.missing_accessories) ? ri.missing_accessories : [];
          const qcNote = String(ri.qc_note || '').trim();

          if (isQcPhase) {
            // STEP 2: In QC queue -> Approving QC inspection
            const qcStatus = ri.qc_status === 'Fail' || missingAcc.length > 0 ? 'Fail' : 'Pass';
            const isSaleItem = (loanItem.source_snapshot || 'Demo') === 'คลังขาย';
            const isSupplierItem = (loanItem.source_snapshot || 'Demo') === 'Supplier';

            if (isSaleItem || isSupplierItem) {
              // Sale and Supplier items must proceed to "คืน Supplier,คลังขาย" step
              db.prepare(`
                UPDATE loan_items
                SET returned = 0,
                    returned_accessories_json = ?,
                    missing_accessories_json = ?,
                    qc_status = ?,
                    qc_note = ?,
                    returned_to_location = 0
                WHERE id = ?
              `).run(
                JSON.stringify(returnedAcc),
                JSON.stringify(missingAcc),
                qcStatus,
                qcNote,
                loanItem.id
              );
            } else {
              // Standard Demo items are restocked into Available Demo inventory
              const returnedToLoc = 1;

              db.prepare(`
                UPDATE loan_items
                SET returned = 1,
                    returned_at = COALESCE(returned_at, datetime('now', 'localtime')),
                    returned_accessories_json = ?,
                    missing_accessories_json = ?,
                    qc_status = ?,
                    qc_note = ?,
                    returned_to_location = ?
                WHERE id = ?
              `).run(
                JSON.stringify(returnedAcc),
                JSON.stringify(missingAcc),
                qcStatus,
                qcNote,
                returnedToLoc,
                loanItem.id
              );

              if (qcStatus === 'Pass') {
                db.prepare(`
                  UPDATE assets
                  SET status = 'Available',
                      current_loan_id = NULL,
                      issue_note = '',
                      missing_tags_json = '[]',
                      updated_at = datetime('now', 'localtime')
                  WHERE tag_id = ?
                `).run(ri.tag_id);
              } else {
                const issueParts = [];
                if (missingAcc.length > 0) issueParts.push(`ขาด: ${missingAcc.join(', ')}`);
                if (qcNote) issueParts.push(qcNote);
                const issueText = issueParts.join(' | ') || 'มีตำหนิ/อุปกรณ์ไม่ครบ';

                db.prepare(`
                  UPDATE assets
                  SET status = 'Available',
                      current_loan_id = NULL,
                      issue_note = ?,
                      missing_tags_json = ?,
                      updated_at = datetime('now', 'localtime')
                  WHERE tag_id = ?
                `).run(issueText, JSON.stringify(missingAcc), ri.tag_id);
              }
            }
          } else {
            // STEP 1: Receiving from customer -> Send to QC queue or Supplier/Sale Return queue
            db.prepare(`
              UPDATE loan_items
              SET returned = 0,
                  returned_at = datetime('now', 'localtime'),
                  returned_accessories_json = ?,
                  missing_accessories_json = ?,
                  qc_status = 'Pending',
                  qc_note = ?,
                  returned_to_location = 0
              WHERE id = ?
            `).run(
              JSON.stringify(returnedAcc),
              JSON.stringify(missingAcc),
              qcNote,
              loanItem.id
            );

            // Asset moves to In_QC awaiting inspection / return
            db.prepare(`
              UPDATE assets
              SET status = 'In_QC',
                  updated_at = datetime('now', 'localtime')
              WHERE tag_id = ?
            `).run(ri.tag_id);
          }
        }

        let nextLoanStatus;
        if (isQcPhase) {
          const allLoanItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
          // If there are any Supplier or Sale items waiting for final supplier/sale return step
          const hasPendingSupplierOrSale = allLoanItems.some(i => 
            ((i.source_snapshot || 'Demo') === 'Supplier' || (i.source_snapshot || 'Demo') === 'คลังขาย') && i.returned !== 1
          );
          if (hasPendingSupplierOrSale) {
            nextLoanStatus = 'Pending_Return_Supplier_Sale';
          } else {
            const allComplete = allLoanItems.every(i => i.returned === 1);
            nextLoanStatus = allComplete ? 'Returned' : 'Partially_Returned';
          }
        } else {
          // If all returning items are Supplier items, skip QC directly to "คืน Supplier,คลังขาย"
          const allLoanItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
          const returnedTagIds = new Set(returnItems.map(ri => ri.tag_id));
          const returningItems = allLoanItems.filter(i => returnedTagIds.has(i.tag_id));
          const hasSupplierOnly = returningItems.length > 0 && returningItems.every(i => (i.source_snapshot || 'Demo') === 'Supplier');
          nextLoanStatus = hasSupplierOnly ? 'Pending_Return_Supplier_Sale' : 'Pending_QC';
        }

        db.prepare(`
          UPDATE loans
          SET after_photos_json = ?,
              return_receiver = COALESCE(NULLIF(?, ''), return_receiver),
              status = ?,
              return_date = CASE WHEN ? = 'Returned' THEN datetime('now', 'localtime') ELSE return_date END
          WHERE id = ?
        `).run(
          JSON.stringify(combinedAfterPhotos),
          returnReceiver,
          nextLoanStatus,
          nextLoanStatus,
          loanId
        );

        if (body.customer_company && body.customer_company.trim()) {
          try {
            db.prepare(`
              INSERT INTO customers (name, contact_name, phone, source) VALUES (?, ?, ?, 'custom')
              ON CONFLICT(name) DO UPDATE SET 
                contact_name = CASE WHEN customers.contact_name = '' AND excluded.contact_name != '' THEN excluded.contact_name ELSE customers.contact_name END,
                phone = CASE WHEN customers.phone = '' AND excluded.phone != '' THEN excluded.phone ELSE customers.phone END,
                created_at = datetime('now', 'localtime')
            `).run(body.customer_company.trim(), body.customer_name || '', body.customer_phone || '');
          } catch (_) {}
        }

        db.exec('COMMIT');
        notifyStateChange('return_loan', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Complete Supplier & Sales Stock Return (ขั้นตอน "คืน Supplier,คลังขาย")
    if (pathname.match(/^\/api\/loans\/[^/]+\/complete-supplier-sale-return$/) && req.method === 'POST') {
      const loanId = pathname.split('/')[3];
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
      if (!loan) return sendJson(res, 404, { error: 'ไม่พบใบยืมนี้' });

      const body = await parseJsonBody(req);
      const supplierReceiver = String(body.supplier_return_receiver || '').trim();
      const supplierSender = String(body.supplier_return_sender || '').trim();
      const supplierTimestamp = String(body.supplier_return_timestamp || '').trim();
      const supplierNote = String(body.supplier_return_note || '').trim();
      const supplierPhotos = (Array.isArray(body.supplier_return_photos) ? body.supplier_return_photos : [])
        .map(p => saveBase64Image(p, `ret-sup-${loanId}`))
        .filter(Boolean);

      const saleSender = String(body.sale_return_sender || '').trim();
      const saleTimestamp = String(body.sale_return_timestamp || '').trim();
      const saleNote = String(body.sale_return_note || '').trim();
      const saleActions = body.sale_actions || {}; // { [tag_id]: 'convert_to_demo' | 'return_to_sale' }

      db.exec('BEGIN TRANSACTION');
      try {
        const loanItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
        for (const it of loanItems) {
          const src = it.source_snapshot || 'Demo';
          if (src === 'Supplier') {
            db.prepare(`
              UPDATE loan_items
              SET returned = 1,
                  returned_at = COALESCE(NULLIF(?, ''), datetime('now', 'localtime')),
                  return_action = 'return_to_supplier',
                  returned_to_location = 1
              WHERE id = ?
            `).run(supplierTimestamp, it.id);

            if (it.tag_id) {
              db.prepare(`
                UPDATE assets
                SET status = 'Available',
                    current_loan_id = NULL,
                    updated_at = datetime('now', 'localtime')
                WHERE tag_id = ?
              `).run(it.tag_id);
            }
          } else if (src === 'คลังขาย') {
            const action = saleActions[it.tag_id] === 'convert_to_demo' ? 'convert_to_demo' : 'return_to_sale';
            db.prepare(`
              UPDATE loan_items
              SET returned = 1,
                  returned_at = COALESCE(NULLIF(?, ''), datetime('now', 'localtime')),
                  return_action = ?,
                  returned_to_location = 1
              WHERE id = ?
            `).run(action, it.id);

            if (it.tag_id) {
              if (action === 'convert_to_demo') {
                db.prepare(`
                  UPDATE assets
                  SET source = 'Demo',
                      location = 'Main Stock (ตู้โชว์/คลังกลาง)',
                      status = 'Available',
                      current_loan_id = NULL,
                      updated_at = datetime('now', 'localtime')
                  WHERE tag_id = ?
                `).run(it.tag_id);
              } else {
                db.prepare(`
                  UPDATE assets
                  SET source = 'คลังขาย',
                      status = 'Available',
                      current_loan_id = NULL,
                      updated_at = datetime('now', 'localtime')
                  WHERE tag_id = ?
                `).run(it.tag_id);
              }
            }
          }
        }

        const updatedLoanItems = db.prepare('SELECT * FROM loan_items WHERE loan_id = ?').all(loanId);
        const allDone = updatedLoanItems.every(i => i.returned === 1);
        const finalStatus = allDone ? 'Returned' : 'Partially_Returned';

        const existingPhotos = JSON.parse(loan.supplier_return_photos_json || '[]');
        const combinedPhotos = [...existingPhotos, ...supplierPhotos];

        db.prepare(`
          UPDATE loans
          SET supplier_return_receiver = COALESCE(NULLIF(?, ''), supplier_return_receiver),
              supplier_return_sender = COALESCE(NULLIF(?, ''), supplier_return_sender),
              supplier_return_timestamp = COALESCE(NULLIF(?, ''), supplier_return_timestamp),
              supplier_return_note = COALESCE(NULLIF(?, ''), supplier_return_note),
              supplier_return_photos_json = ?,
              sale_return_sender = COALESCE(NULLIF(?, ''), sale_return_sender),
              sale_return_timestamp = COALESCE(NULLIF(?, ''), sale_return_timestamp),
              sale_return_note = COALESCE(NULLIF(?, ''), sale_return_note),
              sale_return_action_json = ?,
              status = ?,
              return_date = CASE WHEN ? = 'Returned' THEN datetime('now', 'localtime') ELSE return_date END
          WHERE id = ?
        `).run(
          supplierReceiver,
          supplierSender,
          supplierTimestamp,
          supplierNote,
          JSON.stringify(combinedPhotos),
          saleSender,
          saleTimestamp,
          saleNote,
          JSON.stringify(saleActions),
          finalStatus,
          finalStatus,
          loanId
        );

        db.exec('COMMIT');
        notifyStateChange('complete_supplier_sale_return', { id: loanId });
        return sendJson(res, 200, getFullState());
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: err.message });
      }
    }

    // ========================================================================
    // ASSET MASTER DATABASE APIS
    // ========================================================================

    if (pathname === '/api/assets/next-tag' && req.method === 'GET') {
      return sendJson(res, 200, { nextTagId: getNextActTagId() });
    }

    if (pathname === '/api/assets' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      let tagId = (body.tag_id || '').trim();
      const model = (body.model || '').trim();
      const serialNo = (body.serial_no || '').trim();
      const brand = (body.brand || '').trim();
      const category = (body.category || 'Mobile Computer').trim();
      const source = (body.source || 'Demo').trim();
      const location = (body.location || 'Main Stock (ตู้โชว์/คลังกลาง)').trim();
      const freeNote = (body.free_note || '').trim();
      let rawImages = [];
      if (Array.isArray(body.images)) {
        rawImages = body.images.filter(Boolean);
      } else if (body.image_url) {
        rawImages = [String(body.image_url).trim()];
      }
      const imageUrl = rawImages[0] || (body.image_url || '').trim();
      const imagesJson = JSON.stringify(rawImages);
      const accessories = Array.isArray(body.accessories) ? body.accessories : [];

      if (!model) {
        return sendJson(res, 400, { error: 'กรุณาระบุรุ่นสินค้า (Model)' });
      }
      if (!serialNo) {
        return sendJson(res, 400, { error: 'กรุณาระบุ Serial Number (S/N)' });
      }

      if (!tagId) {
        tagId = getNextActTagId();
      }

      // Check if tagId already exists
      const existingTag = db.prepare('SELECT tag_id FROM assets WHERE tag_id = ?').get(tagId);
      if (existingTag) {
        return sendJson(res, 400, { error: `รหัสทรัพย์สิน "${tagId}" มีอยู่ในระบบแล้ว` });
      }

      // Check if serialNo already exists
      const existingSn = db.prepare('SELECT tag_id, brand, model FROM assets WHERE LOWER(serial_no) = LOWER(?)').get(serialNo);
      if (existingSn) {
        return sendJson(res, 400, { error: `Serial Number "${serialNo}" มีอยู่ในระบบแล้ว (${existingSn.tag_id}: ${existingSn.brand} ${existingSn.model})` });
      }

      const fullName = brand ? `${brand} ${model}` : model;

      db.prepare(`
        INSERT INTO assets (
          tag_id, name, model, brand, category, serial_no,
          source, location, accessories_json, free_note, image_url, images_json, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', datetime('now', 'localtime'))
      `).run(
        tagId,
        fullName,
        model,
        brand,
        category,
        serialNo,
        source,
        location,
        JSON.stringify(accessories),
        freeNote,
        imageUrl,
        imagesJson
      );

      return sendJson(res, 201, {
        success: true,
        createdTagId: tagId,
        state: getFullState()
      });
    }

    // Asset Loan History API
    if (pathname.startsWith('/api/assets/') && pathname.endsWith('/history') && req.method === 'GET') {
      const tagId = pathname.replace('/api/assets/', '').replace('/history', '');
      const asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
      if (!asset) return sendJson(res, 404, { error: 'ไม่พบเครื่องนี้' });

      const historyRows = db.prepare(`
        SELECT 
          li.id AS item_id,
          li.tag_id,
          li.serial_no,
          li.returned,
          li.returned_at,
          li.loan_accessories_json,
          li.loan_free_note,
          l.id AS loan_id,
          l.borrower_name,
          l.borrower_phone,
          l.customer_company,
          l.customer_name,
          l.purpose,
          l.checkout_date,
          l.due_date,
          l.return_date,
          l.status AS loan_status,
          l.created_at
        FROM loan_items li
        JOIN loans l ON li.loan_id = l.id
        WHERE li.tag_id = ? OR (li.serial_no = ? AND ? != '')
        ORDER BY l.checkout_date DESC, l.created_at DESC
      `).all(tagId, asset.serial_no || '', asset.serial_no || '');

      const history = historyRows.map(r => ({
        ...r,
        returned: Boolean(r.returned),
        loan_accessories: JSON.parse(r.loan_accessories_json || '[]')
      }));

      const dispositionLogs = db.prepare(`
        SELECT * FROM asset_disposition_logs
        WHERE tag_id = ?
        ORDER BY action_date DESC, created_at DESC
      `).all(tagId);

      return sendJson(res, 200, {
        tag_id: tagId,
        serial_no: asset.serial_no,
        total_loans: history.length,
        history,
        disposition_logs: dispositionLogs
      });
    }

    // Dispose Asset from system (จำหน่ายเครื่องออกจากระบบ)
    if (pathname.startsWith('/api/assets/') && pathname.endsWith('/dispose') && req.method === 'POST') {
      const tagId = pathname.replace('/api/assets/', '').replace('/dispose', '');
      const asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
      if (!asset) return sendJson(res, 404, { error: 'ไม่พบเครื่องนี้' });

      if (asset.status === 'On_Loan') {
        return sendJson(res, 400, { error: 'ไม่สามารถจำหน่ายได้เนื่องจากเครื่องกำลังถูกยืมอยู่ กรุณารับคืนก่อน' });
      }

      const body = await parseJsonBody(req);
      const actionDate = (body.action_date || new Date().toISOString().split('T')[0]).trim();
      const reason = (body.reason || 'จำหน่ายออก').trim();
      const note = (body.note || '').trim();
      const userName = (body.user_name || '').trim();

      db.prepare(`
        UPDATE assets
        SET status = 'Disposed',
            disposed_at = ?,
            disposed_reason = ?,
            disposed_note = ?,
            disposed_by = ?,
            updated_at = datetime('now', 'localtime')
        WHERE tag_id = ?
      `).run(actionDate, reason, note, userName, tagId);

      db.prepare(`
        INSERT INTO asset_disposition_logs (tag_id, action, action_date, reason, note, user_name)
        VALUES (?, 'dispose', ?, ?, ?, ?)
      `).run(tagId, actionDate, reason, note, userName);

      return sendJson(res, 200, {
        success: true,
        message: 'บันทึกจำหน่ายเครื่องออกจากระบบเรียบร้อยแล้ว',
        state: getFullState()
      });
    }

    // Reactivate Asset back into system (นำเครื่องกลับเข้าคลัง / ใช้งานต่อ)
    if (pathname.startsWith('/api/assets/') && pathname.endsWith('/reactivate') && req.method === 'POST') {
      const tagId = pathname.replace('/api/assets/', '').replace('/reactivate', '');
      const asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
      if (!asset) return sendJson(res, 404, { error: 'ไม่พบเครื่องนี้' });

      const body = await parseJsonBody(req);
      const actionDate = (body.action_date || new Date().toISOString().split('T')[0]).trim();
      const location = (body.location || asset.location || 'คลังกลาง').trim();
      const note = (body.note || 'นำเครื่องกลับมาใช้งานต่อ').trim();
      const userName = (body.user_name || '').trim();

      db.prepare(`
        UPDATE assets
        SET status = 'Available',
            location = ?,
            disposed_at = NULL,
            disposed_reason = NULL,
            disposed_note = NULL,
            disposed_by = NULL,
            updated_at = datetime('now', 'localtime')
        WHERE tag_id = ?
      `).run(location, tagId);

      db.prepare(`
        INSERT INTO asset_disposition_logs (tag_id, action, action_date, reason, note, user_name)
        VALUES (?, 'reactivate', ?, 'นำกลับเข้าคลัง', ?, ?)
      `).run(tagId, actionDate, note, userName);

      return sendJson(res, 200, {
        success: true,
        message: 'นำเครื่องกลับเข้าคลังและเปิดใช้งานเรียบร้อยแล้ว',
        state: getFullState()
      });
    }

    // Update Asset inline in Master Database view
    if (pathname.startsWith('/api/assets/') && req.method === 'PATCH') {
      const tagId = pathname.replace('/api/assets/', '');
      const asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
      if (!asset) return sendJson(res, 404, { error: 'ไม่พบเครื่องนี้' });

      const body = await parseJsonBody(req);
      let imagesVal = null;
      let primaryImgVal = null;
      if (Array.isArray(body.images)) {
        imagesVal = JSON.stringify(body.images.filter(Boolean));
        primaryImgVal = body.images[0] || '';
      } else if (body.image_url !== undefined) {
        primaryImgVal = String(body.image_url).trim();
        imagesVal = primaryImgVal ? JSON.stringify([primaryImgVal]) : '[]';
      }

      db.prepare(`
        UPDATE assets
        SET source = COALESCE(?, source),
            location = COALESCE(?, location),
            free_note = COALESCE(?, free_note),
            accessories_json = COALESCE(?, accessories_json),
            image_url = CASE WHEN ? IS NOT NULL THEN ? ELSE image_url END,
            images_json = CASE WHEN ? IS NOT NULL THEN ? ELSE images_json END,
            updated_at = datetime('now', 'localtime')
        WHERE tag_id = ?
      `).run(
        body.source !== undefined ? body.source : null,
        body.location !== undefined ? body.location : null,
        body.free_note !== undefined ? body.free_note : null,
        body.accessories !== undefined ? JSON.stringify(body.accessories) : null,
        primaryImgVal !== null ? 1 : null,
        primaryImgVal,
        imagesVal !== null ? 1 : null,
        imagesVal,
        tagId
      );
      return sendJson(res, 200, getFullState());
    }

    // Delete Asset completely from system
    if (pathname.startsWith('/api/assets/') && req.method === 'DELETE') {
      const tagId = pathname.replace('/api/assets/', '');
      const asset = db.prepare('SELECT * FROM assets WHERE tag_id = ?').get(tagId);
      if (!asset) return sendJson(res, 404, { error: 'ไม่พบเครื่องนี้' });

      if (asset.status === 'On_Loan') {
        return sendJson(res, 400, { error: 'ไม่สามารถลบเครื่องที่กำลังถูกยืมอยู่ได้' });
      }

      db.exec('BEGIN TRANSACTION');
      try {
        db.prepare('DELETE FROM loan_items WHERE tag_id = ?').run(tagId);
        db.prepare('DELETE FROM asset_disposition_logs WHERE tag_id = ?').run(tagId);
        db.prepare('DELETE FROM assets WHERE tag_id = ?').run(tagId);
        db.exec('COMMIT');

        notifyStateChange('delete_asset', { tag_id: tagId });
        return sendJson(res, 200, { success: true, message: `ลบเครื่อง ${tagId} ออกจากระบบเรียบร้อยแล้ว`, state: getFullState() });
      } catch (err) {
        db.exec('ROLLBACK');
        return sendJson(res, 500, { error: 'เกิดข้อผิดพลาดในการลบเครื่อง: ' + err.message });
      }
    }

    if (pathname.startsWith('/uploads/')) {
      const safeName = path.basename(pathname);
      let filePath = path.join(UPLOADS_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        const fallbackPath = path.join(__dirname, 'uploads', safeName);
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        }
      }
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400'
        });
        return fs.createReadStream(filePath).pipe(res);
      }
      res.writeHead(404);
      return res.end('Not found');
    }

    let staticPath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(PUBLIC_DIR, path.normalize(staticPath).replace(/^(\.\.(\/|\\|$))+/, ''));
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      return fs.createReadStream(fullPath).pipe(res);
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`activeASSET v2 Kanban running at http://0.0.0.0:${PORT}`);
});
