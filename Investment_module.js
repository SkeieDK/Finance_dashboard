// Investments Module (moved out of Analyse.html)
(function(){
    function fmt(value){ return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value||0); }
    function parseNum(id, def=0){ const el = document.getElementById(id); const v = parseFloat(el?.value); return isNaN(v) ? def : v; }
    function monthlyRate(pct){ return (pct||0)/100/12; }
    function addM(date, n){ const d = new Date(date.getTime()); d.setUTCMonth(d.getUTCMonth()+n); return d; }

    let chart;
    const storage = {
        get(k, d){ try{ const v = localStorage.getItem(k); return v==null? d : JSON.parse(v);}catch{ return d; } },
        set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
    };

    function amortPayment(balance, annualRatePct, years){
        const r = monthlyRate(annualRatePct);
        const n = Math.max(1, Math.round((years||0)*12));
        if(r <= 0) return balance / n;
        const pow = Math.pow(1+r, n);
        return balance * (r * pow) / (pow - 1);
    }

    function simulateInvest({label, color, start, monthly, lump, years, startDate, rPct, feePct, taxPct, taxModel, combinedCap}){
        const months = Math.max(1, Math.round((years||1)*12));
        const rM = monthlyRate(rPct||0);
        const fM = (feePct||0)/100/12;
        let bal = Math.max(0, start||0);
        let totalOwn=0, totalFees=0, totalTax=0;
        let totalGrossReturn=0; // before tax and fees
        let yearStart = bal, contribYear = 0;
        let capRemCombined = combinedCap != null ? combinedCap : Infinity;
        const points = [];
        // Apply lump sum at start
        if(lump && lump>0){
            const allowed = capRemCombined !== Infinity ? Math.min(lump, capRemCombined) : lump;
            bal += allowed; totalOwn += allowed; contribYear += allowed; if(capRemCombined !== Infinity) capRemCombined -= allowed;
        }
        for(let i=0;i<months;i++){
            const before = bal;
            bal *= (1+rM);
            totalGrossReturn += (bal - before);
            const fee = bal * fM; bal -= fee; totalFees += fee;
            let contrib = Math.max(0, monthly||0);
            // Enforce combined lifetime deposit cap (remaining room)
            if(capRemCombined !== Infinity){
                const allowed = Math.max(0, Math.min(contrib, capRemCombined));
                contrib = allowed; capRemCombined -= allowed;
            }
            bal += contrib; totalOwn += contrib; contribYear += contrib;
            if(i%12===11 && taxModel==='annual'){
                const gain = bal - yearStart - contribYear;
                const tax = Math.max(0, gain) * ((taxPct||0)/100);
                bal -= tax; totalTax += tax; yearStart = bal; contribYear = 0;
            }
            points.push({ date: addM(startDate, i), balance: bal });
        }
        if(taxModel==='deferred'){
            const gain = bal - (start||0) - totalOwn;
            const tax = Math.max(0, gain) * ((taxPct||0)/100);
            bal -= tax; totalTax += tax; if(points.length) points[points.length-1].balance = bal;
        }
        const netReturn = bal - totalOwn - (start||0);
        return { key: label, label, color, points, final: bal, totalOwnContrib: totalOwn, totalFees, totalTax, grossReturn: totalGrossReturn, netReturn };
    }

    function simulateLoanExtra({balance, ratePct, termYears, payment, extraMonthly, extraLump, years, startDate, interestTaxValuePct}){
        const months = Math.max(1, Math.round((years||1)*12));
        const r = monthlyRate(ratePct||0);
        const P = payment && payment > 0 ? payment : amortPayment(balance, ratePct, termYears);

        let baseBal = balance;
        let extraBal = balance;
        const points = [];
        let totalExtraApplied = 0; // actually applied as extra principal
        let extraLumpRemaining = Math.max(0, extraLump||0);
        let afterTaxInterestSavedCum = 0;
        const taxKeep = 1 - ((interestTaxValuePct||0)/100); // keep-rate after tax deduction loss
        const monthlyRows = [];

        for(let i=0;i<months;i++){
            const date = addM(startDate, i);
            // Baseline payment path
            let baseInterest = 0, basePrincipal = 0;
            if(baseBal > 0){
                baseInterest = baseBal * r;
                basePrincipal = Math.min(baseBal, Math.max(0, P - baseInterest));
                baseBal -= basePrincipal;
            }
            // Extra-paydown path
            let extraInterest = 0;
            if(extraBal > 0){
                // Apply extra payment BEFORE interest accrues
                let extraPay = Math.max(0, extraMonthly||0);
                if(i===0 && extraLumpRemaining>0){
                    extraPay += extraLumpRemaining;
                    extraLumpRemaining = 0;
                }
                if(extraPay > 0){
                    const prepay = Math.min(extraBal, extraPay);
                    extraBal -= prepay;
                    totalExtraApplied += prepay;
                }
                // Now accrue interest and apply the regular payment P
                extraInterest = extraBal * r;
                const principalFromP = Math.min(extraBal, Math.max(0, P - extraInterest));
                extraBal -= principalFromP;
            }
            // Net interest saved this month vs baseline
            const interestSaved = Math.max(0, baseInterest - extraInterest);
            afterTaxInterestSavedCum += interestSaved * taxKeep;

            const deltaDebt = Math.max(0, baseBal - extraBal);
            const value = deltaDebt + afterTaxInterestSavedCum;
            points.push({ date, balance: value });
            monthlyRows.push({
                date,
                base: { interest: baseInterest, balance: baseBal },
                extra: { interest: extraInterest, balance: extraBal },
                savedAfterTax: interestSaved * taxKeep
            });
        }
        // For comparison in table: treat "netReturn" for loan as cumulative after-tax interest saved plus debt reduction
        const finalVal = points[points.length-1]?.balance || 0;
        const netReturn = finalVal; // there is no market value asset; this is benefit vs. baseline
        return { key: 'Ekstra afdrag (værdi)', label: 'Ekstra afdrag (værdi)', color: '#ef4444', points, final: finalVal, totalOwnContrib: totalExtraApplied, totalFees: 0, totalTax: 0, grossReturn: afterTaxInterestSavedCum, netReturn, monthlyRows };
    }

    function renderChart(accounts){
        const el = document.getElementById('investmentChart'); if(!el) return;
        if(chart){ try{ chart.destroy(); }catch(_){} }
        if(!accounts || accounts.length===0) return;
        const mode = document.getElementById('invChartMode')?.value || 'net';
        const ctx = el.getContext('2d');
        // Compute axis bounds from data
        const allPoints = accounts.flatMap(a => a.points || []);
        const minDate = allPoints.reduce((m,p) => (!m || p.date < m) ? p.date : m, null);
        const maxDate = allPoints.reduce((m,p) => (!m || p.date > m) ? p.date : m, null);
        chart = new Chart(ctx, { type: 'line', data: { datasets: accounts.map(acc => ({
            label: acc.label,
            data: acc.points.map(p => ({ x: p.date, y: mode==='net' ? (p.net ?? p.balance) : p.balance })),
            borderColor: acc.color, backgroundColor: acc.color, tension: 0.15, borderWidth: 2, pointRadius: 0
        })) }, options: { responsive: true, maintainAspectRatio: false, parsing: false, scales: { x: { type: 'time', time: { unit: 'year' }, ticks: { source: 'auto', maxRotation: 0, autoSkip: true, stepSize: 1 }, grid: { display: false }, min: minDate, max: maxDate }, y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } } });
    }

    function renderTable(accounts){
        const tbody = document.getElementById('investmentTable'); if(!tbody) return;
        tbody.innerHTML = '';
        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            const taxCell = acc.isLoan ? '—' : fmt(-(acc.totalTax||0));
            const feeCell = acc.isLoan ? '—' : fmt(-(acc.totalFees||0));
            tr.innerHTML = `<td class="px-3 py-2 whitespace-nowrap text-gray-800">${acc.label}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right">${fmt(acc.totalOwnContrib)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right">${fmt(acc.grossReturn || 0)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right text-red-600">${taxCell}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right text-red-600">${feeCell}</td>
                <td class="px-3 py-2 whitespace-nowrap text-right font-semibold">${fmt(acc.netReturn || (acc.final - acc.totalOwnContrib))}</td>`;
            tbody.appendChild(tr);
        });
    }

    function setSummary(id, html){ const el = document.getElementById(id); if(el) el.innerHTML = html; }
    function summaryBlock(acc){
        return `<div class="grid grid-cols-2 gap-2">
            <div class=\"flex justify-between\"><span>Indskud:</span><span>${fmt(acc.totalOwnContrib)}</span></div>
            <div class=\"flex justify-between\"><span>Gebyrer:</span><span class=\"text-red-600\">${fmt(-(acc.totalFees||0))}</span></div>
            <div class=\"flex justify-between\"><span>Skat:</span><span class=\"text-red-600\">${fmt(-(acc.totalTax||0))}</span></div>
            <div class=\"flex justify-between\"><span>Slutværdi:</span><span class=\"font-medium\">${fmt(acc.final)}</span></div>
        </div>`;
    }

    function recalc(){
    const years = parseNum('invYears', 20);
        const startYm = document.getElementById('invStart')?.value || '';
        const startDate = startYm ? new Date(Date.UTC(parseInt(startYm.slice(0,4),10), parseInt(startYm.slice(5),10)-1, 1)) : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
    const type = document.getElementById('invType')?.value || 'monthly';
    const monthlyAlloc = type==='monthly' ? parseNum('invMonthly', 3000) : 0;
    const lumpAlloc = type==='lump' ? parseNum('invLumpSum', 0) : 0;
        const flowOnly = !!document.getElementById('invFlowOnly')?.checked;
    const timing = document.getElementById('invTiming')?.value || 'start';

        const askMonthlyEl = document.getElementById('askMonthly');
        if(askMonthlyEl && askMonthlyEl.dataset.autosync !== 'false') askMonthlyEl.value = String(monthlyAlloc);
        const freeMonthlyEl = document.getElementById('freeMonthly');
        if(freeMonthlyEl && freeMonthlyEl.dataset.autosync !== 'false') freeMonthlyEl.value = String(monthlyAlloc);

        const accounts = [];
        if(document.getElementById('askEnabled')?.checked){
            const acc = simulateInvest({ label: 'Aktiesparekonto', color: '#3b82f6', start: parseNum('askStart',0), monthly: parseNum('askMonthly', monthlyAlloc), lump: lumpAlloc, years, startDate, rPct: parseNum('askReturn',7), feePct: parseNum('askFee',0.4), taxPct: parseNum('askTax',17), taxModel: 'annual', combinedCap: (function(){ const v=parseNum('askCapRemaining'); return v>0? v: null; })() });
            accounts.push(acc); setSummary('askSummary', summaryBlock(acc));
        } else setSummary('askSummary','');

        if(document.getElementById('freeEnabled')?.checked){
            const acc = simulateInvest({ label: 'Frie investeringer', color: '#8b5cf6', start: parseNum('freeStart',0), monthly: parseNum('freeMonthly', monthlyAlloc), lump: lumpAlloc, years, startDate, rPct: parseNum('freeReturn',7), feePct: parseNum('freeFee',0.2), taxPct: parseNum('freeTax',27), taxModel: (document.getElementById('freeTaxModel')?.value || 'annual') });
            accounts.push(acc); setSummary('freeSummary', summaryBlock(acc));
        } else setSummary('freeSummary','');

        if(document.getElementById('loanEnabled')?.checked){
            const acc = simulateLoanExtra({ balance: parseNum('loanBalance',0), ratePct: parseNum('loanRate',0), termYears: parseNum('loanTerm',20), payment: parseNum('loanPayment',0), extraMonthly: monthlyAlloc, extraLump: lumpAlloc, years, startDate, interestTaxValuePct: parseNum('loanInterestTaxValue', 26) });
            // If flow-only, overwrite netReturn to ignore restgæld delta and use only after-tax interest saved
            if(flowOnly){ acc.netReturn = acc.grossReturn || 0; }
            acc.isLoan = true;
            accounts.push(acc);
            // Enrich summary with breakdown
            const interestSavedNet = acc.grossReturn || 0;
            const finalDebtDelta = (acc.final || 0) - interestSavedNet;
            setSummary('loanSummary', `${summaryBlock(acc)}
                <div class="mt-1 text-xs text-gray-500 space-y-1">
                    <div>Efter-skat sparede renter i perioden: <strong>${fmt(interestSavedNet)}</strong></div>
                    <div>Mindre restgæld ved horisont: <strong>${fmt(finalDebtDelta)}</strong></div>
                    <div>Netto sammenligning: ${flowOnly ? 'Kun løbende efter-skat renter' : 'Efter-skat renter + mindre restgæld'}</div>
                </div>`);
            // Render monthly table (compact, last 12 months)
            const detailsEl = document.getElementById('loanDetailsMonthly');
            if(detailsEl){
                const rows = (acc.monthlyRows||[]).slice(-12).map(r => `<tr>
                    <td class="px-2 py-1 whitespace-nowrap">${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth()+1).padStart(2,'0')}</td>
                    <td class="px-2 py-1 text-right">${fmt(-r.base.interest)}</td>
                    <td class="px-2 py-1 text-right">${fmt(-r.extra.interest)}</td>
                    <td class="px-2 py-1 text-right">${fmt(r.savedAfterTax)}</td>
                    <td class="px-2 py-1 text-right text-gray-500">${fmt(-r.base.balance)}</td>
                    <td class="px-2 py-1 text-right text-gray-500">${fmt(-r.extra.balance)}</td>
                </tr>`).join('');
                detailsEl.innerHTML = `
                    <div class="mt-2">
                        <div class="mb-1 font-medium">Seneste 12 måneder (baseline vs. efter ekstra afdrag)</div>
                        <div class="overflow-x-auto"><table class="min-w-full border-t text-[11px]">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-2 py-1 text-left">Måned</th>
                                    <th class="px-2 py-1 text-right">Rente (baseline)</th>
                                    <th class="px-2 py-1 text-right">Rente (med ekstra)</th>
                                    <th class="px-2 py-1 text-right">Sparet (efter skat)</th>
                                    <th class="px-2 py-1 text-right text-gray-500">Restgæld (baseline)</th>
                                    <th class="px-2 py-1 text-right text-gray-500">Restgæld (med ekstra)</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table></div>
                    </div>`;
            }
        } else setSummary('loanSummary','');

        renderChart(accounts);
        renderTable(accounts);
        renderRecommendation(accounts);
    }

    function setup(){
        const invStart = document.getElementById('invStart');
        if(invStart){ const now = new Date(); invStart.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; }
        const mark = (id)=>{ const el = document.getElementById(id); if(!el) return; el.dataset.autosync = 'true'; el.addEventListener('input', ()=>{ el.dataset.autosync = 'false'; }); };
        mark('askMonthly'); mark('freeMonthly');
    const ids = ['invYears','invStart','invType','invMonthly','invLumpSum','invFlowOnly','invTiming','invChartMode','askEnabled','askStart','askMonthly','askReturn','askTax','askFee','askCapRemaining','freeEnabled','freeStart','freeMonthly','freeReturn','freeTax','freeFee','freeTaxModel','loanEnabled','loanBalance','loanRate','loanTerm','loanPayment','loanInterestTaxValue','loanTarget'];
        ids.forEach(id => { const el = document.getElementById(id); if(!el) return; const evt = el.tagName === 'SELECT' ? 'change' : 'input'; el.addEventListener(evt, recalc); });
        document.getElementById('invRecalcBtn')?.addEventListener('click', recalc);
        // Toggle monthly/lump inputs
        const typeSel = document.getElementById('invType');
        const monthlyWrap = document.getElementById('invMonthlyWrap');
        const lumpWrap = document.getElementById('invLumpWrap');
        if(typeSel){
            const updateType = () => {
                const t = typeSel.value;
                monthlyWrap.classList.toggle('hidden', t !== 'monthly');
                lumpWrap.classList.toggle('hidden', t !== 'lump');
            };
            typeSel.addEventListener('change', updateType);
            updateType();
        }
    // Restore persisted choices
    const flowOnlyEl = document.getElementById('invFlowOnly'); if(flowOnlyEl){ flowOnlyEl.checked = storage.get('invFlowOnly', flowOnlyEl.checked); flowOnlyEl.addEventListener('change', ()=>storage.set('invFlowOnly', flowOnlyEl.checked)); }
    const targetEl = document.getElementById('loanTarget'); if(targetEl){ const saved = storage.get('loanTarget','auto'); targetEl.value = saved; targetEl.addEventListener('change', ()=>storage.set('loanTarget', targetEl.value)); }
    const chartModeEl = document.getElementById('invChartMode'); if(chartModeEl){ const saved = storage.get('invChartMode','net'); chartModeEl.value = saved; chartModeEl.addEventListener('change', ()=>storage.set('invChartMode', chartModeEl.value)); }
    const timingEl = document.getElementById('invTiming'); if(timingEl){ const saved = storage.get('invTiming','start'); timingEl.value = saved; timingEl.addEventListener('change', ()=>storage.set('invTiming', timingEl.value)); }

    recalc();
    }

    function renderRecommendation(accounts){
        const el = document.getElementById('invRecommendation'); if(!el) return;
        if(!accounts || !accounts.length){ el.textContent=''; return; }
        // Recommend by net return (after tax and fees for investments; after-tax interest saved + debt reduction for loan)
        const sorted = [...accounts].sort((a,b)=> (b.netReturn||0) - (a.netReturn||0));
        const best = sorted[0];
        const lines = sorted.map(a => `${a.label}: ${fmt(a.final)}`);
        el.innerHTML = `<div class="p-2 bg-gray-50 rounded">`+
            `<div class="font-medium mb-1">Anbefaling (simpel): <span class="text-indigo-700">${best.label}</span></div>`+
            `<div class="text-xs text-gray-600">Nettoafkast-rangering: ${sorted.map(a=>`${a.label}: ${fmt(a.netReturn||0)}`).join(' · ')}</div>`+
            `</div>`;
    }

    function prefillFromLoans(){
        try{
            const data = (typeof LOAN_DATA !== 'undefined' ? LOAN_DATA : (window.LOAN_DATA || {}));
            const bl = data['Boliglån']; const rk = data['Realkreditlån'];
            const elBal = document.getElementById('loanBalance');
            const elRate = document.getElementById('loanRate');
            const elPay  = document.getElementById('loanPayment');
            const elTerm = document.getElementById('loanTerm');
            const elTarget = document.getElementById('loanTarget');

            const setIfEmpty = (el, v, transform=x=>x) => { if(!el) return; if((el.value===undefined || el.value===null || el.value==='') && v!=null && !Number.isNaN(v)) el.value = String(transform(v)); };

            let target = null;
            const desired = elTarget?.value || 'auto';
            if(desired==='Boliglån' && bl && bl.debt>0) target = { type:'Boliglån', ...bl };
            else if(desired==='Realkreditlån' && rk && rk.debt>0) target = { type:'Realkreditlån', ...rk };
            else target = (bl && bl.debt>0) ? { type:'Boliglån', ...bl } : ((rk && rk.debt>0) ? { type:'Realkreditlån', ...rk } : null);
            if(!target){ recalc(); return; }

            setIfEmpty(elBal, Math.round(target.debt));

            const BL_TXS = (typeof BOLIGLAAN_TRANSACTIONS !== 'undefined' ? BOLIGLAAN_TRANSACTIONS : window.BOLIGLAAN_TRANSACTIONS);
            const AMORT = (typeof AMORTIZATION_SCHEDULE !== 'undefined' ? AMORTIZATION_SCHEDULE : window.AMORTIZATION_SCHEDULE);
            const TODAYG = (typeof TODAY !== 'undefined' ? TODAY : window.TODAY);

            if(target.type==='Boliglån' && Array.isArray(BL_TXS)){
                const txs = BL_TXS.filter(tx => tx.date && (!TODAYG || tx.date <= TODAYG));
                if(txs.length){
                    const last = txs[txs.length-1];
                    const y = last.date.getUTCFullYear();
                    const m = last.date.getUTCMonth();
                    const monthTx = txs.filter(t => t.date.getUTCFullYear()===y && t.date.getUTCMonth()===m);
                    const outflow = monthTx.filter(t => t.amount<0).reduce((s,t)=> s + Math.abs(t.amount), 0);
                    const interest = monthTx.filter(t => (t.description||'').toLowerCase().includes('rente af gæld')).reduce((s,t)=> s + Math.abs(t.amount), 0);
                    const debtNow = Math.abs(last.balance) || target.debt;
                    const rPct = debtNow>0 && interest>0 ? Math.min(25, Math.max(0, (interest / debtNow) * 12 * 100)) : null;
                    setIfEmpty(elRate, rPct, v => Math.round(v*10)/10);
                    setIfEmpty(elPay, outflow, v => Math.round(v));
                    // Estimate remaining term from annuity formula if possible
                    const rM = rPct!=null ? (rPct/100)/12 : null;
                    if(rM && outflow>debtNow*rM){
                        const n = Math.log(outflow / (outflow - rM*debtNow)) / Math.log(1+rM);
                        const years = Math.max(0.1, Math.min(50, n/12));
                        setIfEmpty(elTerm, years, v => Math.round(v));
                    }
                }
            } else if (target.type==='Realkreditlån' && AMORT && Object.keys(AMORT).length){
                const terms = Object.values(AMORT).filter(t => t.date && (!TODAYG || t.date <= TODAYG)).sort((a,b)=> a.date-b.date);
                const lastT = terms[terms.length-1];
                if(lastT){
                    const debtNow = lastT.restgaeld || target.debt;
                    const interestMonthly = (lastT.rente||0) + (lastT.bidrag||0);
                    const rPct = debtNow>0 && interestMonthly>0 ? Math.min(20, Math.max(0, (interestMonthly / debtNow) * 12 * 100)) : null;
                    const payment = (lastT.afdrag||0) + interestMonthly;
                    setIfEmpty(elRate, rPct, v => Math.round(v*10)/10);
                    setIfEmpty(elPay, payment, v => Math.round(v));
                    if((lastT.afdrag||0) > 0){
                        const years = Math.max(0.1, Math.min(50, debtNow / lastT.afdrag / 12));
                        setIfEmpty(elTerm, years, v => Math.round(v));
                    }
                }
            }
            recalc();
        }catch(_){ }
    }

    window.Investments = { setup, recalc, prefillFromLoans };
})();
