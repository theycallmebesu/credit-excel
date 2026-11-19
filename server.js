const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

let NepaliDateConverter = require('nepali-date-converter');
const NepaliDate = NepaliDateConverter.default || NepaliDateConverter;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_DIR = path.join(DATA_DIR, 'records');
const CUSTOMERS_PATH = path.join(DATA_DIR, 'customers.json');
const DAILY_SALES_PATH = path.join(DATA_DIR, 'daily-sales.json');
const EXPORTS_DIR = path.join(__dirname, 'exports');
const PRICE_ITEMS_PATH = path.join(DATA_DIR, 'price-items.json');
const FONT_REGULAR = path.join(__dirname, 'fonts', 'NotoSansDevanagari-Regular.ttf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'NotoSansDevanagari-Bold.ttf');

const INITIAL_CUSTOMERS = [
  "BPT GHUMBA (DEVI)",
  "REPA SIDDI GHUMBA (DOLLU)",
  "DOLLU RESORT",
  "REMANT (LAMA GAU)",
  "REJENDRA (HUMANE)",
  "VAI KALEY (KASAI)",
  "VAI KALEY (DOLLU DHYANKENDRA)",
  "VAI KALEY (GUTHI GHAR)",
  "BIA (LAMA GAU)",
  "VIM SEN",
  "CHOVAR GHUMBA",
  "TENZING GHUMBA (DEVI)",
  "BASU (SATIKHEL)",
  "BASU (DOLLU)",
  "BASU (GANESH DADA GHUMBA)",
  "BASU (DOLLU GHUMBA)",
  "BASU (KHARPA GHUMBA)",
  "SUMAN (CEMENT)"
];

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR, { recursive: true });
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  if (!fs.existsSync(CUSTOMERS_PATH)) {
    atomicWriteJson(CUSTOMERS_PATH, INITIAL_CUSTOMERS);
  }
  if (!fs.existsSync(DAILY_SALES_PATH)) {
    atomicWriteJson(DAILY_SALES_PATH, []);
  }
}

function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = { shopName: "SHREE PASUPATINATH HARDWARE", port: 3001 };
    atomicWriteJson(CONFIG_PATH, defaultConfig);
    return defaultConfig;
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { shopName: "SHREE PASUPATINATH HARDWARE", port: 3001 };
  }
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function sanitizeName(name) {
  return (name || '').replace(/[\\/:*?"<>|]/g, '-').trim();
}

function getCustomers() {
  if (!fs.existsSync(CUSTOMERS_PATH)) {
    atomicWriteJson(CUSTOMERS_PATH, INITIAL_CUSTOMERS);
    return [...INITIAL_CUSTOMERS];
  }
  try {
    const raw = fs.readFileSync(CUSTOMERS_PATH, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [...INITIAL_CUSTOMERS];
  } catch (err) {
    return [...INITIAL_CUSTOMERS];
  }
}

function addCustomerIfNew(rawName) {
  const name = (rawName || '').trim().toUpperCase();
  if (!name) return;
  const list = getCustomers();
  if (!list.includes(name)) {
    list.push(name);
    list.sort();
    atomicWriteJson(CUSTOMERS_PATH, list);
  }
}

function getCustomerRecordPath(customerName) {
  const safeName = sanitizeName(customerName);
  return path.join(RECORDS_DIR, `${safeName}.json`);
}

function getCustomerRecord(customerName) {
  const filePath = getCustomerRecordPath(customerName);
  if (!fs.existsSync(filePath)) {
    return {
      customerName: customerName.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries: []
    };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.entries)) data.entries = [];
    return data;
  } catch (err) {
    return {
      customerName: customerName.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries: []
    };
  }
}

function saveCustomerRecord(record) {
  const filePath = getCustomerRecordPath(record.customerName);
  record.updatedAt = new Date().toISOString();
  atomicWriteJson(filePath, record);
}

function getDailySales() {
  if (!fs.existsSync(DAILY_SALES_PATH)) return [];
  try {
    const raw = fs.readFileSync(DAILY_SALES_PATH, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveDailySales(list) {
  atomicWriteJson(DAILY_SALES_PATH, list);
}

function getTodayNepaliDate() {
  try {
    const nd = new NepaliDate();
    const year = nd.getYear();
    const monthIndex = nd.getMonth();
    const month = monthIndex + 1;
    const day = nd.getDate();
    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const monthName = NEPALI_MONTHS[monthIndex] || 'Baisakh';
    return { year, month, day, formatted, monthName };
  } catch (err) {
    return { year: 2083, month: 7, day: 7, formatted: '2083-07-07', monthName: 'Kartik' };
  }
}

function getPriceItems() {
  if (fs.existsSync(PRICE_ITEMS_PATH)) {
    try {
      const priceItems = JSON.parse(fs.readFileSync(PRICE_ITEMS_PATH, 'utf8'));
      if (Array.isArray(priceItems)) return priceItems;
    } catch (e) {}
  }
  return [];
}

function getItemSuggestions() {
  const itemMap = new Map(); // itemName -> { name, price }

  // 1. Price items (catalog items with names and prices)
  const priceItems = getPriceItems();
  for (const pi of priceItems) {
    if (pi && pi.name) {
      const trimmed = pi.name.trim().toUpperCase();
      if (trimmed) {
        itemMap.set(trimmed, {
          name: trimmed,
          price: pi.price != null ? String(pi.price).trim() : ''
        });
      }
    }
  }

  // 2. Credit records items
  if (fs.existsSync(RECORDS_DIR)) {
    const files = fs.readdirSync(RECORDS_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const rec = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, f), 'utf8'));
          if (Array.isArray(rec.entries)) {
            for (const e of rec.entries) {
              if (e && e.itemName) {
                const trimmed = e.itemName.trim().toUpperCase();
                if (trimmed && !itemMap.has(trimmed)) {
                  itemMap.set(trimmed, { name: trimmed, price: '' });
                }
              }
            }
          }
        } catch (e) {}
      }
    }
  }

  // 3. Daily sales items
  const sales = getDailySales();
  for (const s of sales) {
    if (s && s.itemName) {
      const trimmed = s.itemName.trim().toUpperCase();
      if (trimmed && !itemMap.has(trimmed)) {
        itemMap.set(trimmed, {
          name: trimmed,
          price: s.rate != null ? String(s.rate).trim() : ''
        });
      }
    }
  }

  // Return alphabetically sorted array of { name, price }
  return Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getItemUnitSuggestions() {
  const observations = new Map();
  const addObservation = (itemName, unit, timestamp) => {
    const name = String(itemName || '').trim().toUpperCase();
    const normalizedUnit = String(unit || '').trim().toUpperCase();
    if (!name || !normalizedUnit) return;

    const units = observations.get(name) || new Map();
    const observation = units.get(normalizedUnit) || { count: 0, latestAt: 0 };
    observation.count += 1;
    observation.latestAt = Math.max(observation.latestAt, Date.parse(timestamp) || 0);
    units.set(normalizedUnit, observation);
    observations.set(name, units);
  };

  if (fs.existsSync(RECORDS_DIR)) {
    for (const file of fs.readdirSync(RECORDS_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const record = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8'));
        if (!Array.isArray(record.entries)) continue;
        for (const entry of record.entries) {
          addObservation(entry.itemName, entry.unit, entry.updatedAt || entry.createdAt || record.updatedAt);
        }
      } catch (err) {
        console.error(`Unable to read item units from ${file}:`, err);
      }
    }
  }

  for (const sale of getDailySales()) {
    addObservation(sale.itemName, sale.unit, sale.updatedAt || sale.createdAt);
  }

  const itemUnits = {};
  for (const [name, units] of observations) {
    const [unit] = [...units.entries()].sort((a, b) =>
      b[1].count - a[1].count || b[1].latestAt - a[1].latestAt
    )[0];
    itemUnits[name] = unit;
  }
  return itemUnits;
}

