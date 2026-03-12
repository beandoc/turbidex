document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const form = document.getElementById('patientForm');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    // Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
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

        events.push({
            time: time,
            type: type || 'Other',
            details: details
        });

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
            
            events.push({
                time: currentTime,
                type: eventType,
                details: 'Quick Logged'
            });
            
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
    const periodicLogJsonInput = document.getElementById('periodic_log_json');

    function renderPeriodicLogs() {
        periodicLogList.innerHTML = '';
        if (periodicLogs.length === 0) {
            periodicLogList.appendChild(emptyPeriodicRow);
            emptyPeriodicRow.style.display = 'table-row';
            periodicLogJsonInput.value = '[]';
            return;
        }

        emptyPeriodicRow.style.display = 'none';
        periodicLogs.sort((a, b) => a.time.localeCompare(b.time));

        periodicLogs.forEach((log, index) => {
            const tr = document.createElement('tr');
            
            // Calculate MAP
            const sbp = parseFloat(log.sbp);
            const dbp = parseFloat(log.dbp);
            const map = (!isNaN(sbp) && !isNaN(dbp)) ? Math.round((sbp + 2 * dbp) / 3) : '-';

            tr.innerHTML = `
                <td>${log.time}</td>
                <td>${log.ufr}</td>
                <td>${log.cumUf}</td>
                <td>${log.qb}</td>
                <td>${log.sbp ? log.sbp + '/' + log.dbp : '-'}</td>
                <td>${map}</td>
                <td>${log.hr}</td>
                <td style="font-weight: bold; color: ${log.infusion === 'Yes' ? '#e74c3c' : 'inherit'}">${log.infusion}</td>
            `;

            const tdAction = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.style.color = 'red';
            delBtn.style.background = 'none';
            delBtn.style.border = 'none';
            delBtn.style.fontSize = '1.2rem';
            delBtn.style.padding = '5px';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Remove Log';
            delBtn.addEventListener('click', () => {
                periodicLogs.splice(index, 1);
                renderPeriodicLogs();
            });
            tdAction.appendChild(delBtn);
            tr.appendChild(tdAction);

            periodicLogList.appendChild(tr);
        });
        
        periodicLogJsonInput.value = JSON.stringify(periodicLogs);
    }

    if (addLogBtn) {
        addLogBtn.addEventListener('click', () => {
            const time = document.getElementById('log_time').value;
            if (!time) {
                alert('Please specify the time for this log entry.');
                return;
            }

            periodicLogs.push({
                time: time,
                ufr: document.getElementById('log_ufr').value,
                cumUf: document.getElementById('log_cum_uf').value,
                qb: document.getElementById('log_qb').value,
                sbp: document.getElementById('log_sbp').value,
                dbp: document.getElementById('log_dbp').value,
                hr: document.getElementById('log_hr').value,
                infusion: document.getElementById('log_infusion').value
            });

            // Reset inputs
            document.getElementById('log_time').value = '';
            document.getElementById('log_ufr').value = '';
            document.getElementById('log_cum_uf').value = '';
            document.getElementById('log_qb').value = '';
            document.getElementById('log_sbp').value = '';
            document.getElementById('log_dbp').value = '';
            document.getElementById('log_hr').value = '';
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
                ufr: '-',
                cumUf: '-',
                qb: '-',
                sbp: dynSbp.value,
                dbp: dynDbp.value,
                hr: dynHr.value,
                infusion: 'No'
            });

            renderPeriodicLogs();
        });
    }

    // --- Data Persistence: Patient Loading ---
    const patientSelector = document.getElementById('patientSelector');
    let savedPatientsMap = {};

    function loadSavedPatients() {
        if (!patientSelector) return;
        
        let records = [];
        try {
            records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
        } catch(e) { /* ignore invalid json */ }
        
        savedPatientsMap = {};
        
        // Group by patient name to find the most recent record for each
        records.forEach(rec => {
            if (rec.name && rec.name.trim() !== '') {
                // If it's a newer record, overwrite
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
                if (document.querySelector('input[name="diagnosis"]')) document.querySelector('input[name="diagnosis"]').value = p.diagnosis || '';
                if (document.querySelector('select[name="diabetes"]')) document.querySelector('select[name="diabetes"]').value = p.diabetes || '';
                if (document.querySelector('input[name="dialysis_frequency"]')) document.querySelector('input[name="dialysis_frequency"]').value = p.dialysis_frequency || '';
                if (document.querySelector('input[name="tx_vintage"]')) document.querySelector('input[name="tx_vintage"]').value = p.tx_vintage || '';
                if (document.querySelector('input[name="type_of_access"]')) document.querySelector('input[name="type_of_access"]').value = p.type_of_access || '';
                
                // Carry over previous session IDH outcome to the 'previous IDH' question
                if (p.idh_occurred || p.prev_idh) {
                    const prevIdhVal = p.idh_occurred === 'yes' ? 'Yes' : p.idh_occurred === 'no' ? 'No' : p.prev_idh;
                    if (prevIdhVal) {
                        const rb = document.querySelector(`input[name="prev_idh"][value="${prevIdhVal}"]`);
                        if (rb) rb.checked = true;
                    }
                }

                // Alert to inform user
                alert(`Loaded baseline demographics for: ${selectedName}`);
            } else {
                // Clear the auto-fill fields if 'new profile' is chosen
                if (document.getElementById('uhid')) document.getElementById('uhid').value = '';
                if (document.getElementById('name')) document.getElementById('name').value = '';
                if (document.getElementById('age')) document.getElementById('age').value = '';
                if (document.querySelector('input[name="diagnosis"]')) document.querySelector('input[name="diagnosis"]').value = '';
                if (document.querySelector('select[name="diabetes"]')) document.querySelector('select[name="diabetes"]').value = '';
                
                // Clear radio buttons
                const preIdhRbs = document.querySelectorAll(`input[name="prev_idh"]`);
                preIdhRbs.forEach(rb => rb.checked = false);
            }
        });
    }

    // Form Reset
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data in this form?')) {
            form.reset();
            events = [];
            renderEvents();
            periodicLogs = [];
            renderPeriodicLogs();
        }
    });

    // Save Logic (Mock)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Handle multi-selects (comorbidities, symptoms, etc.)
        data.comorbidities = Array.from(formData.getAll('comorbidities'));
        data.symptoms = Array.from(formData.getAll('symptoms'));
        data.interventions = Array.from(formData.getAll('interventions'));

        console.log('Record Saved:', data);
        
        // Save to LocalStorage for persistence during research
        let records = [];
        try {
            records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
        } catch(e) { /* ignore invalid json */ }
        
        records.push({
            ...data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('turbidex_records', JSON.stringify(records));

        // Refresh dropdown
        loadSavedPatients();

        alert('Patient record saved successfully. You can now load this profile in future sessions.');
    });

    // Export to CSV
    exportBtn.addEventListener('click', () => {
        const records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
        if (records.length === 0) {
            alert('No records found to export.');
            return;
        }

        const headers = Object.keys(records[0]);
        const csvContent = [
            headers.join(','),
            ...records.map(row => headers.map(fieldName => {
                const val = row[fieldName];
                return JSON.stringify(Array.isArray(val) ? val.join(';') : val);
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `turbidex_research_data_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Export to JSON
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            const records = JSON.parse(localStorage.getItem('turbidex_records') || '[]');
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
});
