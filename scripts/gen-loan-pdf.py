#!/usr/bin/env python3
"""
activeASSET — Loan PDF Generator
สร้าง PDF ใบยืมทรัพย์สิน หรือ ใบคืน จาก SQLite database

Usage:
  python3 gen-loan-pdf.py <docNo> [--type loan|return] --output <path>

Output: PDF file at --output path
"""
import sys
import os
import sqlite3
import json
import argparse
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Register Thai font (FreeSerif supports Thai + Latin)
FREE_SERIF_REGULAR = '/usr/share/fonts/truetype/freefont/FreeSerif.ttf'
FREE_SERIF_BOLD = '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf'
FREE_SERIF_ITALIC = '/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf'
FREE_SERIF_BOLDITALIC = '/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf'
pdfmetrics.registerFont(TTFont('ThaiFont', FREE_SERIF_REGULAR))
pdfmetrics.registerFont(TTFont('ThaiFont-Bold', FREE_SERIF_BOLD))
pdfmetrics.registerFont(TTFont('ThaiFont-Italic', FREE_SERIF_ITALIC))
pdfmetrics.registerFont(TTFont('ThaiFont-BoldItalic', FREE_SERIF_BOLDITALIC))
registerFontFamily('ThaiFont', normal='ThaiFont', bold='ThaiFont-Bold',
                   italic='ThaiFont-Italic', boldItalic='ThaiFont-BoldItalic')

# Alias for backward compat
THAI_FONT = 'ThaiFont'
THAI_FONT_BOLD = 'ThaiFont-Bold'

# Colors
COLOR_PRIMARY = HexColor('#0f172a')
COLOR_ACCENT = HexColor('#1e40af')
COLOR_MUTED = HexColor('#64748b')
COLOR_BORDER = HexColor('#cbd5e1')
COLOR_BG_LIGHT = HexColor('#f8fafc')
COLOR_EMERALD = HexColor('#059669')
COLOR_AMBER = HexColor('#d97706')

DB_PATH = '/home/z/my-project/db/custom.db'

# Helpers
def parse_json(value):
    if value is None:
        return []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return []

def fmt_date(value):
    if not value:
        return '-'
    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        else:
            dt = value
        return dt.strftime('%d/%m/%Y')
    except Exception:
        return str(value)

def fmt_datetime(value):
    if not value:
        return '-'
    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        else:
            dt = value
        return dt.strftime('%d/%m/%Y %H:%M')
    except Exception:
        return str(value)

# Status labels (Thai)
LOAN_STATUS_LABELS = {
    'Requested': 'รอจัด',
    'Dispatching': 'กำลังจัด',
    'Dispatched': 'รอส่งมอบ',
    'Delivered': 'กำลังยืม',
    'Partially_Returned': 'คืนบางส่วน',
    'Returned': 'คืนครบแล้ว',
    'Queued': 'ติดคิว',
    'Cancelled': 'ยกเลิก',
}
SOURCE_LABELS = {
    'Demo_Stock': 'คลังเดโม',
    'Sales_Stock': 'คลังขาย',
    'Supplier': 'ยืมจาก Supplier',
}
PURPOSE_LABELS = {
    'Demo': 'เดโมให้ลูกค้า',
    'Standby_Repair': 'เครื่องสำรองระหว่างซ่อม',
    'Internal_Test': 'ทดสอบภายใน',
    'POC': 'POC (ทดสอบระบบ)',
}
INDUSTRY_LABELS = {
    'Logistics': 'โลจิสติกส์',
    'Retail': 'ค้าปลีก',
    'Garment': 'การ์เมนต์',
    'Healthcare': 'การแพทย์',
    'Manufacturing': 'การผลิต',
    'Other': 'อื่นๆ',
}

