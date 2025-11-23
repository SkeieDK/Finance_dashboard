// investing-constants.js
// Centralized rules/constants for investing calculations and display
// Edit these constants to reflect policy changes as necessary.

(function (global) {
    const InvestingRules = {
        // Aktiesparekonto rules
        // Contribution limits by year. Use the key as 'year', numeric value is the cap in DKK
        aktiesparekontoCap: {
            2025: 166200,
            2026: 174200
        },
        // Tax rate on aktiesparekonto (lagerprincippet) – percent
        aktiesparekontoTaxPct: 17.0,

        // Aktieindkomst tax bands (for general aktieindkomst outside aktiesparekonto)
        // First bracket taxed at 27% for amounts up to bracketThreshold
        aktieIncomeBracketThreshold: 67500, // DKK
        aktieIncomeTaxRate1: 0.27, // 27% as decimal
        aktieIncomeTaxRate2: 0.42, // 42% for amounts above the bracket

        // Misc display options
        defaultCurrencyLocale: 'da-DK', // used for formatting

        // Helpers
        formatCurrency(value, options = { minimumFractionDigits: 0, maximumFractionDigits: 0 }) {
            return new Intl.NumberFormat(this.defaultCurrencyLocale, { style: 'currency', currency: 'DKK', ...options }).format(value);
        },
        // Calculate remaining Aktiesparekonto capacity for a given year using closing balance at prev year
        // closingBalanceOnPrevYearEnd: e.g., course value at 31 Dec previous year
        remainingAktiespareCapacity(year, closingBalanceOnPrevYearEnd) {
            const cap = Number(this.aktiesparekontoCap[year] || 0);
            const used = Number(closingBalanceOnPrevYearEnd || 0);
            const remaining = Math.max(0, cap - used);
            return remaining;
        },
        // Calculate tax for aktieindkomst using bracket limits/rates
        // taxableValue: the taxable aktieindkomst to tax
        aktieIncomeTax(taxableValue) {
            let v = Number(taxableValue || 0);
            const bracket = Number(this.aktieIncomeBracketThreshold || 0);
            const r1 = Number(this.aktieIncomeTaxRate1 || 0);
            const r2 = Number(this.aktieIncomeTaxRate2 || 0);
            if (v <= bracket) return v * r1;
            const firstPart = bracket * r1;
            const remainder = (v - bracket) * r2;
            return firstPart + remainder;
        }
    };

    // Expose global variable for the front-end to use
    global.InvestingRules = InvestingRules;
})(window);
