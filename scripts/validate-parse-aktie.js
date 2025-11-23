const fs = require('fs');
const path = require('path');

function parseNumberForCsv(s) {
  if (s === undefined || s === null) return NaN;
  let t = String(s).trim().replace(/\s+/g, '').replace(/"/g, '');
  const hasComma = t.indexOf(',') !== -1;
  const hasDot = t.indexOf('.') !== -1;
  if (hasComma && hasDot) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (hasDot && !hasComma && /\.(?=\d{3})/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (hasComma && !hasDot) {
    t = t.replace(',', '.');
  }
  t = t.replace(/[^0-9.-]/g, '');
  return parseFloat(t);
}

function normalizeHeaderName(s) {
  try {
    const n = String(s || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '');
    return n.replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'aa').toLowerCase().replace(/\s+/g, ' ').trim();
  } catch (e) {
    const n = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return n.replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'aa').toLowerCase().replace(/\s+/g, ' ').trim();
  }
}

function parseAktieCsvContent(rawData) {
  if (!rawData) return 0;
  rawData = String(rawData).replace(/^\uFEFF/, '');
  const rows = rawData.trim().split(/\r?\n/);
  if (rows.length < 2) return 0;
  const headerRaw = rows[0].replace(/^\uFEFF/, '');
  const headerParts = headerRaw.split(';').map(h => h.trim());
  const header = headerParts.map(h => h.toLowerCase());
  const headerNormalized = headerParts.map(h => normalizeHeaderName(h));
  let valueIdx = headerNormalized.findIndex(h => h === 'vaerdi dkk' || h === 'vaerdidkk');
  if (valueIdx === -1) valueIdx = headerNormalized.findIndex(h => h === 'vaerdi');
  if (valueIdx === -1) valueIdx = headerNormalized.findIndex(h => h.includes('vaerdi') && !h.includes('belanings'));
  console.log('headerParts:', headerParts);
  console.log('headerNormalized:', headerNormalized);
  console.log('valueIdx:', valueIdx, 'selected header:', header[valueIdx], 'orig header:', headerParts[valueIdx]);
  if (valueIdx === -1) return 0;
  return rows.slice(1).reduce((sum, line) => {
    const parts = line.split(';');
    const rawVal = parts[valueIdx] || '';
    const val = parseNumberForCsv(rawVal);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

function parseAktieClosingValueAtDate(rawData, targetDateStr) {
  if (!rawData) return 0;
  rawData = String(rawData).replace(/^\uFEFF/, '');
  const rows = rawData.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rows.length < 2) return 0;
  const headerParts = rows[0].split(';').map(h => h.trim());
  const headerNormalized = headerParts.map(h => normalizeHeaderName(h));
  const valueIdx = headerNormalized.findIndex(h => h === 'vaerdi dkk' || h === 'vaerdidkk') >= 0 ? headerNormalized.findIndex(h => h === 'vaerdi dkk' || h === 'vaerdidkk') : headerNormalized.findIndex(h => h === 'vaerdi');
  if (valueIdx === -1) return 0;
  const targetDate = new Date(targetDateStr + 'T23:59:59');
  let sum = 0;
  for (let i = 1; i < rows.length; i++) {
    const parts = rows[i].split(';').map(p => p.trim());
    const dStr = parts[0] || '';
    const dp = dStr.split('-');
    if (dp.length === 3) {
      const d = new Date(dp[2] + '-' + dp[1] + '-' + dp[0] + 'T23:59:59');
      if (d <= targetDate) {
        const val = parseNumberForCsv(parts[valueIdx]);
        if (!isNaN(val)) sum += val;
      }
    }
  }
  return sum;
}

const fname1 = path.join(__dirname, '..', 'aktiesdepot.csv');
const fname2 = path.join(__dirname, '..', 'aktiesparekonto.csv');
const f1 = fs.readFileSync(fname1, 'utf8');
const f2 = fs.readFileSync(fname2, 'utf8');
console.log('Aktiedepot sum (DKK preferred):', parseAktieCsvContent(f1));
console.log('Aktiesparekonto sum (DKK preferred):', parseAktieCsvContent(f2));
console.log('Aktiesparekonto closing 2025-12-31 (DKK):', parseAktieClosingValueAtDate(f2, '2025-12-31'));