// ---------------- PDF GENERATION FOR CREDIT CUSTOMER (NO RATES, NO TOTALS) ----------------
function generateCreditCustomerPdf(customerName, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const config = getConfig();
      const shopName = (config.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
      const record = getCustomerRecord(customerName);
      let entries = Array.isArray(record.entries) ? [...record.entries] : [];

      if (options.fromDate) {
        entries = entries.filter(e => String(e.date || '') >= options.fromDate);
      }
      if (options.toDate) {
        entries = entries.filter(e => String(e.date || '') <= options.toDate);
      }
      if (options.sortBy === 'itemName') {
        const dir = options.sortDir === 'desc' ? -1 : 1;
        entries.sort((a, b) => dir * String(a.itemName || '').localeCompare(String(b.itemName || '')));
      } else if (options.sortBy === 'date') {
        const dir = options.sortDir === 'desc' ? -1 : 1;
        entries.sort((a, b) => dir * String(a.date || '').localeCompare(String(b.date || '')));
      }

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
        info: { Title: `Credit Record - ${customerName}`, Author: shopName }
      });

      doc.registerFont('NotoRegular', FONT_REGULAR);
      doc.registerFont('NotoBold', FONT_BOLD);

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const margin = 30;
      const contentWidth = doc.page.width - margin * 2;
      const columns = [
        { label: 'S.N.', width: 34, align: 'center' },
        { label: 'DATE (BS)', width: 74, align: 'center' },
        { label: 'ITEM NAME / PARTICULARS', width: 205, align: 'left', bold: true },
        { label: 'UNIT', width: 58, align: 'center' },
        { label: 'QUANTITY', width: 62, align: 'center' },
        { label: 'DRIVER NAME', width: 105, align: 'left' },
        { label: 'VEHICLE NO.', width: 100, align: 'left' },
        { label: 'REMARKS / NOTES', width: contentWidth - 638, align: 'left' }
      ];
      const headerHeight = 25;
      let pageNumber = 0;

      function drawHeader() {
        pageNumber++;
        doc.font('NotoBold').fontSize(17).fillColor('#111827')
          .text(shopName, margin, margin, { width: contentWidth, align: 'center' });
        doc.font('NotoBold').fontSize(12).fillColor('#991b1b')
          .text(`CREDIT CUSTOMER RECORD - ${customerName}`, margin, margin + 24, {
            width: contentWidth, align: 'center'
          });
        const metaTop = margin + 46;
        doc.roundedRect(margin, metaTop, contentWidth, 31, 4)
          .fillAndStroke('#fef2f2', '#fecaca');
        doc.font('NotoBold').fontSize(9).fillColor('#1f2937')
          .text(`Customer: ${customerName}`, margin + 8, metaTop + 5, { width: contentWidth * 0.45 });
        doc.font('NotoRegular').fontSize(8.5);
        const range = options.fromDate || options.toDate
          ? `Date range: ${options.fromDate || 'Start'} to ${options.toDate || 'Present'}`
          : 'Date range: All dates';
        doc.text(`${entries.length} credit items  |  ${range}`, margin + 8, metaTop + 17, {
          width: contentWidth * 0.65
        });
        doc.text(`Report date (BS): ${getTodayNepaliDate().formatted}  |  Page ${pageNumber}`,
          margin + contentWidth * 0.65, metaTop + 10, {
            width: contentWidth * 0.33 - 8, align: 'right'
          });

        let x = margin;
        const tableTop = metaTop + 39;
        columns.forEach(column => {
          doc.rect(x, tableTop, column.width, headerHeight)
            .fillAndStroke('#7f1d1d', '#ffffff');
          doc.font('NotoBold').fontSize(8).fillColor('#ffffff')
            .text(column.label, x + 4, tableTop + 7, {
              width: column.width - 8, align: column.align, lineBreak: false
            });
          x += column.width;
        });
        return tableTop + headerHeight;
      }

      function measureRow(values) {
        const fontSize = 8.5;
        const padding = 8;
        const heights = values.map((value, idx) => {
          const column = columns[idx];
          doc.font(column.bold ? 'NotoBold' : 'NotoRegular').fontSize(fontSize);
          return doc.heightOfString(String(value || '-'), {
            width: column.width - padding, lineGap: 1
          });
        });
        const rowHeight = Math.max(24, ...heights.map(height => height + 8));
        return { heights, rowHeight };
      }

      function drawRow(values, y, rowIndex, measured) {
        const { heights, rowHeight } = measured;
        const fontSize = 8.5;
        const padding = 8;
        let x = margin;
        values.forEach((value, idx) => {
          const column = columns[idx];
          const textHeight = heights[idx];
          doc.rect(x, y, column.width, rowHeight)
            .fillAndStroke(rowIndex % 2 ? '#f8fafc' : '#ffffff', '#cbd5e1');
          doc.font(column.bold ? 'NotoBold' : 'NotoRegular').fontSize(fontSize)
            .fillColor('#111827')
            .text(String(value || '-'), x + 4, y + Math.max(4, (rowHeight - textHeight) / 2), {
              width: column.width - padding, align: column.align, lineGap: 1
            });
          x += column.width;
        });
        return rowHeight;
      }

      let currentY = drawHeader();
      if (entries.length === 0) {
        doc.font('NotoRegular').fontSize(10).fillColor('#475569')
          .text('No credit items recorded for this customer in the selected date range.', margin + 8, currentY + 12);
      } else {
        entries.forEach((entry, idx) => {
          const values = [
            String(idx + 1),
            entry.date || '-',
            entry.itemName || '-',
            entry.unit || '-',
            entry.quantity || '-',
            entry.driverName || '-',
            entry.vehicleNumber || '-',
            entry.remarks || '-'
          ];
          const measured = measureRow(values);
          if (currentY + measured.rowHeight > doc.page.height - margin) {
            doc.addPage();
            currentY = drawHeader();
          }
          drawRow(values, currentY, idx, measured);
          currentY += measured.rowHeight;
        });
      }

      doc.end();
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------- EXCEL (.XLSX) GENERATION FOR CREDIT CUSTOMER (NO RATES, NO TOTALS) ----------------
async function generateCreditCustomerExcel(customerName, outputPath, options = {}) {
  const config = getConfig();
  const shopName = (config.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
  const record = getCustomerRecord(customerName);
  let entries = Array.isArray(record.entries) ? [...record.entries] : [];

  if (options.fromDate) {
    entries = entries.filter(e => String(e.date || '') >= options.fromDate);
  }
  if (options.toDate) {
    entries = entries.filter(e => String(e.date || '') <= options.toDate);
  }
  if (options.sortBy === 'itemName') {
    const dir = options.sortDir === 'desc' ? -1 : 1;
    entries.sort((a, b) => dir * String(a.itemName || '').localeCompare(String(b.itemName || '')));
  } else if (options.sortBy === 'date') {
    const dir = options.sortDir === 'desc' ? -1 : 1;
    entries.sort((a, b) => dir * String(a.date || '').localeCompare(String(b.date || '')));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = shopName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Credit Ledger', {
    views: [{ showGridLines: true }]
  });

  // Title Banner
  sheet.mergeCells('A2:H2');
  const titleCell = sheet.getCell('A2');
  titleCell.value = `${shopName} - CREDIT CUSTOMER RECORD (KHATA)`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } }; // Dark Red
  sheet.getRow(2).height = 34;

  // Meta row
  const todayDate = getTodayNepaliDate().formatted;
  sheet.mergeCells('A3:D3');
  const metaLeft = sheet.getCell('A3');
  metaLeft.value = `Customer: ${customerName}`;
  metaLeft.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF7F1D1D' } };
  metaLeft.alignment = { vertical: 'middle', horizontal: 'left' };
  metaLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

  sheet.mergeCells('E3:H3');
  const metaRight = sheet.getCell('E3');
  let rangeInfo = '';
  if (options.fromDate || options.toDate) {
    rangeInfo = `   |   Range: ${options.fromDate || 'Start'} to ${options.toDate || 'Present'}`;
  }
  if (options.sortBy === 'itemName') {
    rangeInfo += `   |   Sorted (A-Z)`;
  }
  metaRight.value = `Date (BS): ${todayDate}   |   Total Items: ${entries.length}${rangeInfo}`;
  metaRight.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
  metaRight.alignment = { vertical: 'middle', horizontal: 'right' };
  metaRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sheet.getRow(3).height = 24;

  // Header row at row 5
  const headers = [
    { header: 'S.N.', key: 'sn', width: 8, align: 'center' },
    { header: 'Date (BS)', key: 'date', width: 14, align: 'center' },
    { header: 'Item Name / Particulars', key: 'itemName', width: 34, align: 'left' },
    { header: 'Unit', key: 'unit', width: 10, align: 'center' },
    { header: 'Quantity', key: 'qty', width: 12, align: 'center' },
    { header: 'Driver Name', key: 'driver', width: 20, align: 'left' },
    { header: 'Vehicle Number', key: 'vehicle', width: 18, align: 'left' },
    { header: 'Remarks / Notes', key: 'remarks', width: 26, align: 'left' }
  ];

  const headerRow = sheet.getRow(5);
  headerRow.height = 26;
  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    sheet.getColumn(colNumber).width = h.width;
    const cell = headerRow.getCell(colNumber);
    cell.value = h.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: h.align };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  let currentRowIdx = 6;
  entries.forEach((e, idx) => {
    const row = sheet.getRow(currentRowIdx);
    row.height = 22;
    const isEven = idx % 2 === 1;
    const bgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    const values = [
      idx + 1,
      e.date || '-',
      e.itemName || '-',
      e.unit || '-',
      e.quantity || '-',
      e.driverName || '-',
      e.vehicleNumber || '-',
      e.remarks || '-'
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = {
        name: 'Calibri',
        size: 10.5,
        bold: colIdx === 2,
        color: { argb: 'FF0F172A' }
      };
      cell.alignment = { vertical: 'middle', horizontal: headers[colIdx].align };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    currentRowIdx++;
  });

  // Summary Row at bottom
  const summaryRow = sheet.getRow(currentRowIdx);
  summaryRow.height = 24;
  sheet.mergeCells(`A${currentRowIdx}:H${currentRowIdx}`);
  const sumCell = summaryRow.getCell(1);
  sumCell.value = `TOTAL ITEMS ON CREDIT: ${entries.length}`;
  sumCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF7F1D1D' } };
  sumCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sumCell.border = {
    top: { style: 'medium', color: { argb: 'FF1E293B' } },
    bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
    left: { style: 'thin', color: { argb: 'FF1E293B' } },
    right: { style: 'thin', color: { argb: 'FF1E293B' } }
  };

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

// ------------------- API: CREDIT CUSTOMERS (KHATA) -------------------

app.get('/api/config', (req, res) => res.json(getConfig()));

// Customers list with counts (NO amounts)
app.get('/api/customers', (req, res) => {
  const customerNames = getCustomers();
  const list = customerNames.map(name => {
    const rec = getCustomerRecord(name);
    const count = rec.entries.length;
    let latestEntry = null;
    let latestEntryAt = 0;
    rec.entries.forEach(entry => {
      const timestamp = Date.parse(entry.updatedAt || entry.createdAt || '');
      if (!latestEntry || (Number.isFinite(timestamp) && timestamp >= latestEntryAt)) {
        latestEntry = entry;
        latestEntryAt = Number.isFinite(timestamp) ? timestamp : latestEntryAt;
      }
    });
    const updatedAt = count
      ? (rec.updatedAt || (latestEntryAt ? new Date(latestEntryAt).toISOString() : null))
      : null;
    return { name, count, updatedAt, modifiedDateBs: latestEntry ? latestEntry.date || null : null };
  });
  res.json(list);
});

app.post('/api/customers', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Customer name is required' });
  const cleanName = name.trim().toUpperCase();
  addCustomerIfNew(cleanName);
  res.json({ success: true, customer: cleanName });
});

