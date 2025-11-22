const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const PORT = 3000;

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
    for (const [key, fname] of Object.entries(files)) {
        const filePath = path.join(__dirname, fname);
        try {
            result[key] = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            result[key] = '';
        }
    }
    return result;
}

app.get('/data', (req, res) => {
    res.json(loadCsvFiles());
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});