def get_loan_data(conn, doc_no):
    cur = conn.cursor()
    # Loan
    cur.execute('''
        SELECT docNo, customerName, customerCompany, customerIndustry,
               salesRepName, purpose, industry, requestedAt, expectedReturnDate,
               dispatchedBy, dispatchedAt, deliveredBy, deliveredAt,
               customerSignAt, customerSignBy, customerSignature,
               closedAt, status, termsAndNotes
        FROM LoanTransaction WHERE docNo = ?
    ''', (doc_no,))
    loan = cur.fetchone()
    if not loan:
        return None
    loan_keys = [d[0] for d in cur.description]
    loan = dict(zip(loan_keys, loan))

    # Request lines
    cur.execute('''
        SELECT rl.id, rl.quantity, rl.fulfilledQty, rl.notes,
               c.model, c.brand, c.category, c.defaultAccessories
        FROM LoanRequestLine rl
        JOIN ProductCatalog c ON rl.catalogId = c.id
        WHERE rl.loanDocNo = ?
        ORDER BY rl.id
    ''', (doc_no,))
    loan['requestLines'] = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]

    # Loan line items
    cur.execute('''
        SELECT lli.id, lli.assetTagId, lli.source, lli.accessoriesHandedOver,
               lli.conditionPhoto, lli.dispatchedBy, lli.dispatchedAt,
               lli.status, lli.returnedAt,
               a.serialNo, a.conditionGrade,
               c.model as cat_model, c.brand as cat_brand
        FROM LoanLineItem lli
        JOIN AssetUnit a ON lli.assetTagId = a.tagId
        JOIN ProductCatalog c ON a.catalogId = c.id
        WHERE lli.loanDocNo = ?
        ORDER BY lli.id
    ''', (doc_no,))
    loan['lines'] = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]

    # Photos for each line
    for line in loan['lines']:
        cur.execute('SELECT photoPath, caption FROM AssetPhoto WHERE loanLineItemId = ?', (line['id'],))
        line['photos'] = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]

    # Return events
    cur.execute('''
        SELECT re.id, re.returnDate, re.inspectorName, re.inspectorSignAt, re.notes
        FROM ReturnEvent re
        WHERE re.loanDocNo = ?
        ORDER BY re.returnDate DESC
    ''', (doc_no,))
    loan['returnEvents'] = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]

    # Return event items
    for ev in loan['returnEvents']:
        cur.execute('''
            SELECT rei.conditionGrade, rei.isDamaged, rei.damageDescription,
                   rei.sendToRepair, rei.returnToSource, rei.accessoriesReturned,
                   a.tagId, a.serialNo, c.model, c.brand
            FROM ReturnEventItem rei
            JOIN LoanLineItem lli ON rei.loanLineItemId = lli.id
            JOIN AssetUnit a ON lli.assetTagId = a.tagId
            JOIN ProductCatalog c ON a.catalogId = c.id
            WHERE rei.returnEventId = ?
        ''', (ev['id'],))
        ev['items'] = [dict(zip([d[0] for d in cur.description], row)) for row in cur.fetchall()]

    return loan


