document.addEventListener('DOMContentLoaded', () => {

    let referenceState = null;
    let currentTotalCost = 0;

    const dom = {
        tempAussen: document.getElementById('tempAussen'), rhAussen: document.getElementById('rhAussen'),
        tempZuluft: document.getElementById('tempZuluft'), rhZuluft: document.getElementById('rhZuluft'),
        xZuluft: document.getElementById('xZuluft'), volumenstrom: document.getElementById('volumenstrom'),
        kuehlerAktiv: document.getElementById('kuehlerAktiv'), tempVorerhitzer: document.getElementById('tempVorerhitzer'),
        druck: document.getElementById('druck'), feuchteSollTyp: document.getElementById('feuchteSollTyp'),
        resetBtn: document.getElementById('resetBtn'), preisWaerme: document.getElementById('preisWaerme'),
        preisStrom: document.getElementById('preisStrom'), eer: document.getElementById('eer'),
        volumenstromSlider: document.getElementById('volumenstromSlider'), tempZuluftSlider: document.getElementById('tempZuluftSlider'),
        rhZuluftSlider: document.getElementById('rhZuluftSlider'), volumenstromLabel: document.getElementById('volumenstromLabel'),
        tempZuluftLabel: document.getElementById('tempZuluftLabel'), rhZuluftLabel: document.getElementById('rhZuluftLabel'),
        rhZuluftSliderGroup: document.getElementById('rhZuluftSliderGroup'),
        resetSlidersBtn: document.getElementById('resetSlidersBtn'),
        processOverviewContainer: document.getElementById('process-overview-container'),
        stateNode0: { t: document.getElementById('res-t-0'), rh: document.getElementById('res-rh-0'), x: document.getElementById('res-x-0')},
        compVE: { node: document.getElementById('comp-ve'), p: document.getElementById('res-p-ve'), wv: document.getElementById('res-wv-ve') },
        stateNode1: { t: document.getElementById('res-t-1'), rh: document.getElementById('res-rh-1'), x: document.getElementById('res-x-1') },
        compK: { node: document.getElementById('comp-k'), p: document.getElementById('res-p-k'), kondensat: document.getElementById('res-kondensat'), wv: document.getElementById('res-wv-k') },
        stateNode2: { t: document.getElementById('res-t-2'), rh: document.getElementById('res-rh-2'), x: document.getElementById('res-x-2') },
        compNE: { node: document.getElementById('comp-ne'), p: document.getElementById('res-p-ne'), wv: document.getElementById('res-wv-ne') },
        stateNode3: { t: document.getElementById('res-t-3'), rh: document.getElementById('res-rh-3'), x: document.getElementById('res-x-3') },
        stateNodeFinal: { t: document.getElementById('res-t-final'), rh: document.getElementById('res-rh-final'), x: document.getElementById('res-x-final') },
        summaryContainer: document.getElementById('summary-container'),
        referenceDetails: document.getElementById('reference-details'),
        kostenAenderung: document.getElementById('kostenAenderung'), tempAenderung: document.getElementById('tempAenderung'),
        rhAenderung: document.getElementById('rhAenderung'), volumenAenderung: document.getElementById('volumenAenderung'),
        gesamtleistungWaerme: document.getElementById('gesamtleistungWaerme'), gesamtleistungKaelte: document.getElementById('gesamtleistungKaelte'),
        kostenHeizung: document.getElementById('kostenHeizung'), kostenKuehlung: document.getElementById('kostenKuehlung'),
        kostenGesamt: document.getElementById('kostenGesamt'), setReferenceBtn: document.getElementById('setReferenceBtn'),
        kuehlmodus: document.getElementById('kuehlmodus'), kuehlmodusWrapper: document.getElementById('kuehlmodusWrapper'),
        sollFeuchteWrapper: document.getElementById('sollFeuchteWrapper'),
        tempHeizVorlauf: document.getElementById('tempHeizVorlauf'), tempHeizRuecklauf: document.getElementById('tempHeizRuecklauf'),
        tempKuehlVorlauf: document.getElementById('tempKuehlVorlauf'), tempKuehlRuecklauf: document.getElementById('tempKuehlRuecklauf'),
    };

    const TOLERANCE = 0.01;
    const CP_WASSER = 4.186;
    const RHO_WASSER = 1000;

    function getPs(T) { if (T >= 0) return 611.2 * Math.exp((17.62 * T) / (243.12 + T)); else return 611.2 * Math.exp((22.46 * T) / (272.62 + T)); }
    function getX(T, rH, p) { if (p <= 0) return Infinity; const p_s = getPs(T); const p_v = (rH / 100) * p_s; if (p_v >= p) return Infinity; return 622 * (p_v / (p - p_v)); }
    function getRh(T, x, p) { if (p <= 0) return 0; const p_s = getPs(T); if (p_s <= 0) return 0; const p_v = (p * x) / (622 + x); return Math.min(100, (p_v / p_s) * 100); }
    function getTd(x, p) { const p_v = (p * x) / (622 + x); if (p_v < 611.2) return -60; const log_pv_ratio = Math.log(p_v / 611.2); return (243.12 * log_pv_ratio) / (17.62 - log_pv_ratio); }
    function getH(T, x_g_kg) { if (!isFinite(x_g_kg)) return Infinity; const x_kg_kg = x_g_kg / 1000.0; return 1.006 * T + x_kg_kg * (2501 + 1.86 * T); }

    function calculateAll() {
        const visibleFields = [dom.tempAussen, dom.rhAussen, dom.tempZuluft, dom.volumenstrom, dom.druck, dom.preisWaerme, dom.preisStrom, dom.eer, dom.tempHeizVorlauf, dom.tempHeizRuecklauf, dom.tempKuehlVorlauf, dom.tempKuehlRuecklauf, dom.tempVorerhitzer];
        if (dom.rhZuluft.offsetParent !== null) visibleFields.push(dom.rhZuluft);
        if (dom.xZuluft.offsetParent !== null) visibleFields.push(dom.xZuluft);
        for (const field of visibleFields) {
            if (field.value === '') {
                dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">Fehler: Ein sichtbares Eingabefeld ist leer. Bitte alle Felder ausfüllen.</div>`;
                return;
            }
        }
        
        const inputs = {
            tempAussen: parseFloat(dom.tempAussen.value), rhAussen: parseFloat(dom.rhAussen.value),
            tempZuluft: parseFloat(dom.tempZuluft.value), rhZuluft: parseFloat(dom.rhZuluft.value),
            xZuluft: parseFloat(dom.xZuluft.value), volumenstrom: parseFloat(dom.volumenstrom.value),
            kuehlerAktiv: dom.kuehlerAktiv.checked, tempVorerhitzerSoll: 5.0,
            druck: parseFloat(dom.druck.value) * 100, feuchteSollTyp: dom.feuchteSollTyp.value,
            preisWaerme: parseFloat(dom.preisWaerme.value), preisStrom: parseFloat(dom.preisStrom.value),
            eer: parseFloat(dom.eer.value), kuehlmodus: dom.kuehlmodus.value,
            tempHeizVorlauf: parseFloat(dom.tempHeizVorlauf.value), tempHeizRuecklauf: parseFloat(dom.tempHeizRuecklauf.value),
            tempKuehlVorlauf: parseFloat(dom.tempKuehlVorlauf.value), tempKuehlRuecklauf: parseFloat(dom.tempKuehlRuecklauf.value),
        };

        const aussen = { t: inputs.tempAussen, rh: inputs.rhAussen, x: getX(inputs.tempAussen, inputs.rhAussen, inputs.druck) };
        if (!isFinite(aussen.x)) {
            dom.processOverviewContainer.innerHTML = `<div class="process-overview process-error">Fehler im Außenluft-Zustand. Prüfen Sie Temperatur, Feuchte und Luftdruck.</div>`;
            return;
        }
        aussen.h = getH(aussen.t, aussen.x);

        const massenstrom_kg_s = (inputs.volumenstrom / 3600) * 1.2;
        const zuluftSoll = { t: inputs.tempZuluft };

        if (inputs.kuehlerAktiv && inputs.kuehlmodus === 'dehumidify') {
            if (inputs.feuchteSollTyp === 'rh') { zuluftSoll.rh = inputs.rhZuluft; zuluftSoll.x = getX(zuluftSoll.t, zuluftSoll.rh, inputs.druck); } 
            else { zuluftSoll.x = inputs.xZuluft; zuluftSoll.rh = getRh(zuluftSoll.t, zuluftSoll.x, inputs.druck); }
        } else {
            zuluftSoll.x = aussen.x;
            zuluftSoll.rh = getRh(zuluftSoll.t, zuluftSoll.x, inputs.druck);
        }
        zuluftSoll.h = getH(zuluftSoll.t, zuluftSoll.x);

        let states = [aussen, null, null, null];
        let operations = { ve: {p:0, wv:0}, k: {p:0, kondensat:0, wv:0}, ne: {p:0, wv:0} };
        let currentState = { ...aussen };

        if (currentState.t < inputs.tempVorerhitzerSoll) {
            const hNach = getH(inputs.tempVorerhitzerSoll, currentState.x);
            operations.ve.p = massenstrom_kg_s * (hNach - currentState.h);
            currentState = {t: inputs.tempVorerhitzerSoll, h: hNach, x: currentState.x, rh: getRh(inputs.tempVorerhitzerSoll, currentState.x, inputs.druck)};
        }
        states[1] = { ...currentState };
        
        if (inputs.kuehlerAktiv) {
            const h_sens_cool_target = getH(zuluftSoll.t, currentState.x);
            if (inputs.kuehlmodus === 'dehumidify' && currentState.x > zuluftSoll.x + TOLERANCE) {
                const tempNachKuehler = getTd(zuluftSoll.x, inputs.druck);
                const hNachKuehler = getH(tempNachKuehler, zuluftSoll.x);
                operations.k.p = massenstrom_kg_s * (currentState.h - hNachKuehler);
                operations.k.kondensat = massenstrom_kg_s * (currentState.x - zuluftSoll.x) / 1000 * 3600;
                currentState = { t: tempNachKuehler, h: hNachKuehler, x: zuluftSoll.x, rh: getRh(tempNachKuehler, zuluftSoll.x, inputs.druck) };
            } else if (inputs.kuehlmodus === 'sensible' && currentState.t > zuluftSoll.t + TOLERANCE) {
                operations.k.p = massenstrom_kg_s * (currentState.h - h_sens_cool_target);
                currentState = { t: zuluftSoll.t, h: h_sens_cool_target, x: currentState.x, rh: getRh(zuluftSoll.t, currentState.x, inputs.druck)};
            }
        }
        states[2] = { ...currentState };

        if (currentState.t < zuluftSoll.t - TOLERANCE) {
            const h_final = getH(zuluftSoll.t, currentState.x);
            operations.ne.p = massenstrom_kg_s * (h_final - currentState.h);
            currentState = { ...zuluftSoll, t: zuluftSoll.t, h: h_final, x: currentState.x, rh: getRh(zuluftSoll.t, currentState.x, inputs.druck) };
        }
        states[3] = { ...currentState };

        const deltaT_heiz = Math.abs(inputs.tempHeizVorlauf - inputs.tempHeizRuecklauf);
        if (deltaT_heiz > 0) {
            operations.ve.wv = (operations.ve.p / (RHO_WASSER * CP_WASSER * deltaT_heiz)) * 3600;
            operations.ne.wv = (operations.ne.p / (RHO_WASSER * CP_WASSER * deltaT_heiz)) * 3600;
        }
        const deltaT_kuehl = Math.abs(inputs.tempKuehlRuecklauf - inputs.tempKuehlVorlauf);
        if (deltaT_kuehl > 0) operations.k.wv = (operations.k.p / (RHO_WASSER * CP_WASSER * deltaT_kuehl)) * 3600;
        
        renderAll(states, operations, inputs);
    }

    function renderAll(states, operations, inputs) {
        updateStateNode(dom.stateNode0, states[0]);
        updateComponentNode(dom.compVE, operations.ve.p, -1, operations.ve.wv);
        updateStateNode(dom.stateNode1, states[1]);
        updateComponentNode(dom.compK, operations.k.p, operations.k.kondensat, operations.k.wv);
        updateStateNode(dom.stateNode2, states[2]);
        updateComponentNode(dom.compNE, operations.ne.p, -1, operations.ne.wv);
        updateStateNode(dom.stateNode3, states[3]);
        updateStateNode(dom.stateNodeFinal, states[3]);

        const activeSteps = Object.values(operations).filter(op => op.p > 0);
        if (activeSteps.length > 0) {
            const activeNames = Object.entries(operations).filter(([,op]) => op.p > 0).map(([key]) => key.toUpperCase());
            dom.processOverviewContainer.innerHTML = `<div class="process-overview process-info">Prozesskette: ${activeNames.join(' → ')}</div>`;
        } else {
            dom.processOverviewContainer.innerHTML = `<div class="process-overview process-success">Idealzustand: Keine Luftbehandlung erforderlich.</div>`;
        }

        let heizleistungGesamt = operations.ve.p + operations.ne.p;
        let summaryContainer = document.getElementById('summary-container');
        if (operations.ve.p > 0 && operations.ne.p > 0) {
            summaryContainer.innerHTML = `<div class="process-step summary"><h4>➕ Gesamt-Heizleistung</h4><div class="result-grid"><div class="result-item"><span class="label">Leistung (VE + NE)</span><span class="value">${heizleistungGesamt.toFixed(2)} kW</span></div></div></div>`;
        } else {
            summaryContainer.innerHTML = '';
        }

        const kaelteLeistung = operations.k.p;
        dom.gesamtleistungWaerme.textContent = `${heizleistungGesamt.toFixed(2)} kW`;
        dom.gesamtleistungKaelte.textContent = `${kaelteLeistung.toFixed(2)} kW`;

        const kostenHeizung = heizleistungGesamt * inputs.preisWaerme;
        const kostenKuehlung = (kaelteLeistung / inputs.eer) * inputs.preisStrom;
        currentTotalCost = kostenHeizung + kostenKuehlung;
        
        dom.kostenHeizung.textContent = `${kostenHeizung.toFixed(2)} €/h`;
        dom.kostenKuehlung.textContent = `${kostenKuehlung.toFixed(2)} €/h`;
        dom.kostenGesamt.textContent = `${currentTotalCost.toFixed(2)} €/h`;
        
        dom.setReferenceBtn.className = referenceState ? 'activated' : '';
        dom.setReferenceBtn.textContent = referenceState ? 'Referenz gesetzt' : 'Neue Referenz setzen';

        if (referenceState) {
            const changeAbs = currentTotalCost - referenceState.cost;
            const changePerc = referenceState.cost > 0 ? (changeAbs / referenceState.cost) * 100 : 0;
            const sign = changeAbs >= 0 ? '+' : '';
            const changeClass = changeAbs < -TOLERANCE ? 'saving' : (changeAbs > TOLERANCE ? 'expense' : '');
            dom.kostenAenderung.textContent = `${sign}${changeAbs.toFixed(2)} €/h (${sign}${changePerc.toFixed(1)} %)`;
            dom.kostenAenderung.className = `cost-value ${changeClass}`;
            const deltaTemp = inputs.tempZuluft - referenceState.temp;
            dom.tempAenderung.textContent = `${deltaTemp >= 0 ? '+' : ''}${deltaTemp.toFixed(1)} °C`;
            const deltaRh = inputs.rhZuluft - referenceState.rh;
            dom.rhAenderung.textContent = `${deltaRh >= 0 ? '+' : ''}${deltaRh.toFixed(1)} %`;
            const deltaVol = inputs.volumenstrom - referenceState.vol;
            dom.volumenAenderung.textContent = `${deltaVol >= 0 ? '+' : ''}${deltaVol.toFixed(0)} m³/h`;
        } else {
            dom.kostenAenderung.textContent = '--';
            dom.tempAenderung.textContent = '--';
            dom.rhAenderung.textContent = '--';
            dom.volumenAenderung.textContent = '--';
            dom.kostenAenderung.className = 'cost-value';
        }
    }
    
    function updateStateNode(node, state) {
        node.t.textContent = state.t.toFixed(1);
        node.rh.textContent = state.rh.toFixed(1);
        node.x.textContent = state.x.toFixed(2);
    }
    function updateComponentNode(comp, power, kondensat = -1, wasserstrom = 0) {
        comp.p.textContent = power.toFixed(2);
        comp.node.classList.toggle('active', power > 0);
        comp.node.classList.toggle('inactive', power <= 0);
        if (comp.kondensat) comp.kondensat.textContent = (kondensat > 0) ? kondensat.toFixed(2) : '0.00';
        if (comp.wv) comp.wv.textContent = wasserstrom.toFixed(2);
    }

    function handleSetReference() {
        referenceState = { cost: currentTotalCost, temp: parseFloat(dom.tempZuluft.value), rh: parseFloat(dom.rhZuluft.value), vol: parseFloat(dom.volumenstrom.value) };
        dom.resetSlidersBtn.disabled = false;
        dom.referenceDetails.classList.remove('invisible');
        calculateAll();
    }
    
    function resetToDefaults() {
        referenceState = null; dom.resetSlidersBtn.disabled = true;
        dom.tempAussen.value = 20.0; dom.rhAussen.value = 50.0;
        dom.tempZuluft.value = 20.0; dom.rhZuluft.value = 50.0;
        dom.xZuluft.value = 7.26; dom.volumenstrom.value = 5000;
        dom.kuehlerAktiv.checked = true; dom.tempVorerhitzer.value = 5.0;
        dom.druck.value = 1013.25; dom.feuchteSollTyp.value = 'rh';
        dom.preisWaerme.value = 0.12; dom.preisStrom.value = 0.30;
        dom.eer.value = 3.5;
        dom.tempHeizVorlauf.value = 70; dom.tempHeizRuecklauf.value = 50;
        dom.tempKuehlVorlauf.value = 8; dom.tempKuehlRuecklauf.value = 13;
        
        dom.volumenstromSlider.max = 20000;
        syncAllSlidersToInputs();
        handleKuehlerToggle();
        calculateAll();
    }
    
    function resetSlidersToRef() {
        if (!referenceState) return;
        dom.tempZuluft.value = referenceState.temp.toFixed(1);
        dom.rhZuluft.value = referenceState.rh.toFixed(1);
        dom.volumenstrom.value = referenceState.vol;
        syncAllSlidersToInputs();
        calculateAll();
    }

    function handleKuehlerToggle() {
        const isActive = dom.kuehlerAktiv.checked;
        dom.kuehlmodusWrapper.style.display = isActive ? 'block' : 'none';
        const isDehumidify = dom.kuehlmodus.value === 'dehumidify';
        dom.sollFeuchteWrapper.style.display = isActive && isDehumidify ? 'block' : 'none';
    }

    function syncAllSlidersToInputs(){
        syncSliderToInput(dom.volumenstromSlider, dom.volumenstrom, dom.volumenstromLabel);
        syncSliderToInput(dom.tempZuluftSlider, dom.tempZuluft, dom.tempZuluftLabel, true);
        syncSliderToInput(dom.rhZuluftSlider, dom.rhZuluft, dom.rhZuluftLabel, true);
    }
    function syncSliderToInput(slider, input, label, isFloat = false) {
        const newValue = parseFloat(input.value);
        if(isNaN(newValue)) return;
        if (input.id === 'volumenstrom' && newValue > parseFloat(slider.max)) slider.max = newValue;
        slider.value = newValue;
        label.textContent = isFloat ? newValue.toFixed(1) : newValue;
    }
    
    // --- Event Listeners Setup ---
    function addEventListeners() {
        const inputsToRecalculate = [
            dom.tempAussen, dom.rhAussen, dom.tempVorerhitzer, dom.druck, dom.preisWaerme, dom.preisStrom, dom.eer,
            dom.xZuluft, dom.tempHeizVorlauf, dom.tempHeizRuecklauf, dom.tempKuehlVorlauf, dom.tempKuehlRuecklauf
        ];
        inputsToRecalculate.forEach(input => input.addEventListener('input', calculateAll));

        const syncedInputs = [dom.volumenstrom, dom.tempZuluft, dom.rhZuluft];
        syncedInputs.forEach(input => input.addEventListener('input', () => { syncAllSlidersToInputs(); calculateAll(); }));
        
        const sliders = [dom.volumenstromSlider, dom.tempZuluftSlider, dom.rhZuluftSlider];
        sliders.forEach(slider => slider.addEventListener('input', () => {
            const inputId = slider.id.replace('Slider', '');
            const isFloat = inputId !== 'volumenstrom';
            const value = isFloat ? parseFloat(slider.value).toFixed(1) : slider.value;
            dom[inputId].value = value;
            dom[inputId+'Label'].textContent = value;
            calculateAll();
        }));

        dom.kuehlerAktiv.addEventListener('change', () => { handleKuehlerToggle(); calculateAll(); });
        dom.feuchteSollTyp.addEventListener('change', calculateAll);
        dom.kuehlmodus.addEventListener('change', () => { handleKuehlerToggle(); calculateAll(); });
        
        dom.resetBtn.addEventListener('click', resetToDefaults);
        dom.resetSlidersBtn.addEventListener('click', resetSlidersToRef);
        dom.setReferenceBtn.addEventListener('click', handleSetReference);
    }

    addEventListeners();
    handleKuehlerToggle();
    calculateAll();
});
