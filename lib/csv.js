function parseCsv(text) {
  const rows = [];
  const lines = (text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return rows;
  }
  const headers = lines[0].split(',').map((cell) => cell.trim());
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(',').map((cell) => cell.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

async function parseExcel(buffer) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const rows = [];
  const worksheet = workbook.worksheets[0]; // Use first worksheet
  
  if (!worksheet || worksheet.rowCount === 0) {
    return rows;
  }
  
  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });
  
  // Process data rows (starting from row 2)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const dataRow = worksheet.getRow(rowNumber);
    const row = {};
    dataRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        row[header] = String(cell.value || '').trim();
      }
    });
    // Only add non-empty rows
    if (Object.keys(row).length > 0 && Object.values(row).some(val => val !== '')) {
      rows.push(row);
    }
  }
  
  return rows;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length < 10 || digits.length > 15) {
    return '';
  }
  return digits;
}

module.exports = {
  parseCsv,
  parseExcel,
  normalizePhone,
};