app.put('/api/customers/:name', (req, res) => {
  const oldName = req.params.name.trim().toUpperCase();
  const newName = String(req.body && req.body.name || '').trim().toUpperCase();
  if (!newName) return res.status(400).json({ error: 'Customer name is required' });
  const customers = getCustomers();
  if (!customers.includes(oldName)) return res.status(404).json({ error: 'Customer not found' });
  if (oldName !== newName && customers.includes(newName)) {
    return res.status(409).json({ error: 'A customer with this name already exists' });
  }

  const oldPath = getCustomerRecordPath(oldName);
  const newPath = getCustomerRecordPath(newName);
  let record = getCustomerRecord(oldName);
  record.customerName = newName;
  record.updatedAt = new Date().toISOString();

  if (oldName !== newName) {
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    atomicWriteJson(newPath, record);
  } else {
    atomicWriteJson(oldPath, record);
  }

  atomicWriteJson(CUSTOMERS_PATH, customers.map(name => name === oldName ? newName : name).sort());
  res.json({ success: true, customer: newName });
});

app.delete('/api/customers/:name', (req, res) => {
  const customerName = req.params.name.trim().toUpperCase();
  const list = getCustomers().filter(c => c !== customerName);
  atomicWriteJson(CUSTOMERS_PATH, list);

  const recPath = getCustomerRecordPath(customerName);
  if (fs.existsSync(recPath)) {
    try { fs.unlinkSync(recPath); } catch (e) {}
  }
  res.json({ success: true });
});

// Single customer credit record
app.get('/api/records/:customer', (req, res) => {
  const customerName = req.params.customer.trim().toUpperCase();
  res.json(getCustomerRecord(customerName));
});

app.get('/api/credit-search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Enter a search term' });
  if (query.length > 100) return res.status(400).json({ error: 'Search terms must be 100 characters or fewer' });
  const scope = String(req.query.scope || 'credit').toLowerCase();
  if (!['all', 'sales', 'credit'].includes(scope)) {
    return res.status(400).json({ error: 'Choose all, sales, or credit search scope' });
  }
  const dateMode = String(req.query.dateMode || 'all').toLowerCase();
  if (!['all', 'today', 'range'].includes(dateMode)) {
    return res.status(400).json({ error: 'Choose all dates, today, or a date range' });
  }
  let fromDate = '';
  let toDate = '';
  if (dateMode === 'today') {
    fromDate = getTodayNepaliDate().formatted;
    toDate = fromDate;
  } else if (dateMode === 'range') {
    fromDate = String(req.query.fromDate || '').trim();
    toDate = String(req.query.toDate || '').trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(fromDate) || !datePattern.test(toDate)) {
      return res.status(400).json({ error: 'Enter both dates in YYYY-MM-DD format' });
    }
    if (fromDate > toDate) {
      return res.status(400).json({ error: 'From date must be on or before To date' });
    }
  }

  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const normalize = value => String(value || '').toLocaleLowerCase();
  const matchesTerm = (term, text) => {
    if (text.includes(term)) return true;
    if (term.length < 7 || !/^[a-z]+$/i.test(term)) return false;
    return text.split(/[^a-z0-9]+/i).some(word => {
      if (Math.abs(word.length - term.length) > 1) return false;
      let differences = 0;
      let left = 0;
      let right = 0;
      while (left < word.length && right < term.length) {
        if (word[left] === term[right]) {
          left++;
          right++;
        } else {
          differences++;
          if (differences > 1) return false;
          if (word.length === term.length && left + 1 < word.length &&
              word[left] === term[right + 1] && word[left + 1] === term[right]) {
            left += 2;
            right += 2;
          } else if (word.length > term.length) {
            left++;
          } else if (term.length > word.length) {
            right++;
          } else {
            left++;
            right++;
          }
        }
      }
      return differences + (left < word.length || right < term.length ? 1 : 0) <= 1;
    });
  };

  try {
    let results = [];
    if (scope === 'all' || scope === 'credit') {
      const files = fs.readdirSync(RECORDS_DIR).filter(file => file.toLowerCase().endsWith('.json'));
      for (const file of files) {
        const record = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8'));
        const customerName = String(record.customerName || path.basename(file, '.json'));
        for (const entry of Array.isArray(record.entries) ? record.entries : []) {
          const result = {
            type: 'credit',
            customerName,
            date: entry.date || '',
            itemName: entry.itemName || '',
            unit: entry.unit || '',
            quantity: entry.quantity || '',
            rate: '',
            total: '',
            driverName: entry.driverName || '',
            vehicleNumber: entry.vehicleNumber || '',
            remarks: entry.remarks || ''
          };
          const searchable = Object.values(result).map(normalize).join(' ');
          if (terms.every(term => matchesTerm(term, searchable))) results.push(result);
        }
      }
    }

    if (scope === 'all' || scope === 'sales') {
      for (const sale of getDailySales()) {
        const result = {
          type: 'sale',
          customerName: sale.buyerName || 'WALK-IN / CASH',
          date: sale.date || '',
          itemName: sale.itemName || '',
          unit: sale.unit || '',
          quantity: sale.quantity ?? '',
          rate: sale.rate ?? '',
          total: sale.total ?? '',
          driverName: '',
          vehicleNumber: '',
          remarks: sale.remarks || ''
        };
        const searchable = Object.values(result).map(normalize).join(' ');
        if (terms.every(term => matchesTerm(term, searchable))) results.push(result);
      }
    }

    if (dateMode !== 'all') {
      results = results.filter(entry =>
        String(entry.date || '') >= fromDate && String(entry.date || '') <= toDate
      );
    }

    results.sort((a, b) => String(b.date).localeCompare(String(a.date)) ||
      a.type.localeCompare(b.type) || a.customerName.localeCompare(b.customerName));
    res.json({ query, scope, dateMode, fromDate, toDate, count: results.length, results });
  } catch (error) {
    console.error('Sales and credit search failed:', error);
    res.status(500).json({ error: 'Could not search saved sales and credit records. Check the server logs for the record file that needs attention.' });
  }
});

