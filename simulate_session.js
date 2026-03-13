
(async () => {
    console.log("🚀 Starting Simulated Dialysis Session...");

    // 1. Setup Session (Tab 1)
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
    
    document.querySelector('input[name="start_time"]').value = "08:00";
    document.querySelector('select[name="session_modality"]').value = "HDF";
    document.querySelector('input[name="planned_duration"]').value = "4 Hrs";

    // 2. Patient Info (Tab 2)
    document.querySelector('input[name="uhid"]').value = "SIM-999-TEST";
    document.querySelector('input[name="name"]').value = "Simulated Patient";
    document.querySelector('input[name="age"]').value = "62";
    document.querySelector('select[name="sex"]').value = "Male";
    document.querySelector('input[name="diagnosis"]').value = "CKD 5D (Simulation)";
    document.querySelector('select[name="diabetes"]').value = "Yes";
    document.querySelector('select[name="dialysis_frequency"]').value = "3/week";
    document.querySelector('select[name="type_of_access"]').value = "BC AVF";
    
    // Check some comorbidities
    document.querySelectorAll('input[name="comorbidities"]').forEach(cb => {
        if (cb.value === "HTN" || cb.value === "T2DM") cb.checked = true;
    });

    // 3. Pre-HD & Labs (Tab 3)
    document.querySelector('input[name="target_uf_volume"]').value = "3000"; // mL
    document.querySelector('input[name="start_sbp"]').value = "140";
    document.querySelector('input[name="start_dbp"]').value = "85";
    document.querySelector('input[name="pulse_rate"]').value = "72";
    document.querySelector('input[name="predialysis_weight"]').value = "72.5";
    document.querySelector('input[name="patient_dry_weight"]').value = "70.0";
    document.querySelector('input[name="albumin"]').value = "3.2";
    document.querySelector('input[name="hematocrit"]').value = "31";

    // 4. Intradialytic Events & Logs (Tab 4)
    // Add some Machine Logs
    const logTime = document.getElementById('log_time');
    const logUfr = document.getElementById('log_ufr');
    const logCumUf = document.getElementById('log_cum_uf');
    const logQb = document.getElementById('log_qb');
    const addLogBtn = document.getElementById('addLogBtn');

    const logs = [
        { t: "08:30", ufr: "750", cum: "375", qb: "250" },
        { t: "09:30", ufr: "750", cum: "1125", qb: "250" },
        { t: "10:30", ufr: "500", cum: "1875", qb: "200" }
    ];

    logs.forEach(l => {
        logTime.value = l.t;
        logUfr.value = l.ufr;
        logCumUf.value = l.cum;
        logQb.value = l.qb;
        addLogBtn.click();
    });

    // Add some Clinical Events
    const quickVitalsBtn = document.getElementById('quickSaveVitalsBtn');
    const sbpSlider = document.getElementById('dyn_sbp');
    
    // Simulate a drop in BP at 10:15
    sbpSlider.value = 95;
    sbpSlider.dispatchEvent(new Event('input'));
    quickVitalsBtn.click(); // This uses current local time

    // Simulate an intervention button click (Saline Bolus)
    const salineBtn = document.querySelector('button[data-event="Saline Bolus"]');
    if (salineBtn) salineBtn.click();

    // 5. Finalize Outcome
    document.querySelector('input[name="idh_occurred"][value="yes"]').checked = true;

    // 6. Save and Trigger JSON Export
    const saveBtn = document.getElementById('saveLogBtn');
    saveBtn.click();

    console.log("✅ Simulation Complete. Patient saved to LocalStorage.");
    
    // Briefly wait and then trigger the JSON download
    setTimeout(() => {
        const jsonBtn = document.getElementById('exportJsonBtn');
        if (jsonBtn) {
            console.log("📥 Triggering JSON Download...");
            jsonBtn.click();
        }
    }, 1000);

})();
