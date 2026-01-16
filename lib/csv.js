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

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits;
}

module.exports = {
  parseCsv,
  normalizePhone,
};