// Add credit items to customer khata (Strictly NO rates, NO totals)
app.post('/api/records/:customer/entries', (req, res) => {
  const customerName = req.params.customer.trim().toUpperCase();
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const record = getCustomerRecord(customerName);
  const now = new Date().toISOString();
  let addedCount = 0;

  for (const it of entries) {
    if (it && it.itemName && it.itemName.trim()) {
      record.entries.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: (it.date || getTodayNepaliDate().formatted).trim(),
        itemName: it.itemName.trim().toUpperCase(),
        unit: (it.unit || '').trim().toUpperCase(),
        quantity: it.quantity ? String(it.quantity).trim() : '',
        driverName: (it.driverName || '').trim(),
        vehicleNumber: (it.vehicleNumber || '').trim(),
        remarks: (it.remarks || '').trim(),
        createdAt: now
      });
      addedCount++;
    }
  }

  if (addedCount === 0) {
    return res.status(400).json({ error: 'Please enter at least one item name' });
  }

  saveCustomerRecord(record);
  addCustomerIfNew(customerName);
  res.json({ success: true, record });
});

// Update single credit item
app.put('/api/records/:customer/entries/:id', (req, res) => {
  try {
    const customerName = req.params.customer.trim().toUpperCase();
    const entryId = req.params.id;
    const updateData = req.body;
    if (!updateData || typeof updateData !== 'object' || Array.isArray(updateData)) {
      return res.status(400).json({ error: 'Credit item details are required' });
    }

    const record = getCustomerRecord(customerName);
    const entry = record.entries.find(e => e.id === entryId);
    if (!entry) return res.status(404).json({ error: 'Credit item not found for this customer' });

    for (const field of ['date', 'itemName', 'unit', 'quantity', 'driverName', 'vehicleNumber', 'remarks']) {
      if (updateData[field] !== undefined && typeof updateData[field] !== 'string') {
        return res.status(400).json({ error: `${field} must be text` });
      }
    }
    if (updateData.itemName !== undefined && !updateData.itemName.trim()) {
      return res.status(400).json({ error: 'Item name cannot be empty' });
    }

    if (updateData.date !== undefined) entry.date = updateData.date.trim();
    if (updateData.itemName !== undefined) entry.itemName = updateData.itemName.trim().toUpperCase();
    if (updateData.unit !== undefined) entry.unit = updateData.unit.trim().toUpperCase();
    if (updateData.quantity !== undefined) entry.quantity = updateData.quantity.trim();
    if (updateData.driverName !== undefined) entry.driverName = updateData.driverName.trim();
    if (updateData.vehicleNumber !== undefined) entry.vehicleNumber = updateData.vehicleNumber.trim();
    if (updateData.remarks !== undefined) entry.remarks = updateData.remarks.trim();
    delete entry.rate;
    delete entry.total;
    entry.updatedAt = new Date().toISOString();

    saveCustomerRecord(record);
    res.json({ success: true, record });
  } catch (err) {
    console.error('Error updating credit item:', err);
    res.status(500).json({ error: 'Could not save this credit item. Check the server data folder and try again.' });
  }
});

// Delete single credit item
app.delete('/api/records/:customer/entries/:id', (req, res) => {
  try {
    const customerName = req.params.customer.trim().toUpperCase();
    const entryId = req.params.id;
    const record = getCustomerRecord(customerName);
    const initialLen = record.entries.length;
    record.entries = record.entries.filter(e => e.id !== entryId);

    if (record.entries.length === initialLen) {
      return res.status(404).json({ error: 'Credit item not found for this customer' });
    }

    saveCustomerRecord(record);
    res.json({ success: true, record });
  } catch (err) {
    console.error('Error deleting credit item:', err);
    res.status(500).json({ error: 'Could not delete this credit item. Check the server data folder and try again.' });
  }
});

