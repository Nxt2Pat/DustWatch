document.addEventListener('DOMContentLoaded', () => {
    
    // --- Navigation Active Highlight on Scroll ---
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 120)) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // --- Tab Switcher for Architecture Section ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Toggle active buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.getAttribute('id') === targetTab) {
                    panel.classList.add('active');
                }
            });
        });
    });

    // --- AQI Simulator Logic ---
    const pmSlider = document.getElementById('pm25-slider');
    const simPmVal = document.getElementById('sim-pm-val');
    const simAqiVal = document.getElementById('sim-aqi-val');
    const simBgPanel = document.getElementById('sim-bg-panel');
    const simStatusBadge = document.getElementById('sim-status-badge');
    const simGuideText = document.getElementById('sim-guide-text');
    const lineAlertMsg = document.getElementById('line-alert-msg');
    const lineTime = document.getElementById('line-time');

    // Set LINE timestamp to current time on load
    const updateLineTime = () => {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        lineTime.textContent = `${hours}:${minutes} ${ampm}`;
    };
    updateLineTime();

    // Map dots rotation in hero preview to show interactivity
    const heroNodes = document.querySelectorAll('.node-pulse');
    heroNodes.forEach(node => {
        node.addEventListener('click', () => {
            const nodeName = node.getAttribute('data-node');
            const classList = node.className;
            let val = 12;
            if (classList.includes('yellow')) val = 22;
            if (classList.includes('orange')) val = 32;
            if (classList.includes('red')) val = 55;
            
            pmSlider.value = val;
            updateSimulator(val, nodeName);
            
            // Scroll to simulator
            document.getElementById('simulator').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // PM2.5 to AQI calculation and UI updater
    function updateSimulator(pm25, sourceNode = "สนามฟุตบอล") {
        simPmVal.textContent = pm25;
        
        let aqi = 0;
        let colorClass = 'green';
        let bgStyle = '';
        let borderStyle = '';
        let badgeColor = '';
        let badgeText = '';
        let guideText = '';
        let lineText = '';

        // Thailand standard AQI calculation (approximate mapping)
        if (pm25 <= 15) {
            // Excellent (Green)
            aqi = Math.round(pm25 * (25 / 15));
            colorClass = 'green';
            bgStyle = 'rgba(16, 185, 129, 0.1)';
            borderStyle = '1px solid rgba(16, 185, 129, 0.2)';
            badgeColor = 'var(--aqi-green)';
            badgeText = 'คุณภาพอากาศดีมาก (Very Good)';
            guideText = 'คุณภาพอากาศดีมาก ปลอดภัยสำหรับการทำกิจกรรมกลางแจ้งทุกประเภท นักเรียนสามารถออกกำลังกายและเล่นกีฬากลางแจ้งได้อย่างสบายใจ';
            lineText = `แจ้งเตือนสถานะ: ปกติ\n📍 พิกัด: ${sourceNode}\nระดับฝุ่น PM2.5: ${pm25} µg/m³\nคุณภาพอากาศดีมาก ไม่มีมลพิษสะสม`;
        } else if (pm25 <= 25) {
            // Satisfactory (Yellow)
            aqi = Math.round(25 + (pm25 - 15) * (25 / 10));
            colorClass = 'yellow';
            bgStyle = 'rgba(234, 179, 8, 0.1)';
            borderStyle = '1px solid rgba(234, 179, 8, 0.2)';
            badgeColor = 'var(--aqi-yellow)';
            badgeText = 'คุณภาพอากาศดี (Good)';
            guideText = 'คุณภาพอากาศดีทั่วไป นักเรียนสามารถทำกิจกรรมกลางแจ้งได้ตามปกติ สำหรับนักเรียนกลุ่มที่ไวต่อมลพิษควรสังเกตอาการระคายเคืองในเบื้องต้น';
            lineText = `แจ้งเตือนสถานะ: ปกติตามเกณฑ์\n📍 พิกัด: ${sourceNode}\nระดับฝุ่น PM2.5: ${pm25} µg/m³\nคุณภาพอากาศโดยรวมอยู่ในระดับปานกลาง ปลอดภัยทั่วไป`;
        } else if (pm25 <= 37.5) {
            // Moderate (Orange)
            aqi = Math.round(50 + (pm25 - 25) * (50 / 12.5));
            colorClass = 'orange';
            bgStyle = 'rgba(249, 115, 22, 0.1)';
            borderStyle = '1px solid rgba(249, 115, 22, 0.2)';
            badgeColor = 'var(--aqi-orange)';
            badgeText = 'ปานกลาง / เริ่มมีผลต่อกลุ่มเสี่ยง';
            guideText = 'คุณภาพอากาศระดับปานกลาง นักเรียนกลุ่มเสี่ยง (โรคภูมิแพ้ หอบหืด โรคทางเดินหายใจ) ควรลดระยะเวลาทำกิจกรรมกลางแจ้ง หรือสวมหน้ากากป้องกัน';
            lineText = `แจ้งเตือนเฝ้าระวัง: เริ่มมีผลกระทบ\n📍 พิกัด: ${sourceNode}\nระดับฝุ่น PM2.5: ${pm25} µg/m³\nนักเรียนกลุ่มเสี่ยงควรเตรียมหน้ากากอนามัยเมื่อออกนอกอาคาร`;
        } else {
            // Unhealthy (Red)
            aqi = Math.round(100 + (pm25 - 37.5) * (100 / 112.5));
            colorClass = 'red';
            bgStyle = 'rgba(239, 68, 68, 0.15)';
            borderStyle = '1px solid rgba(239, 68, 68, 0.3)';
            badgeColor = 'var(--aqi-red)';
            badgeText = 'มีผลกระทบต่อสุขภาพ (Unhealthy)';
            guideText = '⚠️ คุณภาพอากาศมีผลกระทบต่อสุขภาพ! โรงเรียนควรย้ายการจัดกิจกรรม เช่น คาบพละ การเข้าแถวหน้าเสาธง เข้ามาในตัวอาคาร ปิดประตูหน้าต่าง และเปิดเครื่องฟอกอากาศ';
            lineText = `⚠️ แจ้งเตือนด่วน: ฝุ่นเกินเกณฑ์มาตรฐาน!\n📍 พิกัด: ${sourceNode}\nระดับฝุ่น PM2.5: ${pm25} µg/m³ (สูงกว่าเกณฑ์วิกฤต 37.5)\n📢 คำแนะนำ: งดกิจกรรมกลางแจ้งทั้งหมดทันที! ย้ายนักเรียนเข้าห้องเรียนสะอาด และสวมใส่หน้ากากอนามัย N95`;
        }

        // Apply styles and content
        simAqiVal.textContent = aqi;
        simBgPanel.style.background = bgStyle;
        simBgPanel.style.border = borderStyle;
        
        simStatusBadge.style.background = badgeColor;
        simStatusBadge.style.color = '#000';
        simStatusBadge.textContent = badgeText;
        
        simGuideText.textContent = guideText;
        lineAlertMsg.textContent = lineText;
        
        // Dynamic thumb glow color based on AQI color
        pmSlider.style.setProperty('--slider-thumb-shadow', `0 0 15px ${badgeColor}`);
        updateLineTime();
    }

    // Slider Event Listener
    pmSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        updateSimulator(val);
    });

    // Initialize simulator with default value 28
    updateSimulator(28);
});