def build_loan_pdf(loan, output_path):
    """Build loan PDF (ใบยืม)"""
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm
    )
    styles = getSampleStyleSheet()
    # Override fonts to Loma (Thai support)
    body_style = ParagraphStyle('ThaiBody', parent=styles['Normal'], fontName='ThaiFont', fontSize=10, leading=14)
    body_bold = ParagraphStyle('ThaiBold', parent=body_style, fontName='ThaiFont-Bold')
    h1_style = ParagraphStyle('ThaiH1', parent=styles['Heading1'], fontName='ThaiFont-Bold', fontSize=18, textColor=COLOR_PRIMARY, spaceAfter=6)
    h2_style = ParagraphStyle('ThaiH2', parent=styles['Heading2'], fontName='ThaiFont-Bold', fontSize=12, textColor=COLOR_PRIMARY, spaceBefore=10, spaceAfter=4)
    small_style = ParagraphStyle('ThaiSmall', parent=body_style, fontSize=8, textColor=COLOR_MUTED)
    center_style = ParagraphStyle('ThaiCenter', parent=body_style, alignment=TA_CENTER)

    story = []

    # Header
    story.append(Paragraph('activeASSET', ParagraphStyle('Brand', parent=h1_style, fontSize=20, textColor=COLOR_ACCENT)))
    story.append(Paragraph('ระบบบริหารทรัพย์สินถาวรและเครื่องเดโม', small_style))
    story.append(Spacer(1, 4*mm))

    # Title + doc no
    title_data = [[
        Paragraph(f'<b>ใบยืมทรัพย์สิน</b>', ParagraphStyle('Title', parent=h2_style, fontSize=16)),
        Paragraph(f'<b>เลขที่:</b> {loan["docNo"]}<br/><b>สถานะ:</b> {LOAN_STATUS_LABELS.get(loan["status"], loan["status"])}', ParagraphStyle('DocNo', parent=body_style, alignment=TA_RIGHT))
    ]]
    title_table = Table(title_data, colWidths=[100*mm, 80*mm])
    title_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 1, COLOR_PRIMARY),
    ]))
    story.append(title_table)
    story.append(Spacer(1, 4*mm))

    # Customer info
    story.append(Paragraph('ข้อมูลลูกค้า', h2_style))
    cust_data = [
        ['ชื่อลูกค้า:', loan['customerName'], 'บริษัท:', loan.get('customerCompany') or '-'],
        ['อุตสาหกรรม:', INDUSTRY_LABELS.get(loan.get('customerIndustry'), loan.get('customerIndustry') or '-'), 'พนักงานขาย:', loan.get('salesRepName') or '-'],
        ['วัตถุประสงค์:', PURPOSE_LABELS.get(loan.get('purpose'), loan.get('purpose') or '-'), 'วันที่ขอยืม:', fmt_date(loan.get('requestedAt'))],
        ['กำหนดคืน:', fmt_date(loan.get('expectedReturnDate')), 'วันที่ส่งมอบ:', fmt_date(loan.get('deliveredAt'))],
    ]
    cust_table = Table(cust_data, colWidths=[25*mm, 55*mm, 25*mm, 55*mm])
    cust_table.setStyle(TableStyle([
        ('FONT', (0,0), (-1,-1), 'ThaiFont', 9),
        ('FONT', (0,0), (0,-1), 'ThaiFont-Bold', 9),
        ('FONT', (2,0), (2,-1), 'ThaiFont-Bold', 9),
        ('TEXTCOLOR', (0,0), (0,-1), COLOR_MUTED),
        ('TEXTCOLOR', (2,0), (2,-1), COLOR_MUTED),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(cust_table)
    story.append(Spacer(1, 4*mm))

    # Request lines (what was requested)
    if loan['requestLines']:
        story.append(Paragraph('รายการที่ Sales ขอยืม', h2_style))
        req_data = [['#', 'ยี่ห้อ', 'รุ่น', 'จำนวน', 'จัดได้', 'หมายเหตุ']]
        for i, rl in enumerate(loan['requestLines'], 1):
            req_data.append([
                str(i), rl['brand'], rl['model'],
                str(rl['quantity']), str(rl['fulfilledQty']),
                rl.get('notes') or '-'
            ])
        req_table = Table(req_data, colWidths=[8*mm, 30*mm, 35*mm, 15*mm, 15*mm, 67*mm])
        req_table.setStyle(TableStyle([
            ('FONT', (0,0), (-1,0), 'ThaiFont-Bold', 9),
            ('FONT', (0,1), (-1,-1), 'ThaiFont', 9),
            ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), white),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('ALIGN', (3,0), (4,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(req_table)
        story.append(Spacer(1, 4*mm))

    # Dispatched lines (actual units)
    if loan['lines']:
        story.append(Paragraph('รายการเครื่องที่จัดจริง', h2_style))
        line_data = [['#', 'Tag ID', 'Serial No.', 'ยี่ห้อ รุ่น', 'Source', 'อุปกรณ์เสริม', 'สถานะ']]
        for i, line in enumerate(loan['lines'], 1):
            accs = parse_json(line.get('accessoriesHandedOver'))
            acc_str = ', '.join(accs) if accs else '-'
            source_label = SOURCE_LABELS.get(line.get('source'), line.get('source') or '-')
            status_label = 'คืนแล้ว' if line.get('status') == 'Returned' else 'ค้างอยู่'
            line_data.append([
                str(i), line['assetTagId'], line.get('serialNo') or '-',
                f"{line.get('cat_brand', '')} {line.get('cat_model', '')}",
                source_label, acc_str[:60] + ('...' if len(acc_str) > 60 else ''),
                status_label,
            ])
        line_table = Table(line_data, colWidths=[6*mm, 18*mm, 30*mm, 30*mm, 22*mm, 45*mm, 19*mm])
        line_table.setStyle(TableStyle([
            ('FONT', (0,0), (-1,0), 'ThaiFont-Bold', 8),
            ('FONT', (0,1), (-1,-1), 'ThaiFont', 8),
            ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), white),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(line_table)
        story.append(Spacer(1, 4*mm))

    # Terms
    if loan.get('termsAndNotes'):
        story.append(Paragraph('เงื่อนไขและหมายเหตุ', h2_style))
        story.append(Paragraph(loan['termsAndNotes'], body_style))
        story.append(Spacer(1, 4*mm))

    # Customer signature
    if loan.get('customerSignAt'):
        story.append(Paragraph('ลูกค้าลงนามรับของ', h2_style))
        sig_data = [[
            Paragraph(f'<b>ผู้ลงนาม:</b> {loan.get("customerSignBy") or "-"}<br/><b>วันที่:</b> {fmt_datetime(loan.get("customerSignAt"))}', body_style),
        ]]
        sig_table = Table(sig_data, colWidths=[100*mm])
        sig_table.setStyle(TableStyle([
            ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(sig_table)
        # Embed signature image if available
        if loan.get('customerSignature'):
            sig_data_str = loan['customerSignature']
            if sig_data_str.startswith('data:image/png;base64,'):
                import base64
                img_bytes = base64.b64decode(sig_data_str.split(',')[1])
                img_path = '/tmp/_sig.png'
                with open(img_path, 'wb') as f:
                    f.write(img_bytes)
                story.append(Spacer(1, 2*mm))
                story.append(RLImage(img_path, width=60*mm, height=30*mm))

    # Footer
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(f'สร้างเมื่อ: {fmt_datetime(datetime.now())} • activeASSET — ใบยืมทรัพย์สิน', small_style))

    doc.build(story)


def build_return_pdf(loan, output_path):
    """Build return receipt PDF (ใบคืน)"""
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm
    )
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle('ThaiBody', parent=styles['Normal'], fontName='ThaiFont', fontSize=10, leading=14)
    h1_style = ParagraphStyle('ThaiH1', parent=styles['Heading1'], fontName='ThaiFont-Bold', fontSize=18, textColor=COLOR_PRIMARY, spaceAfter=6)
    h2_style = ParagraphStyle('ThaiH2', parent=styles['Heading2'], fontName='ThaiFont-Bold', fontSize=12, textColor=COLOR_PRIMARY, spaceBefore=10, spaceAfter=4)
    small_style = ParagraphStyle('ThaiSmall', parent=body_style, fontSize=8, textColor=COLOR_MUTED)

    story = []
    # Header
    story.append(Paragraph('activeASSET', ParagraphStyle('Brand', parent=h1_style, fontSize=20, textColor=COLOR_ACCENT)))
    story.append(Paragraph('ระบบบริหารทรัพย์สินถาวรและเครื่องเดโม', small_style))
    story.append(Spacer(1, 4*mm))

    # Title
    title_data = [[
        Paragraph(f'<b>ใบคืนทรัพย์สิน</b>', ParagraphStyle('Title', parent=h2_style, fontSize=16)),
        Paragraph(f'<b>อ้างอิงใบยืม:</b> {loan["docNo"]}<br/><b>สถานะใบยืม:</b> {LOAN_STATUS_LABELS.get(loan["status"], loan["status"])}', ParagraphStyle('DocNo', parent=body_style, alignment=TA_RIGHT))
    ]]
    title_table = Table(title_data, colWidths=[100*mm, 80*mm])
    title_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 1, COLOR_PRIMARY),
    ]))
    story.append(title_table)
    story.append(Spacer(1, 4*mm))

    # Customer info
    story.append(Paragraph('ข้อมูลใบยืม', h2_style))
    cust_data = [
        ['ลูกค้า:', loan['customerName'], 'บริษัท:', loan.get('customerCompany') or '-'],
        ['พนักงาน:', loan.get('salesRepName') or '-', 'วันที่ขอยืม:', fmt_date(loan.get('requestedAt'))],
        ['กำหนดคืน:', fmt_date(loan.get('expectedReturnDate')), 'วันที่ปิด:', fmt_date(loan.get('closedAt'))],
    ]
    cust_table = Table(cust_data, colWidths=[25*mm, 55*mm, 25*mm, 55*mm])
    cust_table.setStyle(TableStyle([
        ('FONT', (0,0), (-1,-1), 'ThaiFont', 9),
        ('FONT', (0,0), (0,-1), 'ThaiFont-Bold', 9),
        ('FONT', (2,0), (2,-1), 'ThaiFont-Bold', 9),
        ('TEXTCOLOR', (0,0), (0,-1), COLOR_MUTED),
        ('TEXTCOLOR', (2,0), (2,-1), COLOR_MUTED),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(cust_table)
    story.append(Spacer(1, 4*mm))

    # Return events
    if loan['returnEvents']:
        for i, ev in enumerate(loan['returnEvents'], 1):
            story.append(Paragraph(f'ประวัติการรับคืน ครั้งที่ {i}', h2_style))
            ev_info = [
                ['วันที่คืน:', fmt_datetime(ev.get('returnDate')), 'เจ้าหน้าที่:', ev.get('inspectorName') or '-'],
                ['หมายเหตุ:', ev.get('notes') or '-', '', ''],
            ]
            ev_table = Table(ev_info, colWidths=[25*mm, 55*mm, 25*mm, 55*mm])
            ev_table.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), 'ThaiFont', 9),
                ('FONT', (0,0), (0,-1), 'ThaiFont-Bold', 9),
                ('FONT', (2,0), (2,-1), 'ThaiFont-Bold', 9),
                ('TEXTCOLOR', (0,0), (0,-1), COLOR_MUTED),
                ('TEXTCOLOR', (2,0), (2,-1), COLOR_MUTED),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('SPAN', (1,1), (3,1)),
            ]))
            story.append(ev_table)
            story.append(Spacer(1, 2*mm))

            # Items table
            if ev['items']:
                item_data = [['#', 'Tag ID', 'Serial No.', 'รุ่น', 'Grade', 'Source คืน', 'ส่งซ่อม', 'อุปกรณ์ที่คืน']]
                for j, it in enumerate(ev['items'], 1):
                    accs = parse_json(it.get('accessoriesReturned'))
                    source_str = 'ต้นทาง' if it.get('returnToSource') else 'คลังเดโม'
                    repair_str = '✓' if it.get('sendToRepair') else '-'
                    item_data.append([
                        str(j), it.get('tagId') or '-', it.get('serialNo') or '-',
                        f"{it.get('brand', '')} {it.get('model', '')}",
                        it.get('conditionGrade') or '-',
                        source_str, repair_str,
                        ', '.join(accs)[:50] + ('...' if len(', '.join(accs)) > 50 else '') if accs else '-'
                    ])
                item_table = Table(item_data, colWidths=[6*mm, 18*mm, 28*mm, 28*mm, 12*mm, 18*mm, 14*mm, 46*mm])
                item_table.setStyle(TableStyle([
                    ('FONT', (0,0), (-1,0), 'ThaiFont-Bold', 8),
                    ('FONT', (0,1), (-1,-1), 'ThaiFont', 8),
                    ('BACKGROUND', (0,0), (-1,0), COLOR_PRIMARY),
                    ('TEXTCOLOR', (0,0), (-1,0), white),
                    ('ALIGN', (0,0), (0,-1), 'CENTER'),
                    ('ALIGN', (4,0), (6,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('GRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                    ('TOPPADDING', (0,0), (-1,-1), 3),
                ]))
                story.append(item_table)
                story.append(Spacer(1, 4*mm))
    else:
        story.append(Paragraph('ยังไม่มีประวัติการรับคืน', body_style))

    # Summary
    returned_count = sum(len(ev['items']) for ev in loan['returnEvents'])
    pending_count = len([l for l in loan['lines'] if l.get('status') != 'Returned'])
    story.append(Paragraph('สรุป', h2_style))
    summary_data = [
        ['จำนวนเครื่องที่จัด:', str(len(loan['lines'])), 'เครื่อง'],
        ['จำนวนที่คืนแล้ว:', str(returned_count), 'เครื่อง'],
        ['จำนวนที่ค้างคืน:', str(pending_count), 'เครื่อง'],
    ]
    sum_table = Table(summary_data, colWidths=[40*mm, 20*mm, 20*mm])
    sum_table.setStyle(TableStyle([
        ('FONT', (0,0), (-1,-1), 'ThaiFont', 10),
        ('FONT', (0,0), (0,-1), 'ThaiFont-Bold', 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(sum_table)

    # Footer
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(f'สร้างเมื่อ: {fmt_datetime(datetime.now())} • activeASSET — ใบคืนทรัพย์สิน', small_style))

    doc.build(story)


def main():
    parser = argparse.ArgumentParser(description='Generate loan/return PDF')
    parser.add_argument('docNo', help='Loan document number (e.g., LOAN-202610-001)')
    parser.add_argument('--type', choices=['loan', 'return'], default='loan', help='PDF type')
    parser.add_argument('--output', required=True, help='Output PDF path')
    args = parser.parse_args()

    if not os.path.exists(DB_PATH):
        print(json.dumps({'error': f'DB not found: {DB_PATH}'}))
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    loan = get_loan_data(conn, args.docNo)
    conn.close()

    if not loan:
        print(json.dumps({'error': f'Loan not found: {args.docNo}'}))
        sys.exit(1)

    try:
        if args.type == 'loan':
            build_loan_pdf(loan, args.output)
        else:
            build_return_pdf(loan, args.output)
        print(json.dumps({'ok': True, 'output': args.output, 'docNo': args.docNo, 'type': args.type}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
