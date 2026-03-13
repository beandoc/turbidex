// --- FIREBASE INTEGRATION ---
import { db, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, orderBy, limit } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const form = document.getElementById('patientForm');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    // Tab Switching Logic
    const actionsArea = document.querySelector('.actions');
    
    function toggleActionsVisibility(tabId) {
        if (!actionsArea) return;
        // Hide global actions on the first 3 "setup" tabs
        if (['setup', 'demographics', 'vitals'].includes(tabId)) {
            actionsArea.style.display = 'none';
        } else {
            actionsArea.style.display = 'block';
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(target).classList.add('active');
            
            toggleActionsVisibility(target);
            
            // Scroll to the top when switching tabs
            window.scrollTo(0, 0);
        });
    });

    // Initial visibility check
    toggleActionsVisibility('setup');

    // Save & Next button logic
    const nextTabBtns = document.querySelectorAll('.next-tab-btn');
    nextTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextTabId = btn.getAttribute('data-next');
            const targetTab = document.querySelector(`.tab-btn[data-tab="${nextTabId}"]`);
            if (targetTab) {
                targetTab.click(); // Trigger the existing tab click logic
            }
        });
    });

    // --- LIVE PERSISTENCE & DASHBOARD ---
    const countVitalsEl = document.getElementById('count_machine_logs');
    const countEventsEl = document.getElementById('count_events');
    const timerEl = document.getElementById('session_timer');
    let sessionStartTime = null;

    function updateDashboard() {
        if (countVitalsEl) countVitalsEl.textContent = periodicLogs.length;
        if (countEventsEl) countEventsEl.textContent = events.length;
        
        // Autosave current state to localStorage
        saveActiveSession();
    }

    function saveActiveSession() {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data._periodicLogs = periodicLogs;
        data._events = events;
        data._sessionStartTime = sessionStartTime;
        localStorage.setItem('turbidex_active_session', JSON.stringify(data));
    }

    function restoreActiveSession() {
        const saved = localStorage.getItem('turbidex_active_session');
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            
            // Restore form fields
            Object.keys(data).forEach(key => {
                if (key.startsWith('_')) return;
                const field = form.querySelector(`[name="${key}"]`);
                if (field) {
                    if (field.type === 'radio') {
                        const rb = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
                        if (rb) rb.checked = true;
                    } else {
                        field.value = data[key];
                    }
                }
            });

            // Restore logs
            if (data._periodicLogs) periodicLogs = data._periodicLogs;
            if (data._events) events = data._events;
            if (data._sessionStartTime) sessionStartTime = new Date(data._sessionStartTime);

            renderEvents();
            renderPeriodicLogs();
            updateDashboard();
            
            // Show notification
            const toast = document.createElement('div');
            toast.style = "position: fixed; bottom: 20px; right: 20px; background: #27ae60; color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
            toast.textContent = "Unfinished session restored automatically!";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

        } catch(e) { console.error("Restore failed:", e); }
    }

    // Timer & Auto-Capture logic
    let lastAutoCaptureTime = null;
    setInterval(() => {
        if (!timerEl) return;
        if (periodicLogs.length > 0 || events.length > 0) {
            if (!sessionStartTime) sessionStartTime = new Date();
            const now = new Date();
            const diff = Math.floor((now - sessionStartTime) / 1000);
            const h = String(Math.floor(diff / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            timerEl.textContent = `${h}:${m}:${s}`;

            // Automated Vitals Capture (Every 30 Minutes)
            // Initial capture when session starts, then every 30m
            if (!lastAutoCaptureTime || (now - lastAutoCaptureTime) >= (30 * 60 * 1000)) {
                lastAutoCaptureTime = now; // Set BEFORE to prevent loop if render crashes
                try {
                    autoCaptureVitals();
                } catch(e) { console.error("Auto-capture failed:", e); }
            }
        }
    }, 1000);

    function autoCaptureVitals() {
        if (!dynSbp || !dynDbp || !dynHr) return;
        
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const currentTime = `${h}:${m}:${s}`;

        periodicLogs.push({
            time: currentTime,
            ufr: '',
            cumUf: '',
            qb: '',
            sbp: dynSbp.value,
            dbp: dynDbp.value,
            hr: dynHr.value,
            infusion: 'No',
            _isAuto: true,
            _isVitals: true
        });

        renderPeriodicLogs();
        console.log(`Auto-captured vitals at ${currentTime}`);
    }

    // Trigger restore on load
    restoreActiveSession();

    // Autosave on any form interaction
    form.addEventListener('input', () => {
        saveActiveSession();
    });

    // Toggle planned blood transfusion details
    const plannedTransfusionSelect = document.getElementById('planned_transfusion');
    const plannedTransfusionDetails = document.getElementById('planned_transfusion_details');

    if (plannedTransfusionSelect && plannedTransfusionDetails) {
        plannedTransfusionSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Yes') {
                plannedTransfusionDetails.style.display = 'grid';
            } else {
                plannedTransfusionDetails.style.display = 'none';
                
                // Optional: clear inputs when hidden
                const inputs = plannedTransfusionDetails.querySelectorAll('input');
                inputs.forEach(input => input.value = '');
            }
        });
    }

    // Event Logger Logic
    let events = [];
    const eventTimeInput = document.getElementById('event_time');
    const eventTypeSelect = document.getElementById('event_type');
    const eventDetailsInput = document.getElementById('event_details');
    const addEventBtn = document.getElementById('addEventBtn');
    const eventList = document.getElementById('eventList');
    const emptyEventRow = document.getElementById('emptyEventRow');
    const eventLogJsonInput = document.getElementById('event_log_json');

    function renderEvents() {
        // Clear all rows except the empty message placeholder
        eventList.innerHTML = '';
        
        if (events.length === 0) {
            eventList.appendChild(emptyEventRow);
            emptyEventRow.style.display = 'table-row';
            eventLogJsonInput.value = '[]';
            return;
        }

        // Hide empty message
        emptyEventRow.style.display = 'none';
        
        // Sort events by time
        events.sort((a, b) => a.time.localeCompare(b.time));

        events.forEach((evt, index) => {
            const tr = document.createElement('tr');
            
            const tdTime = document.createElement('td');
            tdTime.textContent = evt.time;
            
            const tdType = document.createElement('td');
            tdType.textContent = evt.type;
            
            const tdDetails = document.createElement('td');
            tdDetails.textContent = evt.details;
            
            const tdAction = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.style.color = 'red';
            delBtn.style.background = 'none';
            delBtn.style.border = 'none';
            delBtn.style.fontSize = '1.2rem';
            delBtn.style.padding = '5px';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Remove Event';
            delBtn.addEventListener('click', () => {
                events.splice(index, 1);
                renderEvents();
            });
            tdAction.appendChild(delBtn);

            tr.appendChild(tdTime);
            tr.appendChild(tdType);
            tr.appendChild(tdDetails);
            tr.appendChild(tdAction);

            eventList.appendChild(tr);
        });
        
        eventLogJsonInput.value = JSON.stringify(events);
        updateDashboard();
    }

    addEventBtn.addEventListener('click', () => {
        const time = eventTimeInput.value;
        const type = eventTypeSelect.value;
        const details = eventDetailsInput.value.trim();

        if (!time) {
            alert('Please specify the absolute time of the event.');
            return;
        }
        if (!type && !details) {
            alert('Please specify an event type or description.');
            return;
        }

        if (type === 'Hypotensive Dip' && (!details || !details.includes('/'))) {
            const manualSbp = prompt("Hypotensive Dip detected. Please enter SBP/DBP (e.g. 90/60) for research analysis:");
            if (!manualSbp || !manualSbp.includes('/')) {
                alert("Valid SBP/DBP is required for Hypotensive Dip adjudication.");
                return;
            }
            events.push({
                time: time,
                type: type,
                details: `BP: ${manualSbp}`
            });
        } else {
            events.push({
                time: time,
                type: type || 'Other',
                details: details
            });
        }

        // Reset inputs
        eventTimeInput.value = '';
        eventTypeSelect.value = '';
        eventDetailsInput.value = '';

        renderEvents();
    });

    // Setup Quick-Tap Event Buttons
    const quickEventBtns = document.querySelectorAll('.quick-event-btn');
    quickEventBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventType = e.target.getAttribute('data-event');
            
            // Get current exact HH:MM:SS
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const currentTime = `${h}:${m}:${s}`;
            
            if (eventType === 'Hypotensive Dip') {
                const sbpVal = dynSbp.value;
                const dbpVal = dynDbp.value;
                const confirmBp = confirm(`Log Hypotensive Dip at current slider values (${sbpVal}/${dbpVal} mmHg)?`);
                
                if (confirmBp) {
                    events.push({
                        time: currentTime,
                        type: eventType,
                        details: `BP: ${sbpVal}/${dbpVal}`
                    });
                } else {
                    const manualBp = prompt("Enter exact SBP/DBP for this dip (e.g. 85/50):");
                    if (manualBp && manualBp.includes('/')) {
                        events.push({
                            time: currentTime,
                            type: eventType,
                            details: `BP: ${manualBp}`
                        });
                    } else {
                        alert("Dip NOT logged. SBP/DBP is required for clinical correlation.");
                        return;
                    }
                }
            } else {
                events.push({
                    time: currentTime,
                    type: eventType,
                    details: 'Quick Logged'
                });
            }
            
            renderEvents();
            
            // Give user tiny visual feedback bubble
            const originalBg = e.target.style.backgroundColor;
            e.target.style.backgroundColor = '#2ecc71'; // flash green
            e.target.innerText = 'Logged!';
            setTimeout(() => {
                e.target.style.backgroundColor = originalBg;
                e.target.innerText = eventType;
            }, 1000);
        });
    });

    // Periodic Logger Logic
    let periodicLogs = [];
    const addLogBtn = document.getElementById('addLogBtn');
    const periodicLogList = document.getElementById('periodicLogList');
    const emptyPeriodicRow = document.getElementById('emptyPeriodicRow');
    const vitalsLogList = document.getElementById('vitalsLogList');
    const emptyVitalsRow = document.getElementById('emptyVitalsRow');
    const periodicLogJsonInput = document.getElementById('periodic_log_json');

    function renderPeriodicLogs() {
        periodicLogList.innerHTML = '';
        vitalsLogList.innerHTML = '';
        
        const machineLogs = periodicLogs.filter(l => l._isMachine);
        const vitalsLogs = periodicLogs.filter(l => l._isVitals);

        // Render Machine Logs
        if (machineLogs.length === 0) {
            periodicLogList.appendChild(emptyPeriodicRow);
            emptyPeriodicRow.style.display = 'table-row';
        } else {
            emptyPeriodicRow.style.display = 'none';
            machineLogs.sort((a, b) => a.time.localeCompare(b.time)).forEach((log, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${log.time}</td>
                    <td>${log.ufr || ''}</td>
                    <td>${log.cumUf || ''}</td>
                    <td>${log.qb || ''}</td>
                    <td style="font-weight: bold; color: ${log.infusion === 'Yes' ? '#e74c3c' : 'inherit'}">${log.infusion}</td>
                `;
                const tdAction = document.createElement('td');
                const delBtn = createDeleteBtn(() => {
                    const fullIndex = periodicLogs.indexOf(log);
                    if (fullIndex > -1) periodicLogs.splice(fullIndex, 1);
                    renderPeriodicLogs();
                });
                tdAction.appendChild(delBtn);
                tr.appendChild(tdAction);
                periodicLogList.appendChild(tr);
            });
        }

        // Render Vitals Logs
        if (vitalsLogs.length === 0) {
            vitalsLogList.appendChild(emptyVitalsRow);
            emptyVitalsRow.style.display = 'table-row';
        } else {
            emptyVitalsRow.style.display = 'none';
            vitalsLogs.sort((a, b) => a.time.localeCompare(b.time)).forEach((log, index) => {
                const tr = document.createElement('tr');
                const sbp = parseFloat(log.sbp);
                const dbp = parseFloat(log.dbp);
                const map = (!isNaN(sbp) && !isNaN(dbp)) ? Math.round((sbp + 2 * dbp) / 3) : '';
                
                tr.innerHTML = `
                    <td style="${log._isAuto ? 'color: #95a5a6; font-style: italic;' : ''}">${log.time}${log._isAuto ? ' (A)' : ''}</td>
                    <td>${log.sbp ? (log.sbp + '/' + log.dbp) : ''}</td>
                    <td>${map}</td>
                    <td>${log.hr || ''}</td>
                `;
                const tdAction = document.createElement('td');
                const delBtn = createDeleteBtn(() => {
                    const fullIndex = periodicLogs.indexOf(log);
                    if (fullIndex > -1) periodicLogs.splice(fullIndex, 1);
                    renderPeriodicLogs();
                });
                tdAction.appendChild(delBtn);
                tr.appendChild(tdAction);
                vitalsLogList.appendChild(tr);
            });
        }
        
        periodicLogJsonInput.value = JSON.stringify(periodicLogs);
        updateDashboard();
    }

    function createDeleteBtn(onClick) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.style.color = 'red';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.fontSize = '1.2rem';
        delBtn.style.padding = '5px';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', onClick);
        return delBtn;
    }

    if (addLogBtn) {
        // Auto-calculate UFR/CumUF helper
        function suggestMachineValues() {
            const targetUf = parseFloat(document.querySelector('input[name="target_uf_volume"]').value);
            const durationStr = document.querySelector('input[name="planned_duration"]').value;
            const durationArr = (durationStr || "").match(/\d+/);
            const duration = durationArr ? parseFloat(durationArr[0]) : 4;
            
            if (!isNaN(targetUf) && duration > 0) {
                const ufr = Math.round(targetUf / duration);
                const logUfr = document.getElementById('log_ufr');
                const logCumUf = document.getElementById('log_cum_uf');
                
                if (logUfr && !logUfr.value) logUfr.value = ufr;
                
                // Estimate Cum UF based on time passed
                if (sessionStartTime) {
                    const hoursPassed = (new Date() - sessionStartTime) / (1000 * 60 * 60);
                    if (logCumUf && !logCumUf.value) logCumUf.value = Math.round(ufr * hoursPassed);
                }
            }
        }

        document.getElementById('log_time').addEventListener('focus', suggestMachineValues);

        addLogBtn.addEventListener('click', () => {
            const time = document.getElementById('log_time').value;
            const ufr = document.getElementById('log_ufr').value;
            const cumUf = document.getElementById('log_cum_uf').value;
            const qb = document.getElementById('log_qb').value;
            const infusion = document.getElementById('log_infusion').value;

            if (!time) {
                alert('Please specify the time for the log entry.');
                return;
            }

            periodicLogs.push({
                time,
                ufr: ufr || '',
                cumUf: cumUf || '',
                qb: qb || '',
                sbp: '',
                dbp: '',
                hr: '',
                infusion,
                _isMachine: true
            });

            // Reset inputs
            document.getElementById('log_time').value = '';
            document.getElementById('log_ufr').value = '';
            document.getElementById('log_cum_uf').value = '';
            document.getElementById('log_qb').value = '';
            document.getElementById('log_infusion').value = 'No';

            renderPeriodicLogs();
        });
    }

    // Quick Vitals Capture Logic
    const dynSbp = document.getElementById('dyn_sbp');
    const dynDbp = document.getElementById('dyn_dbp');
    const dynHr = document.getElementById('dyn_hr');
    const sbpDisplay = document.getElementById('sbp_val_display');
    const dbpDisplay = document.getElementById('dbp_val_display');
    const hrDisplay = document.getElementById('hr_val_display');
    const quickSaveVitalsBtn = document.getElementById('quickSaveVitalsBtn');

    if (dynSbp && dynDbp && dynHr && quickSaveVitalsBtn) {
        // Sync slider values to text
        dynSbp.addEventListener('input', (e) => sbpDisplay.textContent = e.target.value);
        dynDbp.addEventListener('input', (e) => dbpDisplay.textContent = e.target.value);
        dynHr.addEventListener('input', (e) => hrDisplay.textContent = e.target.value);

        quickSaveVitalsBtn.addEventListener('click', () => {
            // Generate current HH:MM:SS locally for exact timestamp
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const currentTime = `${h}:${m}:${s}`;

            periodicLogs.push({
                time: currentTime,
                ufr: '',
                cumUf: '',
                qb: '',
                sbp: dynSbp.value,
                dbp: dynDbp.value,
                hr: dynHr.value,
                infusion: 'No',
                _isVitals: true
            });

            renderPeriodicLogs();
        });
    }

    // --- Data Persistence: Patient Loading ---
    const patientSelector = document.getElementById('patientSelector');
    let savedPatientsMap = {};

    async function loadSavedPatients() {
        if (!patientSelector) return;
        
        try {
            // Fetch all patient sessions (ordered by latest)
            const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            
            savedPatientsMap = {};
            
            querySnapshot.forEach((doc) => {
                const rec = doc.data();
                if (rec.name && rec.name.trim() !== '') {
                    // Group by patient name to find the most recent record for each
                    if (!savedPatientsMap[rec.name] || new Date(rec.timestamp) > new Date(savedPatientsMap[rec.name].timestamp)) {
                        savedPatientsMap[rec.name] = rec;
                    }
                }
            });

            // Populate dropdown
            patientSelector.innerHTML = '<option value="">-- Create New Patient Profile --</option>';
            Object.keys(savedPatientsMap).sort().forEach(name => {
                const p = savedPatientsMap[name];
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = p.uhid ? `${name} (UHID: ${p.uhid})` : name;
                patientSelector.appendChild(opt);
            });
            console.log("Firebase: Patient records loaded.");
        } catch(e) { 
            console.error("Firebase fetch failed:", e);
            // Fallback to local storage if Firebase fails/not configured
            const records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
            records.forEach(rec => {
                if (rec.name && !savedPatientsMap[rec.name]) savedPatientsMap[rec.name] = rec;
            });
        }
    }

    if (patientSelector) {
        // Initial load
        loadSavedPatients();

        // Autocomplete on select
        patientSelector.addEventListener('change', (e) => {
            const selectedName = e.target.value;
            if (selectedName && savedPatientsMap[selectedName]) {
                const p = savedPatientsMap[selectedName];
                // Auto-fill baseline fields
                if (document.getElementById('uhid')) document.getElementById('uhid').value = p.uhid || '';
                if (document.getElementById('name')) document.getElementById('name').value = p.name || '';
                if (document.getElementById('age')) document.getElementById('age').value = p.age || '';
                if (document.querySelector('input[name="diagnosis"]')) document.querySelector('input[name="diagnosis"]').value = p.diagnosis || 'CKD5D';
                if (document.querySelector('select[name="diabetes"]')) document.querySelector('select[name="diabetes"]').value = p.diabetes || '';
                if (document.querySelector('select[name="dialysis_frequency"]')) document.querySelector('select[name="dialysis_frequency"]').value = p.dialysis_frequency || '';
                if (document.getElementById('tx_vintage')) document.getElementById('tx_vintage').value = p.tx_vintage || '';
                if (document.querySelector('select[name="type_of_access"]')) document.querySelector('select[name="type_of_access"]').value = p.type_of_access || '';
                if (document.querySelector('select[name="anticoagulation"]')) document.querySelector('select[name="anticoagulation"]').value = p.anticoagulation || 'Select...';
                
                // Persistent medical fields
                if (document.querySelector('input[name="baseline_creatinine"]')) document.querySelector('input[name="baseline_creatinine"]').value = p.baseline_creatinine || p.last_creatinine || '';
                if (document.querySelector('input[name="patient_dry_weight"]')) document.querySelector('input[name="patient_dry_weight"]').value = p.patient_dry_weight || '';
                
                // his current session post HD weight will be last post HD weight of subsequent HD session
                if (document.querySelector('input[name="last_post_dialysis_weight"]')) {
                    document.querySelector('input[name="last_post_dialysis_weight"]').value = p.post_hd_weight || p.last_post_dialysis_weight || '';
                }

                // Carry over previous session IDH outcome to the 'previous IDH' question
                if (p.idh_occurred || p.prev_idh) {
                    const prevIdhVal = p.idh_occurred === 'yes' ? 'Yes' : p.idh_occurred === 'no' ? 'No' : p.prev_idh;
                    if (prevIdhVal) {
                        const rb = document.querySelector(`input[name="prev_idh"][value="${prevIdhVal}"]`);
                        if (rb) rb.checked = true;
                    }
                }

                // Show notification
                showToast(`Loaded clinical baseline for: ${selectedName}`, "#3498db");
            } else {
                // Clear the auto-fill fields if 'new profile' is chosen
                form.reset();
                if (document.querySelector('input[name="diagnosis"]')) document.querySelector('input[name="diagnosis"]').value = 'CKD5D';
                const preIdhRbs = document.querySelectorAll(`input[name="prev_idh"]`);
                preIdhRbs.forEach(rb => rb.checked = false);
            }
        });
    }

    function showToast(message, color = "#27ae60") {
        const toast = document.createElement('div');
        toast.style = `position: fixed; bottom: 20px; right: 20px; background: ${color}; color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Form Reset
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data in this form?')) {
            form.reset();
            events = [];
            renderEvents();
            periodicLogs = [];
            renderPeriodicLogs();
            localStorage.removeItem('turbidex_active_session');
            sessionStartTime = null;
            updateDashboard();
        }
    });

    // Save Logic (Firebase + Local Backup)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Handle multi-selects (comorbidities, symptoms, etc.)
        data.comorbidities = Array.from(formData.getAll('comorbidities'));
        data.symptoms = Array.from(formData.getAll('symptoms'));
        data.interventions = Array.from(formData.getAll('interventions'));
        
        // Embed periodic logs and clinical events as clean arrays (Research Quality JSON)
        data.periodic_logs = periodicLogs;
        data.clinical_events = events;
        delete data.periodic_log_json; // Remove the redundant temporary UI strings
        delete data.event_log_json;
        
        data.timestamp = new Date().toISOString();

        console.log('Attempting Firebase Save:', data);
        
        try {
            if (!db) throw new Error("Firebase DB not initialized. Check your config.");

            // Save to Firebase Firestore
            const docRef = await addDoc(collection(db, "sessions"), data);
            console.log("Firebase: Document written with ID: ", docRef.id);
            
            showToast('✅ Session saved to cloud successfully!');
            alert('Cloud Save Successful! Document ID: ' + docRef.id);
        } catch (error) {
            console.error("Firebase Save Error Detail:", error);
            // Fallback to LocalStorage
            let records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
            records.push(data);
            localStorage.setItem('turbidex_records', JSON.stringify(records));
            showToast('❌ Cloud save failed. Saved locally.', "#e74c3c");
            alert('Cloud save failed. This usually happens due to Firebase connectivity issues or permission rules. Data has been backed up to your browser local storage.');
        }
        
        // Clear active session once finalized
        localStorage.removeItem('turbidex_active_session');
        sessionStartTime = null;

        // Refresh dropdown
        loadSavedPatients();
    });

    // Proper CSV escaping function (RFC 4180)
    function escapeCSV(val) {
        if (val === null || val === undefined || val === '') return '""';
        
        let stringVal = '';
        if (typeof val === 'object' && !Array.isArray(val)) {
            stringVal = JSON.stringify(val);
        } else {
            stringVal = String(val);
        }

        return `"${stringVal.replace(/"/g, '""')}"`;
    }

    // Master list of all possible clinical fields for consistent CSV formatting
    const ALL_CLINICAL_FIELDS = [
        'timestamp', 'date', 'start_time', 'treating_physician', 'session_modality', 'planned_duration',
        'uhid', 'name', 'age', 'sex', 'diagnosis', 'diabetes', 'dialysis_frequency', 'tx_vintage', 'type_of_access', 'anticoagulation',
        'last_blood_transfusion_date', 'last_blood_transfusion_amount', 'comorbidities',
        'dialysate_temp', 'dialysate_na', 'pre_hd_bp_meds', 'target_uf_volume', 'start_sbp', 'start_dbp', 'pulse_rate', 
        'ejection_fraction', 'predialysis_weight', 'patient_dry_weight', 'last_post_dialysis_weight', 'post_hd_weight',
        'last_creatinine', 'baseline_creatinine', 'albumin', 'hematocrit', 'hemoglobin',
        'planned_transfusion', 'planned_prbc', 'planned_transfusion_start', 'planned_transfusion_end', 'planned_transfusion_rate',
        'idh_occurred', 'prev_idh', 'periodic_logs', 'clinical_events'
    ];

    function formatComplexData(key, val) {
        if (!val) return "";
        
        let processedVal = val;
        // Backward compatibility: If it's a string that looks like a JSON array, parse it
        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
            try { processedVal = JSON.parse(val); } catch(e) { processedVal = val; }
        }

        // Handle nested clinical logs/events
        if ((key === 'periodic_logs' || key === 'clinical_events') && Array.isArray(processedVal)) {
            const isPeriodic = key === 'periodic_logs';
            const fieldOrder = isPeriodic
                ? ['time', 'sbp', 'dbp', 'hr', 'ufr', 'qb', 'cumUf', 'infusion']
                : ['time', 'type', 'details'];
            
            const labels = {
                time: "Time", sbp: "SBP", dbp: "DBP", hr: "HR", 
                ufr: "UFR", qb: "Qb", cumUf: "CumUF", infusion: "Infusion",
                type: "Event", details: "Details"
            };

            return processedVal.map(item => {
                return fieldOrder
                    .filter(f => item[f] !== undefined && item[f] !== null && String(item[f]).trim() !== '')
                    .map(f => `${labels[f] || f}: ${item[f]}`)
                    .join(' | ');
            }).join(' || ');
        }
        
        // Handle standard arrays like comorbidities/symptoms (native arrays)
        if (Array.isArray(processedVal)) {
            return processedVal.join(' | ');
        }
        
        return processedVal;
    }

    // Export to CSV
    exportBtn.addEventListener('click', async () => {
        let records = [];
        try {
            const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => records.push(doc.data()));
        } catch (e) {
            console.warn("Cloud export failed, trying local storage:", e);
            records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
        }

        if (records.length === 0) {
            alert('No records found to export.');
            return;
        }

        // Use the master list for headers
        const headers = ALL_CLINICAL_FIELDS;

        const csvRows = [];
        // Add header row
        csvRows.push(headers.map(h => escapeCSV(h)).join(','));

        // Add data rows
        records.forEach(row => {
            const values = headers.map(header => {
                let val = row[header];
                val = formatComplexData(header, val);
                return escapeCSV(val);
            });
            csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `turbidex_research_all_data_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Export to JSON
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', async () => {
            let records = [];
            try {
                const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach(doc => records.push(doc.data()));
            } catch (e) {
                console.warn("Cloud export failed, trying local storage:", e);
                records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
            }

            if (records.length === 0) {
                alert('No records found to export.');
                return;
            }

            const jsonContent = JSON.stringify(records, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `turbidex_research_data_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // --- CLOUD DASHBOARD LOGIC ---
    const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
    const dashboardSessionList = document.getElementById('dashboardSessionList');
    const dashSearchInput = document.getElementById('dashSearchInput');
    const dashIdhFilter = document.getElementById('dashIdhFilter');
    const dashSortOrder = document.getElementById('dashSortOrder');
    const sessionModal = document.getElementById('sessionModal');
    const sessionModalContent = document.getElementById('sessionModalContent');
    const closeModalBtn = document.getElementById('closeModalBtn');

    let allCloudSessions = [];

    async function fetchDashboardSessions() {
        if (!dashboardSessionList) return;
        
        dashboardSessionList.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading sessions from cloud...</td></tr>';
        
        try {
            const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            
            allCloudSessions = [];
            querySnapshot.forEach((doc) => {
                allCloudSessions.push({ id: doc.id, ...doc.data() });
            });

            renderDashboardTable();
        } catch (e) {
            console.error("Dashboard fetch failed:", e);
            dashboardSessionList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #e74c3c; padding: 2rem;">Error fetching cloud data: ${e.message}</td></tr>`;
        }
    }

    function renderDashboardTable() {
        if (!dashboardSessionList) return;

        const searchTerm = dashSearchInput.value.toLowerCase();
        const idhFilter = dashIdhFilter.value;
        const sortOrder = dashSortOrder.value;

        let filtered = allCloudSessions.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm) || (s.uhid || '').toLowerCase().includes(searchTerm);
            const matchesIdh = idhFilter === 'all' || s.idh_occurred === idhFilter;
            return matchesSearch && matchesIdh;
        });

        // Sort
        filtered.sort((a, b) => {
            const timeA = new Date(a.timestamp);
            const timeB = new Date(b.timestamp);
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        if (filtered.length === 0) {
            dashboardSessionList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; font-style: italic; padding: 2rem;">No matching sessions found.</td></tr>';
            return;
        }

        dashboardSessionList.innerHTML = '';
        filtered.forEach(session => {
            const tr = document.createElement('tr');
            const dateStr = session.date || (session.timestamp ? session.timestamp.split('T')[0] : 'N/A');
            const periodicCount = (session.periodic_logs || []).length;
            const eventCount = (session.clinical_events || []).length;

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td style="font-weight: bold;">${session.name || 'Anonymous'}</td>
                <td>${session.uhid || 'N/A'}</td>
                <td>
                    <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; background: ${session.idh_occurred === 'yes' ? '#fed7d7' : '#f0fff4'}; color: ${session.idh_occurred === 'yes' ? '#c53030' : '#2f855a'};">
                        ${session.idh_occurred === 'yes' ? 'YES' : 'NO'}
                    </span>
                </td>
                <td>${periodicCount} Logs / ${eventCount} Events</td>
                <td>
                    <button type="button" class="btn-primary view-session-btn" data-id="${session.id}" style="padding: 4px 12px; font-size: 0.8rem; background-color: #3498db;">View Details</button>
                </td>
            `;

            const viewBtn = tr.querySelector('.view-session-btn');
            viewBtn.addEventListener('click', () => showSessionDetails(session));

            dashboardSessionList.appendChild(tr);
        });
    }

    function showSessionDetails(session) {
        if (!sessionModal || !sessionModalContent) return;

        let logsHtml = '';
        if (session.periodic_logs && session.periodic_logs.length > 0) {
            logsHtml = `
                <h4 style="margin-top: 2rem; color: #34495e;">Periodic Vitals & Machine Logs</h4>
                <table class="data-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr><th>Time</th><th>SBP/DBP</th><th>HR</th><th>UFR</th><th>Infusion</th></tr>
                    </thead>
                    <tbody>
                        ${session.periodic_logs.map(l => `
                            <tr>
                                <td>${l.time}</td>
                                <td>${l.sbp}/${l.dbp}</td>
                                <td>${l.hr}</td>
                                <td>${l.ufr}</td>
                                <td>${l.infusion}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        let eventsHtml = '';
        if (session.clinical_events && session.clinical_events.length > 0) {
            eventsHtml = `
                <h4 style="margin-top: 2rem; color: #34495e;">Clinical Events</h4>
                <table class="data-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr><th>Time</th><th>Event</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                        ${session.clinical_events.map(e => `
                            <tr>
                                <td>${e.time}</td>
                                <td>${e.type}</td>
                                <td>${e.details}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        sessionModalContent.innerHTML = `
            <h2 style="color: var(--primary-color); border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-top: 0;">Session Details: ${session.name || 'Anonymous'}</h2>
            <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem;">
                <div><strong>Date:</strong> ${session.date || 'N/A'}</div>
                <div><strong>UHID:</strong> ${session.uhid || 'N/A'}</div>
                <div><strong>Age:</strong> ${session.age || 'N/A'}</div>
                <div><strong>Diagnosis:</strong> ${session.diagnosis || 'N/A'}</div>
                <div><strong>Diabetes:</strong> ${session.diabetes || 'N/A'}</div>
                <div><strong>Anticoagulation:</strong> ${session.anticoagulation || 'N/A'}</div>
                <div><strong>Pre-HD Weight:</strong> ${session.pre_weight || 'N/A'} kg</div>
                <div><strong>Dry Weight:</strong> ${session.dry_weight || 'N/A'} kg</div>
                <div><strong>IDH Occurred:</strong> <span style="font-weight: bold; color: ${session.idh_occurred === 'yes' ? '#e74c3c' : '#27ae60'}">${session.idh_occurred?.toUpperCase() || 'N/A'}</span></div>
            </div>
            ${logsHtml}
            ${eventsHtml}
            <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                <button type="button" class="btn-export" id="downloadSingleCsv" style="background-color: var(--primary-color);">Download Session (CSV)</button>
                <button type="button" class="btn-export" id="downloadSingleJson" style="background-color: #8e44ad;">Download Session (JSON)</button>
                <button type="button" class="btn-primary" id="deleteSessionBtn" style="background-color: #e74c3c;">Delete Session</button>
                <button type="button" class="btn-primary" onclick="this.closest('#sessionModal').style.display = 'none'" style="background-color: #95a5a6;">Close Archive View</button>
            </div>
        `;

        // Handle Session Deletion
        document.getElementById('deleteSessionBtn').addEventListener('click', async () => {
            if (confirm(`⚠️ PERMANENT ACTION: Are you sure you want to delete the session for ${session.name || 'this patient'} from the cloud? This cannot be undone.`)) {
                try {
                    await deleteDoc(doc(db, "sessions", session.id));
                    showToast('Session deleted successfully', "#e74c3c");
                    sessionModal.style.display = 'none';
                    // Refresh the dashboard list
                    fetchDashboardSessions();
                    // Also refresh patient selector
                    loadSavedPatients();
                } catch (e) {
                    console.error("Delete failed:", e);
                    alert("Failed to delete session: " + e.message);
                }
            }
        });

        // Handle Single Session CSV Export
        document.getElementById('downloadSingleCsv').addEventListener('click', () => {
            const headers = ALL_CLINICAL_FIELDS;
            const values = headers.map(header => {
                let val = session[header];
                val = formatComplexData(header, val);
                return escapeCSV(val);
            }).join(',');

            const csvContent = headers.map(h => escapeCSV(h)).join(',') + '\n' + values;
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const fileName = `session_${(session.name || 'anon').replace(/\s+/g, '_')}_${session.date || 'no_date'}.csv`;
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', fileName);
            link.click();
        });

        // Handle Single Session JSON Export
        document.getElementById('downloadSingleJson').addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
            const downloadAnchorNode = document.createElement('a');
            const fileName = `session_${(session.name || 'anon').replace(/\s+/g, '_')}_${session.date || 'no_date'}.json`;
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", fileName);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        sessionModal.style.display = 'block';
    }

    if (refreshDashboardBtn) refreshDashboardBtn.addEventListener('click', fetchDashboardSessions);
    if (dashSearchInput) dashSearchInput.addEventListener('input', renderDashboardTable);
    if (dashIdhFilter) dashIdhFilter.addEventListener('change', renderDashboardTable);
    if (dashSortOrder) dashSortOrder.addEventListener('change', renderDashboardTable);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => sessionModal.style.display = 'none');

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === sessionModal) sessionModal.style.display = 'none';
    });

    // Fetch dashboard stats when the tab is clicked
    const dashboardTabBtn = document.querySelector('.tab-btn[data-tab="dashboard"]');
    if (dashboardTabBtn) {
        dashboardTabBtn.addEventListener('click', fetchDashboardSessions);
    }
});
