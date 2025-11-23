const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const files = {
    lonkonto: 'lønkonto-eksport.csv',
    budget: 'Budget-eksport.csv',
    boliglaan: 'boliglån-eksport.csv',
    amortization: 'realkredit-eksport.csv',
    aktiedepot: 'aktiesdepot.csv',
    aktiesparekonto: 'aktiesparekonto.csv'
};

function loadCsvFiles() {
    const result = {};
    const errors = [];
    for (const [key, fname] of Object.entries(files)) {
        const filePath = path.join(__dirname, fname);
        try {
            result[key] = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            result[key] = '';
            errors.push({ file: fname, error: e.message });
        }
    }
    if (errors.length) result._errors = errors;
    return result;
}

app.use(cors());

// Request logging for diagnostics
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.url}`);
    next();
});

app.get('/data', (req, res) => {
    const payload = loadCsvFiles();
    if (payload._errors && payload._errors.length) {
        console.warn('Some CSV files failed to load', payload._errors);
        // Return the contents with 206 Partial Content so client sees data + errors
        res.status(206).json(payload);
        return;
    }
    res.json(payload);
});

// Status endpoint for debugging file availability
app.get('/status', (req, res) => {
    const info = { files: {}, errors: [], previews: {} };
    for (const [key, fname] of Object.entries(files)) {
        const filePath = path.join(__dirname, fname);
        try {
            const stat = fs.statSync(filePath);
            info.files[key] = { name: fname, exists: true, size: stat.size, mtime: stat.mtime };
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const firstLine = content.split(/\r?\n/).find(Boolean) || '';
                info.previews[key] = { header: firstLine.slice(0, 200) };
            } catch (e) { info.previews[key] = { header: null }; }
        } catch (e) {
            info.files[key] = { name: fname, exists: false, size: 0 };
            info.errors.push({ file: fname, error: e.message });
        }
    }
    res.json(info);
});

// Provide a parsed preview for the first N rows per CSV for easier debugging.
function parsePreviewCsv(content, limit = 5) {
    if (!content) return { parsed: [], header: '' };
    // Remove BOM
    const cleaned = content.replace(/^\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { parsed: [], header: '' };
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : (headerLine.includes('\t') ? '\t' : (headerLine.includes(',') ? ',' : ';'));
    const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    const parsed = lines.slice(1, 1 + limit).map(line => {
        const parts = line.split(separator).map(p => p.trim().replace(/^\uFEFF/, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = parts[i] || ''; });
        return obj;
    });
    return { parsed, header: headerLine };
}

app.get('/data-preview', (req, res) => {
    const limit = Math.max(1, Number(req.query.limit) || 5);
    const payload = {};
    for (const [key, fname] of Object.entries(files)) {
        const filePath = path.join(__dirname, fname);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            payload[key] = parsePreviewCsv(content, limit);
        } catch (e) {
            payload[key] = { parsed: [], header: '', error: e.message };
        }
    }
    res.json(payload);
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Analyse.html'));
});

app.listen(PORT, HOST, () => {
    // Print accessible URLs for convenience
    console.log(`Dashboard listening on host ${HOST}, port ${PORT}`);
    console.log(`Open the dashboard at http://localhost:${PORT}/Analyse.html`);
    const ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(name => {
        for (const intf of ifaces[name]) {
            if (intf.family === 'IPv4' && !intf.internal) {
                console.log(`Accessible on your LAN via http://${intf.address}:${PORT}/Analyse.html`);
            }
        }
    });
});
