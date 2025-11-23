// Simple test harness for simulateSeries behavior including contribution cap
function simulateSeries(start, monthly, years, rPct, feePct, taxPct, taxModel, contribCap = null) {
    const MONTHS_PER_YEAR = 12;
    const months = Math.max(1, Math.round(years * MONTHS_PER_YEAR));
    const monthlyRate = (rPct / 100) / MONTHS_PER_YEAR;
    const monthlyFeeRate = (feePct / 100) / MONTHS_PER_YEAR;
    const series = [];
    let value = Number(start) || 0;
    let contributions = 0;
    let taxesPaid = 0;
    let feesPaid = 0;
    let lastYearEndValue = value;
    let contributionsThisYear = 0;
    let capReachedAtMonth = null;
    for (let m = 1; m <= months; m++) {
        const gain = value * monthlyRate;
        value += gain;
        const fee = value * monthlyFeeRate;
        value -= fee;
        feesPaid += fee;
        let deposit = monthly;
        if (contribCap !== null && typeof contribCap !== 'undefined' && !isNaN(contribCap)) {
            const allowed = Math.max(0, contribCap - value);
            const depositThisMonth = Math.min(deposit, allowed);
            deposit = depositThisMonth;
            if (depositThisMonth < monthly && capReachedAtMonth === null) {
                capReachedAtMonth = m;
            }
        }
        value += deposit;
        contributions += deposit;
        contributionsThisYear += deposit;
        if (taxModel === 'annual' && m % 12 === 0) {
            const gainThisYear = value - lastYearEndValue - contributionsThisYear;
            const taxable = Math.max(0, gainThisYear);
            const tax = taxable * (taxPct / 100);
            if (tax > 0) {
                value -= tax;
                taxesPaid += tax;
            }
            lastYearEndValue = value;
            contributionsThisYear = 0;
        }
        series.push(value);
    }
    if (taxModel === 'deferred') {
        const gain = Math.max(0, value - contributions);
        const tax = gain * (taxPct / 100);
        if (tax > 0) {
            value -= tax;
            taxesPaid += tax;
        }
    }
    return { series, finalValue: value, contributions, taxesPaid, feesPaid, capReachedAtMonth };
}

function collapseSeriesToYears(series) {
    const yearsCount = Math.ceil(series.length / 12);
    return Array.from({length: yearsCount}, (_, i) => series[Math.min((i+1)*12 - 1, series.length - 1)]);
}

// Test constants
const start = 9792; // sample askStart (Værdi DKK)
const monthly = 10000;
const years = 10;
const rPct = 7;
const feePct = 0.2;
const taxPct = 17;
const cap = 174200;

const res = simulateSeries(start, monthly, years, rPct, feePct, taxPct, 'annual', cap);
console.log('finalValue', res.finalValue);
console.log('contributions', res.contributions);
console.log('capReachedAtMonth', res.capReachedAtMonth);
console.log('Final series yearly: ', collapseSeriesToYears(res.series));