// Export Customer Credit PDF (NO rates, NO totals)
app.get('/api/records/:customer/pdf', async (req, res) => {
  try {
    const customerName = req.params.customer.trim().toUpperCase();
    const safeCust = sanitizeName(customerName);
    const exportCustDir = path.join(EXPORTS_DIR, safeCust);
    if (!fs.existsSync(exportCustDir)) fs.mkdirSync(exportCustDir, { recursive: true });

    const todayDate = getTodayNepaliDate().formatted;
    const { fromDate, toDate, sortBy, sortDir } = req.query;
    let fileName = `${safeCust} - Credit Record - ${todayDate}.pdf`;
    if (fromDate && toDate) {
      fileName = `${safeCust} - Credit Record (${fromDate} to ${toDate}).pdf`;
    } else if (fromDate) {
      fileName = `${safeCust} - Credit Record (From ${fromDate}).pdf`;
    }

    const outputPath = path.join(exportCustDir, fileName);
    await generateCreditCustomerPdf(customerName, outputPath, { fromDate, toDate, sortBy, sortDir });

    res.download(outputPath, fileName, (err) => {
      if (err) console.error('Error sending PDF download:', err);
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Export Customer Credit Native Excel (.xlsx) (NO rates, NO totals)
app.get('/api/records/:customer/excel', async (req, res) => {
  try {
    const customerName = req.params.customer.trim().toUpperCase();
    const safeCust = sanitizeName(customerName);
    const exportCustDir = path.join(EXPORTS_DIR, safeCust);
    if (!fs.existsSync(exportCustDir)) fs.mkdirSync(exportCustDir, { recursive: true });

    const todayDate = getTodayNepaliDate().formatted;
    const { fromDate, toDate, sortBy, sortDir } = req.query;
    let fileName = `${safeCust} - Credit Record - ${todayDate}.xlsx`;
    if (fromDate && toDate) {
      fileName = `${safeCust} - Credit Record (${fromDate} to ${toDate}).xlsx`;
    } else if (fromDate) {
      fileName = `${safeCust} - Credit Record (From ${fromDate}).xlsx`;
    }

    const outputPath = path.join(exportCustDir, fileName);
    await generateCreditCustomerExcel(customerName, outputPath, { fromDate, toDate, sortBy, sortDir });

    res.download(outputPath, fileName, (err) => {
      if (err) console.error('Error sending Excel download:', err);
    });
  } catch (err) {
    console.error('Error generating Excel:', err);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// ------------------- API: SEPARATE DAILY SALES & CHART -------------------

// Get all daily sales
app.get('/api/daily-sales', (req, res) => {
  const sales = getDailySales();
  sales.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json(sales);
});

// Record new daily sale (supports single item or batch array of items)
app.post('/api/daily-sales', (req, res) => {
  try {
    const { items, date, buyerName, remarks } = req.body;
    const sales = getDailySales();
    const defaultDate = (date || getTodayNepaliDate().formatted).trim();
    const defaultBuyer = (buyerName || 'Walk-in / Cash').trim();

    if (Array.isArray(items) && items.length > 0) {
      const addedSales = [];
      const now = new Date().toISOString();

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || !it.itemName || !it.itemName.trim()) continue;
        const qtyNum = parseFloat(it.quantity) || 1;
        const rateNum = parseFloat(it.rate) || 0;
        const totalNum = qtyNum * rateNum;

        const newEntry = {
          id: `sale_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          date: (it.date || defaultDate).trim(),
          itemName: it.itemName.trim().toUpperCase(),
          unit: (it.unit || '').trim().toUpperCase(),
          quantity: qtyNum,
          rate: rateNum,
          total: totalNum,
          buyerName: (it.buyerName || defaultBuyer).trim(),
          remarks: (it.remarks || remarks || '').trim(),
          createdAt: now
        };

        sales.push(newEntry);
        addedSales.push(newEntry);
      }

      if (addedSales.length === 0) {
        return res.status(400).json({ error: 'Please enter at least one product with name' });
      }

      saveDailySales(sales);
      return res.json({ success: true, count: addedSales.length, sales: addedSales });
    }

    // Single item fallback
    const { itemName, unit, quantity, rate } = req.body;
    if (!itemName || !itemName.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    const qtyNum = parseFloat(quantity) || 1;
    const rateNum = parseFloat(rate) || 0;
    const totalNum = qtyNum * rateNum;

    const newEntry = {
      id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: defaultDate,
      itemName: itemName.trim().toUpperCase(),
      unit: (unit || '').trim().toUpperCase(),
      quantity: qtyNum,
      rate: rateNum,
      total: totalNum,
      buyerName: defaultBuyer,
      remarks: (remarks || '').trim(),
      createdAt: new Date().toISOString()
    };

    sales.push(newEntry);
    saveDailySales(sales);

    res.json({ success: true, sale: newEntry });
  } catch (err) {
    res.status(500).json({ error: 'Server error saving daily sale' });
  }
});

// Update daily sale
app.put('/api/daily-sales/:id', (req, res) => {
  const saleId = req.params.id;
  const updateData = req.body;
  const sales = getDailySales();
  const sale = sales.find(s => s.id === saleId);

  if (!sale) return res.status(404).json({ error: 'Sale record not found' });

  if (updateData.date) sale.date = updateData.date.trim();
  if (updateData.itemName) sale.itemName = updateData.itemName.trim().toUpperCase();
  if (updateData.unit !== undefined) sale.unit = updateData.unit.trim().toUpperCase();
  if (updateData.quantity !== undefined) sale.quantity = parseFloat(updateData.quantity) || 1;
  if (updateData.rate !== undefined) sale.rate = parseFloat(updateData.rate) || 0;
  sale.total = sale.quantity * sale.rate;
  if (updateData.buyerName !== undefined) sale.buyerName = updateData.buyerName.trim();
  if (updateData.remarks !== undefined) sale.remarks = updateData.remarks.trim();
  sale.updatedAt = new Date().toISOString();

  saveDailySales(sales);
  res.json({ success: true, sale });
});

// Delete daily sale
app.delete('/api/daily-sales/:id', (req, res) => {
  const saleId = req.params.id;
  let sales = getDailySales();
  const initLen = sales.length;
  sales = sales.filter(s => s.id !== saleId);

  if (sales.length === initLen) return res.status(404).json({ error: 'Sale record not found' });

  saveDailySales(sales);
  res.json({ success: true });
});

// Daily Sales Analytics (Which product is selling)
app.get('/api/daily-sales/analytics', (req, res) => {
  const sales = getDailySales();
  const todayDate = getTodayNepaliDate().formatted;
  const productMap = {};
  let totalRevenue = 0;
  let totalUnits = 0;
  let totalOrders = sales.length;
  let todayRevenue = 0;
  let todayUnits = 0;
  let todayOrders = 0;

  for (const s of sales) {
    if (!s.itemName) continue;
    const name = s.itemName.trim().toUpperCase();
    const qty = parseFloat(s.quantity) || 1;
    const rate = parseFloat(s.rate) || 0;
    const recordedTotal = Number(s.total);
    const total = Number.isFinite(recordedTotal) ? recordedTotal : qty * rate;
    const unit = String(s.unit || '').trim().toUpperCase();
    const productKey = `${name}\u0000${unit}`;

    if (!productMap[productKey]) {
      productMap[productKey] = {
        name,
        unit,
        totalQty: 0,
        totalSales: 0,
        orderCount: 0,
        lastDate: s.date || ''
      };
    }

    productMap[productKey].totalQty += qty;
    productMap[productKey].totalSales += total;
    productMap[productKey].orderCount += 1;

    totalRevenue += total;
    totalUnits += qty;

    if (s.date === todayDate) {
      todayRevenue += total;
      todayUnits += qty;
      todayOrders += 1;
    }
  }

  const byQuantity = Object.values(productMap).sort((a, b) => b.totalQty - a.totalQty);
  const bySales = [...byQuantity].sort((a, b) => b.totalSales - a.totalSales);

  res.json({
    summary: {
      totalRevenue,
      totalUnits,
      totalOrders,
      uniqueProductsCount: byQuantity.length,
      todayDate,
      todayRevenue,
      todayUnits,
      todayOrders
    },
    byQuantity,
    bySales
  });
});

// Combined business overview for the full-screen credit and sales report
app.get('/api/business-insights', (req, res) => {
  const sales = getDailySales();
  const todayDate = getTodayNepaliDate().formatted;
  const creditProductMap = {};
  const creditCustomerMap = {};
  let creditItems = 0;
  let creditQuantity = 0;

  if (fs.existsSync(RECORDS_DIR)) {
    for (const file of fs.readdirSync(RECORDS_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const record = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8'));
        if (!Array.isArray(record.entries)) continue;
        const customerName = record.customerName || file.replace(/\.json$/, '');
        let customerItems = 0;
        for (const entry of record.entries) {
          const name = String(entry.itemName || '').trim().toUpperCase();
          if (!name) continue;
          const quantity = parseFloat(entry.quantity) || 0;
          const unit = String(entry.unit || '').trim().toUpperCase();
          const productKey = `${name}\u0000${unit}`;
          creditItems += 1;
          creditQuantity += quantity;
          customerItems += 1;
          if (!creditProductMap[productKey]) creditProductMap[productKey] = { name, unit, quantity: 0, entries: 0 };
          creditProductMap[productKey].quantity += quantity;
          creditProductMap[productKey].entries += 1;
        }
        if (customerItems) {
          creditCustomerMap[customerName] = {
            name: customerName,
            items: customerItems,
            updatedAt: record.updatedAt || record.createdAt || ''
          };
        }
      } catch (err) {
        console.error(`Unable to read credit analytics from ${file}:`, err);
      }
    }
  }

  const creditByQuantity = Object.values(creditProductMap)
    .sort((a, b) => b.quantity - a.quantity || b.entries - a.entries);
  const topCreditCustomers = Object.values(creditCustomerMap)
    .sort((a, b) => b.items - a.items || a.name.localeCompare(b.name)).slice(0, 8);

  let salesRevenue = 0;
  let salesUnits = 0;
  let todayRevenue = 0;
  let todayUnits = 0;
  let todayOrders = 0;
  const salesProductMap = {};
  const salesByDate = {};
  const buyerMap = {};

  for (const sale of sales) {
    const name = String(sale.itemName || '').trim().toUpperCase();
    if (!name) continue;
    const qty = parseFloat(sale.quantity) || 1;
    const total = Number.isFinite(Number(sale.total)) ? Number(sale.total) : qty * (parseFloat(sale.rate) || 0);
    const unit = String(sale.unit || '').trim().toUpperCase();
    const productKey = `${name}\u0000${unit}`;
    const date = sale.date || '';
    const buyer = String(sale.buyerName || 'WALK-IN / CASH').trim().toUpperCase();

    salesRevenue += total;
    salesUnits += qty;
    if (!salesProductMap[productKey]) salesProductMap[productKey] = { name, unit, quantity: 0, revenue: 0, orders: 0 };
    salesProductMap[productKey].quantity += qty;
    salesProductMap[productKey].revenue += total;
    salesProductMap[productKey].orders += 1;
    if (!salesByDate[date]) salesByDate[date] = { date, revenue: 0, units: 0, orders: 0 };
    salesByDate[date].revenue += total;
    salesByDate[date].units += qty;
    salesByDate[date].orders += 1;
    buyerMap[buyer] = (buyerMap[buyer] || 0) + total;

    if (date === todayDate) {
      todayRevenue += total;
      todayUnits += qty;
      todayOrders += 1;
    }
  }

  const salesByQuantity = Object.values(salesProductMap).sort((a, b) => b.quantity - a.quantity);
  const salesByRevenue = [...salesByQuantity].sort((a, b) => b.revenue - a.revenue);
  const salesTrend = Object.values(salesByDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14).reverse();
  const topBuyers = Object.entries(buyerMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  res.json({
    sales: {
      summary: {
        revenue: salesRevenue,
        units: salesUnits,
        orders: sales.length,
        uniqueProducts: salesByQuantity.length,
        todayRevenue,
        todayUnits,
        todayOrders,
        todayDate
      },
      byQuantity: salesByQuantity,
      byRevenue: salesByRevenue,
      records: sales.map(sale => {
        const quantity = parseFloat(sale.quantity) || 1;
        const rate = parseFloat(sale.rate) || 0;
        const recordedTotal = Number(sale.total);
        return {
          date: String(sale.date || ''),
          buyerName: String(sale.buyerName || 'WALK-IN / CASH'),
          itemName: String(sale.itemName || ''),
          unit: String(sale.unit || ''),
          quantity,
          rate,
          total: Number.isFinite(recordedTotal) ? recordedTotal : quantity * rate
        };
      }),
      trend: salesTrend,
      topBuyers
    },
    credit: {
      summary: {
        customers: Object.keys(creditCustomerMap).length,
        items: creditItems,
        quantity: creditQuantity,
        uniqueProducts: creditByQuantity.length
      },
      byQuantity: creditByQuantity,
      topCustomers: topCreditCustomers
    }
  });
});

// Export Daily Sales PDF Report
app.get('/api/daily-sales/pdf', async (req, res) => {
  try {
    const exportSalesDir = path.join(EXPORTS_DIR, 'Daily Sales');
    if (!fs.existsSync(exportSalesDir)) fs.mkdirSync(exportSalesDir, { recursive: true });

    const todayDate = getTodayNepaliDate().formatted;
    const { fromDate, toDate, grouped } = req.query;
    let fileName = `Daily Sales Report - ${todayDate}.pdf`;
    if (fromDate && toDate) fileName = `Daily Sales Report (${fromDate} to ${toDate}).pdf`;
    else if (fromDate) fileName = `Daily Sales Report (From ${fromDate}).pdf`;
    const outputPath = path.join(exportSalesDir, fileName);

    await generateDailySalesPdf(outputPath, { fromDate, toDate, grouped });

    res.download(outputPath, fileName, (err) => {
      if (err) console.error('Error sending Daily Sales PDF download:', err);
    });
  } catch (err) {
    console.error('Error generating Daily Sales PDF:', err);
    res.status(500).json({ error: 'Failed to generate Daily Sales PDF' });
  }
});

// Export Daily Sales Native Excel (.xlsx) Workbook (in perfect order)
app.get('/api/daily-sales/excel', async (req, res) => {
  try {
    const exportSalesDir = path.join(EXPORTS_DIR, 'Daily Sales');
    if (!fs.existsSync(exportSalesDir)) fs.mkdirSync(exportSalesDir, { recursive: true });

    const todayDate = getTodayNepaliDate().formatted;
    const { fromDate, toDate, grouped } = req.query;
    let fileName = `Daily Sales Records - ${todayDate}.xlsx`;
    if (fromDate && toDate) fileName = `Daily Sales Records (${fromDate} to ${toDate}).xlsx`;
    else if (fromDate) fileName = `Daily Sales Records (From ${fromDate}).xlsx`;
    const outputPath = path.join(exportSalesDir, fileName);

    await generateDailySalesExcel(outputPath, { fromDate, toDate, grouped });

    res.download(outputPath, fileName, (err) => {
      if (err) console.error('Error sending Daily Sales Excel download:', err);
    });
  } catch (err) {
    console.error('Error generating Daily Sales Excel:', err);
    res.status(500).json({ error: 'Failed to generate Daily Sales Excel file' });
  }
});

// ---------------- PDF GENERATION FOR DAILY SALES ----------------
function generateDailySalesPdf(outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const config = getConfig();
      const shopName = (config.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
      const grouped = options.grouped === true || options.grouped === 'true';
      let sales = getDailySales();
      if (options.fromDate) {
        sales = sales.filter(s => String(s.date || '') >= options.fromDate);
      }
      if (options.toDate) {
        sales = sales.filter(s => String(s.date || '') <= options.toDate);
      }
      sales.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
        info: { Title: `Daily Sales Report - ${getTodayNepaliDate().formatted}`, Author: shopName }
      });

      doc.registerFont('NotoRegular', FONT_REGULAR);
      doc.registerFont('NotoBold', FONT_BOLD);

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const margin = 30;
      const contentWidth = doc.page.width - margin * 2;
      const columns = [
        { label: 'S.N.', width: 34, align: 'center' },
        { label: 'DATE (BS)', width: 75, align: 'center' },
        { label: 'BUYER / CUSTOMER', width: 125, align: 'left' },
        { label: 'PRODUCT NAME', width: 190, align: 'left', bold: true },
        { label: 'UNIT', width: 48, align: 'center' },
        { label: 'QUANTITY', width: 58, align: 'right' },
        { label: 'RATE (RS)', width: 78, align: 'right' },
        { label: 'TOTAL (RS)', width: 88, align: 'right', bold: true },
        { label: 'REMARKS', width: contentWidth - 696, align: 'left' }
      ];
      const totalRevenue = sales.reduce((sum, sale) =>
        sum + (parseFloat(sale.total) || ((parseFloat(sale.quantity) || 0) * (parseFloat(sale.rate) || 0))), 0);
      let pageNumber = 0;
      const tableHeaderHeight = 25;

      function drawPageHeader() {
        pageNumber++;
        doc.font('NotoBold').fontSize(17).fillColor('#111827')
          .text(shopName, margin, margin, { width: contentWidth, align: 'center' });
        doc.font('NotoBold').fontSize(12).fillColor('#166534')
          .text(`DAILY SALES REPORT${grouped ? ' - GROUPED BY DATE' : ' - ALL SALES'}`,
            margin, margin + 24, { width: contentWidth, align: 'center' });

        const metaTop = margin + 46;
        doc.roundedRect(margin, metaTop, contentWidth, 31, 4)
          .fillAndStroke('#f0fdf4', '#bbf7d0');
        const range = options.fromDate || options.toDate
          ? `Range: ${options.fromDate || 'Start'} to ${options.toDate || 'Present'}`
          : 'Range: All dates';
        doc.font('NotoRegular').fontSize(8.5).fillColor('#1f2937')
          .text(`Report date (BS): ${getTodayNepaliDate().formatted}  |  ${range}  |  ${sales.length} sales`,
            margin + 8, metaTop + 10, { width: contentWidth * 0.66 });
        doc.font('NotoBold').fontSize(9)
          .text(`Grand total: Rs. ${totalRevenue.toLocaleString('en-IN')}`,
            margin + contentWidth * 0.66, metaTop + 10, {
              width: contentWidth * 0.34 - 16, align: 'right'
            });
        doc.font('NotoRegular').fontSize(8).fillColor('#475569')
          .text(`Page ${pageNumber}`, margin + contentWidth - 50, metaTop + 20, { width: 42, align: 'right' });

        const headerTop = metaTop + 39;
        let x = margin;
        columns.forEach(column => {
          doc.rect(x, headerTop, column.width, tableHeaderHeight)
            .fillAndStroke('#14532d', '#ffffff');
          doc.font('NotoBold').fontSize(7.8).fillColor('#ffffff')
            .text(column.label, x + 4, headerTop + 7, {
              width: column.width - 8, align: column.align, lineBreak: false
            });
          x += column.width;
        });
        return headerTop + tableHeaderHeight;
      }

      function getSaleRow(sale, index) {
        const quantity = parseFloat(sale.quantity) || 0;
        const rate = parseFloat(sale.rate) || 0;
        const total = parseFloat(sale.total) || quantity * rate;
        return [
          String(index + 1),
          sale.date || '-',
          sale.buyerName || 'Walk-in / Cash',
          sale.itemName || '-',
          sale.unit || '-',
          quantity ? quantity.toLocaleString('en-IN') : '-',
          rate ? rate.toLocaleString('en-IN') : '-',
          total ? total.toLocaleString('en-IN') : '-',
          sale.remarks || '-'
        ];
      }

      function measureRow(values) {
        const heights = values.map((value, index) => {
          const column = columns[index];
          doc.font(column.bold ? 'NotoBold' : 'NotoRegular').fontSize(8.5);
          return doc.heightOfString(String(value || '-'), {
            width: column.width - 8, lineGap: 1
          });
        });
        return { heights, rowHeight: Math.max(24, ...heights.map(height => height + 8)) };
      }

      function drawRow(values, y, rowIndex, measured) {
        let x = margin;
        values.forEach((value, index) => {
          const column = columns[index];
          doc.rect(x, y, column.width, measured.rowHeight)
            .fillAndStroke(rowIndex % 2 ? '#f8fafc' : '#ffffff', '#cbd5e1');
          doc.font(column.bold ? 'NotoBold' : 'NotoRegular').fontSize(8.5).fillColor('#111827')
            .text(String(value || '-'), x + 4,
              y + Math.max(4, (measured.rowHeight - measured.heights[index]) / 2), {
                width: column.width - 8, align: column.align, lineGap: 1
              });
          x += column.width;
        });
      }

      function drawDateBanner(date, y, continued = false) {
        const height = 20;
        doc.roundedRect(margin, y, contentWidth, height, 3)
          .fillAndStroke('#dcfce7', '#86efac');
        doc.font('NotoBold').fontSize(9).fillColor('#14532d')
          .text(`${date}${continued ? ' (continued)' : ''}`, margin + 8, y + 5, {
            width: contentWidth - 16
          });
        return height;
      }

      function drawSubtotal(label, amount, y, grand = false) {
        const height = 24;
        doc.rect(margin, y, contentWidth, height)
          .fillAndStroke(grand ? '#dcfce7' : '#f0fdf4', grand ? '#15803d' : '#86efac');
        const totalX = margin + columns.slice(0, 7).reduce((sum, column) => sum + column.width, 0);
        doc.font('NotoBold').fontSize(grand ? 9 : 8.5).fillColor('#14532d')
          .text(label, margin + 8, y + 6, { width: totalX - margin - 16, align: 'right' });
        doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, totalX + 4, y + 6, {
          width: columns[7].width - 8, align: 'right'
        });
        return height;
      }

      function startNewPage() {
        doc.addPage();
        return drawPageHeader();
      }

      let currentY = drawPageHeader();
      if (sales.length === 0) {
        doc.font('NotoRegular').fontSize(10).fillColor('#475569')
          .text('No daily sales recorded in the selected date range.', margin + 8, currentY + 12);
      } else if (!grouped) {
        sales.forEach((sale, index) => {
          const values = getSaleRow(sale, index);
          const measured = measureRow(values);
          if (currentY + measured.rowHeight > doc.page.height - margin) {
            currentY = startNewPage();
          }
          drawRow(values, currentY, index, measured);
          currentY += measured.rowHeight;
        });
        if (currentY + 26 > doc.page.height - margin) currentY = startNewPage();
        currentY += drawSubtotal('GRAND TOTAL SALES REVENUE:', totalRevenue, currentY, true);
      } else {
        const groups = new Map();
        sales.forEach((sale, index) => {
          const date = sale.date || 'Unknown Date';
          if (!groups.has(date)) groups.set(date, []);
          groups.get(date).push({ sale, index });
        });

        for (const [date, items] of groups) {
          let dayTotal = items.reduce((sum, { sale }) =>
            sum + (parseFloat(sale.total) || ((parseFloat(sale.quantity) || 0) * (parseFloat(sale.rate) || 0))), 0);
          const firstMeasured = measureRow(getSaleRow(items[0].sale, items[0].index));
          if (currentY + 20 + firstMeasured.rowHeight > doc.page.height - margin) {
            currentY = startNewPage();
          }
          currentY += drawDateBanner(date, currentY);

          for (const { sale, index } of items) {
            const values = getSaleRow(sale, index);
            const measured = measureRow(values);
            if (currentY + measured.rowHeight > doc.page.height - margin) {
              currentY = startNewPage();
              currentY += drawDateBanner(date, currentY, true);
            }
            drawRow(values, currentY, index, measured);
            currentY += measured.rowHeight;
          }

          if (currentY + 24 > doc.page.height - margin) {
            currentY = startNewPage();
            currentY += drawDateBanner(date, currentY, true);
          }
          currentY += drawSubtotal(`SUBTOTAL - ${date}:`, dayTotal, currentY);
        }
        if (currentY + 26 > doc.page.height - margin) currentY = startNewPage();
        currentY += drawSubtotal('GRAND TOTAL SALES REVENUE:', totalRevenue, currentY, true);
      }

      doc.end();
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------- EXCEL (.XLSX) GENERATION FOR DAILY SALES (PERFECT ORDER) ----------------
async function generateDailySalesExcel(outputPath, options = {}) {
  const config = getConfig();
  const shopName = (config.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
  let sales = getDailySales();
  if (options.fromDate) {
    sales = sales.filter(s => String(s.date || '') >= options.fromDate);
  }
  if (options.toDate) {
    sales = sales.filter(s => String(s.date || '') <= options.toDate);
  }
  sales.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = shopName;
  workbook.created = new Date();

  // Sheet 1: Daily Sales Ledger
  const sheet = workbook.addWorksheet('Daily Sales Ledger', {
    views: [{ showGridLines: true }]
  });

  // Title Banner
  sheet.mergeCells('A2:I2');
  const titleCell = sheet.getCell('A2');
  titleCell.value = `${shopName} - DAILY SALES REPORT`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  sheet.getRow(2).height = 34;

  // Meta row
  const todayDate = getTodayNepaliDate().formatted;
  const totalRev = sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
  const totalUnits = sales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);

  sheet.mergeCells('A3:E3');
  const metaLeft = sheet.getCell('A3');
  let rangeInfo = '';
  if (options.fromDate || options.toDate) {
    rangeInfo = `   |   Range: ${options.fromDate || 'Start'} to ${options.toDate || 'Present'}`;
  }
  metaLeft.value = `Report Date (BS): ${todayDate}   |   Total Orders: ${sales.length}   |   Units Sold: ${totalUnits}${rangeInfo}`;
  metaLeft.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };
  metaLeft.alignment = { vertical: 'middle', horizontal: 'left' };
  metaLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  sheet.mergeCells('F3:I3');
  const metaRight = sheet.getCell('F3');
  metaRight.value = `Grand Total Sales: Rs. ${totalRev.toLocaleString('en-IN')}`;
  metaRight.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF14532D' } };
  metaRight.alignment = { vertical: 'middle', horizontal: 'right' };
  metaRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
  sheet.getRow(3).height = 24;

  // Header row at row 5
  const headers = [
    { header: 'S.N.', key: 'sn', width: 8, align: 'center' },
    { header: 'Date (BS)', key: 'date', width: 14, align: 'center' },
    { header: 'Buyer / Customer', key: 'buyer', width: 24, align: 'left' },
    { header: 'Product Name', key: 'product', width: 34, align: 'left' },
    { header: 'Unit', key: 'unit', width: 10, align: 'center' },
    { header: 'Quantity', key: 'qty', width: 12, align: 'right' },
    { header: 'Rate (Rs)', key: 'rate', width: 16, align: 'right' },
    { header: 'Total (Rs)', key: 'total', width: 18, align: 'right' },
    { header: 'Remarks', key: 'remarks', width: 26, align: 'left' }
  ];

  const headerRow = sheet.getRow(5);
  headerRow.height = 26;
  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    sheet.getColumn(colNumber).width = h.width;
    const cell = headerRow.getCell(colNumber);
    cell.value = h.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: h.align };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  let currentRowIdx = 6;
  sales.forEach((s, idx) => {
    const row = sheet.getRow(currentRowIdx);
    row.height = 22;
    const isEven = idx % 2 === 1;
    const bgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    const qty = parseFloat(s.quantity) || 0;
    const rate = parseFloat(s.rate) || 0;
    const total = parseFloat(s.total) || (qty * rate);

    const values = [
      idx + 1,
      s.date || '-',
      s.buyerName || 'Walk-in / Cash',
      s.itemName || '-',
      s.unit || '-',
      qty,
      rate,
      total,
      s.remarks || '-'
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = {
        name: 'Calibri',
        size: 10.5,
        bold: colIdx === 3 || colIdx === 7,
        color: { argb: colIdx === 7 ? 'FF15803D' : 'FF0F172A' }
      };
      cell.alignment = { vertical: 'middle', horizontal: headers[colIdx].align };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colIdx === 5) cell.numFmt = '#,##0.##';
      if (colIdx === 6 || colIdx === 7) cell.numFmt = '#,##0.00';
    });

    currentRowIdx++;
  });

  // Summary Row at the bottom
  const summaryRow = sheet.getRow(currentRowIdx);
  summaryRow.height = 26;
  sheet.mergeCells(`A${currentRowIdx}:G${currentRowIdx}`);
  const sumLabel = summaryRow.getCell(1);
  sumLabel.value = 'GRAND TOTAL SALES REVENUE (Rs):';
  sumLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  sumLabel.alignment = { vertical: 'middle', horizontal: 'right' };
  sumLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sumLabel.border = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } }
  };

  const sumTotalCell = summaryRow.getCell(8);
  sumTotalCell.value = totalRev;
  sumTotalCell.numFmt = '#,##0.00';
  sumTotalCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF14532D' } };
  sumTotalCell.alignment = { vertical: 'middle', horizontal: 'right' };
  sumTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
  sumTotalCell.border = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } }
  };

  const emptyRemarks = summaryRow.getCell(9);
  emptyRemarks.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  emptyRemarks.border = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } }
  };

  // Sheet 2: Grouped by Date
  const dateGroups = {};
  sales.forEach(s => {
    const d = s.date || 'Unknown Date';
    if (!dateGroups[d]) dateGroups[d] = [];
    dateGroups[d].push(s);
  });

  const groupedSheet = workbook.addWorksheet('Sales Grouped By Date', {
    views: [{ showGridLines: true }]
  });

  groupedSheet.mergeCells('A2:H2');
  const gTitle = groupedSheet.getCell('A2');
  gTitle.value = `${shopName} - DAILY SALES (GROUPED BY DATE)`;
  gTitle.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  gTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  gTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  groupedSheet.getRow(2).height = 32;

  let gRowIdx = 4;
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
  
  sortedDates.forEach(d => {
    const groupSales = dateGroups[d];
    const groupTotal = groupSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const groupQty = groupSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);

    groupedSheet.mergeCells(`A${gRowIdx}:H${gRowIdx}`);
    const dBanner = groupedSheet.getCell(`A${gRowIdx}`);
    dBanner.value = `📅 Date: ${d}   |   ${groupSales.length} Transactions   |   Units: ${groupQty}   |   Date Total: Rs. ${groupTotal.toLocaleString('en-IN')}`;
    dBanner.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    dBanner.alignment = { vertical: 'middle', horizontal: 'left' };
    dBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    groupedSheet.getRow(gRowIdx).height = 24;
    gRowIdx++;

    const gHeaders = ['S.N.', 'Buyer / Customer', 'Product Name', 'Unit', 'Qty', 'Rate (Rs)', 'Total (Rs)', 'Remarks'];
    const gHRow = groupedSheet.getRow(gRowIdx);
    gHRow.height = 22;
    gHeaders.forEach((gh, colI) => {
      const c = gHRow.getCell(colI + 1);
      c.value = gh;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: colI === 0 || colI === 3 ? 'center' : (colI >= 4 && colI <= 6 ? 'right' : 'left') };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    });
    gRowIdx++;

    groupSales.forEach((gs, sIdx) => {
      const gItemRow = groupedSheet.getRow(gRowIdx);
      gItemRow.height = 20;
      const gqty = parseFloat(gs.quantity) || 0;
      const grate = parseFloat(gs.rate) || 0;
      const gtot = parseFloat(gs.total) || (gqty * grate);
      const rowVals = [sIdx + 1, gs.buyerName || 'Walk-in', gs.itemName || '-', gs.unit || '-', gqty, grate, gtot, gs.remarks || '-'];
      rowVals.forEach((rv, colI) => {
        const c = gItemRow.getCell(colI + 1);
        c.value = rv;
        c.font = { name: 'Calibri', size: 10, bold: colI === 2 || colI === 6 };
        c.alignment = { vertical: 'middle', horizontal: colI === 0 || colI === 3 ? 'center' : (colI >= 4 && colI <= 6 ? 'right' : 'left') };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (colI === 4) c.numFmt = '#,##0.##';
        if (colI === 5 || colI === 6) c.numFmt = '#,##0.00';
      });
      gRowIdx++;
    });

    groupedSheet.mergeCells(`A${gRowIdx}:F${gRowIdx}`);
    const subLabel = groupedSheet.getCell(`A${gRowIdx}`);
    subLabel.value = `SUBTOTAL FOR ${d}:`;
    subLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF14532D' } };
    subLabel.alignment = { vertical: 'middle', horizontal: 'right' };
    subLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

    const subVal = groupedSheet.getCell(`G${gRowIdx}`);
    subVal.value = groupTotal;
    subVal.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF14532D' } };
    subVal.alignment = { vertical: 'middle', horizontal: 'right' };
    subVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    subVal.numFmt = '#,##0.00';

    groupedSheet.getCell(`H${gRowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    groupedSheet.getRow(gRowIdx).height = 22;
    gRowIdx += 2;
  });

  groupedSheet.getColumn(1).width = 8;
  groupedSheet.getColumn(2).width = 24;
  groupedSheet.getColumn(3).width = 34;
  groupedSheet.getColumn(4).width = 10;
  groupedSheet.getColumn(5).width = 12;
  groupedSheet.getColumn(6).width = 16;
  groupedSheet.getColumn(7).width = 18;
  groupedSheet.getColumn(8).width = 26;

  // Sheet 3: Product Sales Ranking ("Which Product is selling")
  const rankSheet = workbook.addWorksheet('Product Sales Ranking', {
    views: [{ showGridLines: true }]
  });

  rankSheet.mergeCells('A2:F2');
  const rankTitle = rankSheet.getCell('A2');
  rankTitle.value = `${shopName} - PRODUCT SALES RANKING`;
  rankTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  rankTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  rankTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  rankSheet.getRow(2).height = 30;

  const rankHeaders = [
    { header: 'Rank', width: 10, align: 'center' },
    { header: 'Product Name', width: 34, align: 'left' },
    { header: 'Unit', width: 12, align: 'center' },
    { header: 'Total Quantity Sold', width: 20, align: 'right' },
    { header: 'Total Revenue (Rs)', width: 22, align: 'right' },
    { header: 'Orders Count', width: 14, align: 'center' }
  ];

  const rankHeaderRow = rankSheet.getRow(4);
  rankHeaderRow.height = 24;
  rankHeaders.forEach((h, idx) => {
    rankSheet.getColumn(idx + 1).width = h.width;
    const c = rankHeaderRow.getCell(idx + 1);
    c.value = h.header;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: h.align };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const productMap = {};
  for (const s of sales) {
    if (!s.itemName) continue;
    const name = s.itemName.trim().toUpperCase();
    const qty = parseFloat(s.quantity) || 1;
    const rate = parseFloat(s.rate) || 0;
    const total = parseFloat(s.total) || (qty * rate);
    const unit = String(s.unit || '').trim().toUpperCase();
    const productKey = `${name}\u0000${unit}`;
    if (!productMap[productKey]) {
      productMap[productKey] = { name, unit, totalQty: 0, totalSales: 0, orderCount: 0 };
    }
    productMap[productKey].totalQty += qty;
    productMap[productKey].totalSales += total;
    productMap[productKey].orderCount += 1;
  }
  const ranked = Object.values(productMap).sort((a, b) => b.totalQty - a.totalQty);

  ranked.forEach((p, idx) => {
    const row = rankSheet.getRow(5 + idx);
    row.height = 20;
    const isEven = idx % 2 === 1;
    const bg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
    const rowValues = [
      `#${idx + 1}`,
      p.name,
      p.unit,
      p.totalQty,
      p.totalSales,
      p.orderCount
    ];

    rowValues.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10.5, bold: cIdx === 0 || cIdx === 1 };
      cell.alignment = { vertical: 'middle', horizontal: rankHeaders[cIdx].align };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (cIdx === 3) cell.numFmt = '#,##0.##';
      if (cIdx === 4) cell.numFmt = '#,##0.00';
    });
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

// ------------------- SHARED APIs -------------------

app.get('/api/item-suggestions', (req, res) => res.json(getItemSuggestions()));
app.get('/api/item-units', (req, res) => res.json(getItemUnitSuggestions()));
app.get('/api/price-items', (req, res) => res.json(getPriceItems()));
app.post('/api/price-items', (req, res) => {
  try {
    const name = String(req.body && req.body.name || '').trim();
    const topic = String(req.body && req.body.topic || 'GENERAL').trim().toUpperCase() || 'GENERAL';
    const price = String(req.body && req.body.price || '0').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const items = getPriceItems();
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      topic,
      name: name.toUpperCase(),
      price
    };
    items.push(newItem);
    atomicWriteJson(PRICE_ITEMS_PATH, items);
    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error('Unable to add price list item:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});
app.put('/api/price-items/:id', (req, res) => {
  try {
    const items = getPriceItems();
    const index = items.findIndex(item => String(item.id) === String(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Product not found' });

    const name = String(req.body && req.body.name || '').trim();
    const topic = String(req.body && req.body.topic || items[index].topic || 'GENERAL').trim().toUpperCase();
    const price = String(req.body && req.body.price || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!topic) return res.status(400).json({ error: 'Category is required' });
    if (!price) return res.status(400).json({ error: 'Price is required' });

    items[index] = { ...items[index], topic, name: name.toUpperCase(), price };
    atomicWriteJson(PRICE_ITEMS_PATH, items);
    res.json({ item: items[index] });
  } catch (err) {
    console.error('Unable to update price list item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});
app.delete('/api/price-items/:id', (req, res) => {
  try {
    const items = getPriceItems();
    const index = items.findIndex(item => String(item.id) === String(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Product not found' });

    const [item] = items.splice(index, 1);
    atomicWriteJson(PRICE_ITEMS_PATH, items);
    res.json({ success: true, item });
  } catch (err) {
    console.error('Unable to delete price list item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
app.get('/api/today-nepali-date', (req, res) => res.json(getTodayNepaliDate()));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDirs();

const config = getConfig();
const PORT = process.env.PORT || config.port || 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  const shopName = String(config.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
  console.log(`========================================================`);
  console.log(`   ${shopName} - CREDIT KHATA & SEPARATE DAILY SALES`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Listening on ${HOST} for local network/phone access`);
  console.log(`========================================================`);
});
