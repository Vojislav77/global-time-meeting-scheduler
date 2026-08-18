const DEFAULT_VISIBLE = ["New York", "London", "Tokyo", "Sydney", "Dubai", "São Paulo", "Lagos"];
const pad = n => String(n).padStart(2, '0');
const fmtCal = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

let activeTabId = null;
let notesTabs = JSON.parse(localStorage.getItem('notesTabs')) || [{id: 'default', title: 'General', content: ''}];
let saveTimeout;
let timeFormat = localStorage.getItem('timeFormat') || '12';

function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script, iframe, object, embed, form, input, link').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        for (let i = el.attributes.length - 1; i >= 0; i--) {
            const attr = el.attributes[i].name.toLowerCase();
            if (attr.startsWith('on') || attr === 'href' && el.attributes[i].value.trim().toLowerCase().startsWith('javascript')) {
                el.removeAttribute(el.attributes[i].name);
            }
        }
    });
    return div.innerHTML;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function generateQRSVG(text) {
    const len = text.length;
    const size = len > 100 ? 29 : len > 50 ? 25 : 21;
    const data = [];
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            const edge = i === 0 || i === size-1 || j === 0 || j === size-1;
            const inFinder = (i < 7 && j < 7) || (i < 7 && j >= size-7) || (i >= size-7 && j < 7);
            const isWhite = inFinder && ((i%7===1||i%7===5) && j%7>=1 && j%7<=5) || (inFinder && (j%7===1||j%7===5) && i%7>=1 && i%7<=5);
            const inInner = inFinder && i>=1 && i<=5 && j>=1 && j<=5 && !((i===1||i===5)&&(j===1||j===5));
            if (inInner) row.push(1);
            else if (isWhite) row.push(0);
            else if (inFinder) row.push(1);
            else if (edge) row.push(i%2===0?1:0);
            else {
                const hash = ((i * 31 + j * 17 + len) * 2654435761) >>> 0;
                row.push(hash % 3 === 0 ? 1 : 0);
            }
        }
        data.push(row);
    }
    const cellSize = 4;
    const svgSize = size * cellSize + 8;
    let paths = '';
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (data[r][c]) {
                paths += `<rect x="${c*cellSize+4}" y="${r*cellSize+4}" width="${cellSize}" height="${cellSize}"/>`;
            }
        }
    }
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}"><rect width="${svgSize}" height="${svgSize}" fill="white"/><g fill="black">${paths}</g></svg>`)}`;
}

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleCities');
    const citySelector = document.getElementById('citySelector');
    const grid = document.getElementById('clockGrid');
    const checkboxGrid = document.getElementById('checkboxGrid');
    const searchCheckboxes = document.getElementById('searchCheckboxes');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selectionCount = document.getElementById('selectionCount');
    const cityA = document.getElementById('cityA');
    const cityB = document.getElementById('cityB');
    const durationSelect = document.getElementById('meetingDuration');
    const recurrenceSelect = document.getElementById('recurrence');
    const calcBtn = document.getElementById('calcBtn');
    const resultBox = document.getElementById('resultBox');
    const resultTitle = document.getElementById('resultTitle');
    const resultDesc = document.getElementById('resultDesc');
    const timeline = document.getElementById('timeline');
    const calendarLinks = document.getElementById('calendarLinks');
    const themeToggle = document.getElementById('themeToggle');
    const shareBtn = document.getElementById('shareBtn');
    const notesArea = document.getElementById('notesArea');
    const saveStatus = document.getElementById('saveStatus');
    const tabsHeader = document.getElementById('tabsHeader');
    const qrModal = document.getElementById('qrModal');
    const qrImage = document.getElementById('qrImage');
    const qrStatus = document.getElementById('qrStatus');
    const timeFormatToggle = document.getElementById('timeFormatToggle');
    const supportBtn = document.getElementById('supportBtn');
    const supportModal = document.getElementById('supportModal');
    const schedulerSubtitle = document.getElementById('schedulerSubtitle');
    const timelineLabels = document.getElementById('timelineLabels');

    cities.forEach((city, i) => {
        const isChecked = DEFAULT_VISIBLE.includes(city.name);
        const cb = document.createElement('div');
        cb.className = 'checkbox-item';
        cb.dataset.name = city.name.toLowerCase();
        cb.innerHTML = `<input type="checkbox" id="cb-${city.name}" data-city="${city.name}" ${isChecked ? 'checked' : ''} aria-label="Show ${city.name} clock"><label for="cb-${city.name}">${city.name}</label>`;
        checkboxGrid.appendChild(cb);

        const card = document.createElement('div');
        card.className = `clock-card ${isChecked ? '' : 'hidden'}`;
        card.dataset.name = city.name.toLowerCase();
        card.setAttribute('role', 'status');
        card.setAttribute('aria-label', `${city.name} time`);
        card.innerHTML = `<div class="clock-city">${city.name}</div><div class="clock-time" id="time-${i}" aria-live="polite">--:--:--</div><div class="clock-date" id="date-${i}">Loading...</div><div class="clock-tz" id="tz-${i}">---</div>`;
        grid.appendChild(card);

        cb.querySelector('input').addEventListener('change', e => {
            const cardRef = grid.querySelector(`.clock-card[data-name="${e.target.dataset.city.toLowerCase()}"]`);
            if (cardRef) cardRef.classList.toggle('hidden', !e.target.checked);
            updateCount();
        });
        cityA.add(new Option(city.name, city.name));
        cityB.add(new Option(city.name, city.name));
    });

    const stored = localStorage.getItem('notesTabs');
    if (!stored) {
        notesTabs = [{id: 'default', title: 'General', content: ''}];
        localStorage.setItem('notesTabs', JSON.stringify(notesTabs));
    } else {
        notesTabs = JSON.parse(stored);
    }
    if (notesTabs.length === 0) addTab();
    renderTabs();

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', savedTheme === 'dark');
    themeToggle.textContent = savedTheme === 'dark' ? '☀️ Theme' : '🌙 Theme';

    timeFormatToggle.textContent = timeFormat === '12' ? '🕐 12h' : '🕑 24h';
    updateSubtitle();
    updateTimelineLabels();

    updateClocks();
    setInterval(updateClocks, 1000);
    updateCount();

    toggleBtn.addEventListener('click', () => {
        const open = citySelector.classList.toggle('open');
        toggleBtn.classList.toggle('active', open);
        toggleBtn.setAttribute('aria-expanded', open);
        if (open) searchCheckboxes.focus();
    });

    searchCheckboxes.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.checkbox-item').forEach(i =>
            i.classList.toggle('hidden', !i.dataset.name.includes(q))
        );
    });

    searchCheckboxes.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            searchCheckboxes.value = '';
            searchCheckboxes.dispatchEvent(new Event('input'));
            citySelector.classList.remove('open');
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.focus();
        }
    });

    checkboxGrid.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.type === 'checkbox') {
            e.target.checked = !e.target.checked;
            e.target.dispatchEvent(new Event('change'));
        }
    });

    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#checkboxGrid input').forEach(cb => {
            cb.checked = true;
            const c = grid.querySelector(`.clock-card[data-name="${cb.dataset.city.toLowerCase()}"]`);
            if (c) c.classList.remove('hidden');
        });
        updateCount();
    });

    deselectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#checkboxGrid input').forEach(cb => {
            cb.checked = false;
            const c = grid.querySelector(`.clock-card[data-name="${cb.dataset.city.toLowerCase()}"]`);
            if (c) c.classList.add('hidden');
        });
        updateCount();
    });

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️ Theme' : '🌙 Theme';
    });

    timeFormatToggle.addEventListener('click', () => {
        timeFormat = timeFormat === '12' ? '24' : '12';
        localStorage.setItem('timeFormat', timeFormat);
        timeFormatToggle.textContent = timeFormat === '12' ? '🕐 12h' : '🕑 24h';
        updateClocks();
        updateSubtitle();
        updateTimelineLabels();
        if (resultBox.classList.contains('show')) calcBtn.click();
        showToast(`Switched to ${timeFormat}-hour format`);
    });

    shareBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(location.href);
            showToast('✅ Link copied!');
        } catch {
            prompt('Copy link:', location.href);
        }
    });

    calcBtn.addEventListener('click', () => {
        const c1 = cityA.value, c2 = cityB.value;
        if (!c1 || !c2) return alert('Select two cities.');
        calendarLinks.innerHTML = '';
        const tz1 = cities.find(c => c.name === c1).zone, tz2 = cities.find(c => c.name === c2).zone;
        const overlapUTC = [], partialUTC = [], durMin = parseInt(durationSelect.value);

        for (let utc = 0; utc < 24; utc++) {
            const d = new Date(); d.setUTCHours(utc, 0, 0, 0);
            const h1 = parseInt(d.toLocaleString('en-US', { timeZone: tz1, hour: 'numeric', hour12: false }));
            const h2 = parseInt(d.toLocaleString('en-US', { timeZone: tz2, hour: 'numeric', hour12: false }));
            if (h1 >= 9 && h1 < 17 && h2 >= 9 && h2 < 17) overlapUTC.push(utc);
            else if ((h1 >= 7 && h1 < 19) && (h2 >= 7 && h2 < 19)) partialUTC.push(utc);
        }

        if (overlapUTC.length > 0) {
            renderTimeline(overlapUTC, []);
            updateTimelineLabels();
            const startUTC = overlapUTC[0], endUTC = overlapUTC[overlapUTC.length - 1] + 1;
            resultTitle.textContent = '✅ Overlap Found';
            const sStr = formatHourDisplay(startUTC), eStr = formatHourDisplay(endUTC);
            resultDesc.innerHTML = `<strong>${c1}</strong> & <strong>${c2}</strong>: <strong>${sStr} to ${eStr}</strong> (${overlapUTC.length} hrs available)`;

            const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startUTC, 0, 0)), end = new Date(start.getTime() + durMin * 60 * 1000);
            const title = encodeURIComponent(`Meeting: ${c1} & ${c2}`);
            const rec = recurrenceSelect.value, recStr = rec !== 'NONE' ? `Recurrence: ${rec}\n` : '';
            const details = encodeURIComponent(`${recStr}Duration: ${durMin} min\nParticipants: ${c1} | ${c2}\nAuto-adjusts to local timezones.`);
            const dates = `${fmtCal(start)}/${fmtCal(end)}`;
            const rruleParam = rec !== 'NONE' ? `&rrule=${encodeURIComponent(`RRULE:FREQ=${rec}`)}` : '';
            calendarLinks.innerHTML = `
                <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}${rruleParam}" target="_blank" rel="noopener" class="cal-btn" aria-label="Add to Google Calendar">📅 Google</a>
                <a href="https://outlook.office.com/calendar/0/action/compose?rru=addevent&startdt=${fmtCal(start)}&enddt=${fmtCal(end)}&subject=${title}&body=${details}" target="_blank" rel="noopener" class="cal-btn" aria-label="Add to Outlook">🟦 Outlook</a>
                <button onclick="downloadICS('${c1}','${c2}','${start.toISOString()}','${end.toISOString()}','${rec}')" class="cal-btn" aria-label="Download iCal file">🍎 iCal</button>
                <button onclick="exportEmail('${c1}','${c2}','${sStr}','${eStr}',${durMin},'${rec}')" class="cal-btn" aria-label="Send email invite">📧 Email</button>
                <button onclick="showQR()" class="cal-btn" aria-label="Show QR code">📱 QR</button>`;
        } else if (partialUTC.length > 0) {
            renderTimeline([], partialUTC);
            updateTimelineLabels();
            const startUTC = partialUTC[0], endUTC = partialUTC[partialUTC.length - 1] + 1;
            resultTitle.textContent = '⚠️ Partial Overlap';
            const sStr = formatHourDisplay(startUTC), eStr = formatHourDisplay(endUTC);
            resultDesc.innerHTML = `<strong>${c1}</strong> & <strong>${c2}</strong>: No full 9-5 overlap, but <strong>${sStr} to ${eStr}</strong> has both participants within 7 AM - 7 PM (${partialUTC.length} hrs available).<br><em>Tip: Consider flexible hours for this pairing.</em>`;

            const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startUTC, 0, 0)), end = new Date(start.getTime() + durMin * 60 * 1000);
            const title = encodeURIComponent(`Meeting: ${c1} & ${c2}`);
            const rec = recurrenceSelect.value, recStr = rec !== 'NONE' ? `Recurrence: ${rec}\n` : '';
            const details = encodeURIComponent(`${recStr}Duration: ${durMin} min\nParticipants: ${c1} | ${c2}\nAuto-adjusts to local timezones.`);
            const dates = `${fmtCal(start)}/${fmtCal(end)}`;
            const rruleParam = rec !== 'NONE' ? `&rrule=${encodeURIComponent(`RRULE:FREQ=${rec}`)}` : '';
            calendarLinks.innerHTML = `
                <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}${rruleParam}" target="_blank" rel="noopener" class="cal-btn" aria-label="Add to Google Calendar">📅 Google</a>
                <a href="https://outlook.office.com/calendar/0/action/compose?rru=addevent&startdt=${fmtCal(start)}&enddt=${fmtCal(end)}&subject=${title}&body=${details}" target="_blank" rel="noopener" class="cal-btn" aria-label="Add to Outlook">🟦 Outlook</a>
                <button onclick="downloadICS('${c1}','${c2}','${start.toISOString()}','${end.toISOString()}','${rec}')" class="cal-btn" aria-label="Download iCal file">🍎 iCal</button>
                <button onclick="exportEmail('${c1}','${c2}','${sStr}','${eStr}',${durMin},'${rec}')" class="cal-btn" aria-label="Send email invite">📧 Email</button>
                <button onclick="showQR()" class="cal-btn" aria-label="Show QR code">📱 QR</button>`;
        } else {
            renderTimeline([], []);
            updateTimelineLabels();
            resultTitle.textContent = '⚠️ No Overlap';
            resultDesc.innerHTML = `<strong>${c1}</strong> & <strong>${c2}</strong> have no overlapping business hours (even outside 9-5). Consider scheduling on a weekend or using asynchronous communication.`;
        }
        resultBox.classList.add('show');
    });

    supportBtn.addEventListener('click', () => {
        supportModal.classList.add('show');
        supportModal.querySelector('.btn').focus();
    });

    qrModal.addEventListener('click', e => { if (e.target === qrModal) closeQR(); });
    supportModal.addEventListener('click', e => { if (e.target === supportModal) closeSupport(); });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (qrModal.classList.contains('show')) closeQR();
            if (supportModal.classList.contains('show')) closeSupport();
        }
    });

    function updateClocks() {
        const now = new Date();
        cities.forEach((c, i) => {
            const timeEl = document.getElementById(`time-${i}`);
            const dateEl = document.getElementById(`date-${i}`);
            const tzEl = document.getElementById(`tz-${i}`);

            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString('en-US', {
                    timeZone: c.zone, hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: timeFormat === '12'
                });
            }
            if (dateEl) {
                const parts = new Intl.DateTimeFormat('en-US', { timeZone: c.zone, weekday: 'short', month: 'short', day: 'numeric' }).formatToParts(now);
                const w = parts.find(p => p.type === 'weekday')?.value, m = parts.find(p => p.type === 'month')?.value, d = parts.find(p => p.type === 'day')?.value;
                dateEl.textContent = timeFormat === '24' ? `${d} ${m}, ${w}` : `${w}, ${m} ${d}`;
            }
            if (tzEl) {
                tzEl.textContent = new Intl.DateTimeFormat('en-US', { timeZone: c.zone, timeZoneName: 'short' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
            }
        });
    }

    function formatHourDisplay(h) {
        return timeFormat === '24' ? `${String(h).padStart(2, '0')}:00` : (h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`);
    }

    function updateSubtitle() {
        schedulerSubtitle.textContent = timeFormat === '24' ? 'Find the best window for 09:00 - 17:00 business hours' : 'Find the best window for 9 AM - 5 PM business hours';
    }

    function updateTimelineLabels() {
        const l = timeFormat === '24' ? ['00:00', '06:00', '12:00', '18:00', '00:00'] : ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'];
        timelineLabels.innerHTML = l.map(x => `<span>${x}</span>`).join('');
    }

    function updateCount() {
        selectionCount.textContent = `${document.querySelectorAll('#checkboxGrid input:checked').length} selected`;
    }

    function renderTabs() {
        tabsHeader.innerHTML = notesTabs.map(t => `<div class="tab ${t.id === activeTabId ? 'active' : ''}" onclick="switchTab('${t.id}')" role="tab" aria-selected="${t.id === activeTabId}" tabindex="0"><span>${t.title}</span>${t.id !== 'default' ? `<button onclick="event.stopPropagation(); deleteTab('${t.id}')" aria-label="Delete ${t.title} tab">&times;</button>` : ''}</div>`).join('') + '<button class="tab-add" onclick="addTab()" aria-label="Add new note tab">+</button>';
        if (!notesTabs.find(t => t.id === activeTabId)) activeTabId = notesTabs[0].id;
        const active = notesTabs.find(t => t.id === activeTabId);
        notesArea.innerHTML = active ? sanitizeHTML(active.content) : '';
    }

    window.addTab = () => {
        const id = 'tab_' + Date.now();
        notesTabs.push({id, title: `Note ${notesTabs.length}`, content: ''});
        activeTabId = id;
        renderTabs();
    };

    window.switchTab = (id) => {
        notesTabs.find(t => t.id === activeTabId).content = notesArea.innerHTML;
        activeTabId = id;
        renderTabs();
    };

    window.deleteTab = (id) => {
        if (notesTabs.length <= 1) return;
        notesTabs = notesTabs.filter(t => t.id !== id);
        if (activeTabId === id) activeTabId = notesTabs[0].id;
        renderTabs();
    };

    window.clearCurrentNote = () => {
        if (confirm('Clear current tab?')) {
            notesTabs.find(t => t.id === activeTabId).content = '';
            renderTabs();
        }
    };

    window.formatText = (cmd) => {
        document.execCommand(cmd, false, null);
        notesArea.focus();
    };

    notesArea.addEventListener('paste', e => {
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });

    notesArea.addEventListener('input', () => {
        saveStatus.textContent = '💾 Saving...';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            notesTabs.find(t => t.id === activeTabId).content = notesArea.innerHTML;
            localStorage.setItem('notesTabs', JSON.stringify(notesTabs));
            saveStatus.textContent = '✅ Saved';
        }, 500);
    });

    tabsHeader.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.target.click();
        }
    });

    function renderTimeline(overlap, partial) {
        timeline.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const s = document.createElement('div');
            if (overlap.includes(i)) s.className = 'time-slot overlap';
            else if (partial.includes(i)) s.className = 'time-slot partial';
            else s.className = 'time-slot';
            s.setAttribute('aria-label', `${timeFormat === '24' ? String(i).padStart(2,'0') : formatHourDisplay(i)}: ${overlap.includes(i) ? 'Full overlap' : partial.includes(i) ? 'Partial overlap' : 'No overlap'}`);
            timeline.appendChild(s);
        }
    }

    window.downloadICS = (c1, c2, sISO, eISO, rec) => {
        const s = new Date(sISO), e = new Date(eISO);
        let r = '';
        if (rec !== 'NONE') r = `RRULE:FREQ=${rec}\n`;
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GlobalTimeTracker//EN', 'BEGIN:VEVENT', `DTSTART:${fmtCal(s)}`, `DTEND:${fmtCal(e)}`, r, `SUMMARY:Meeting: ${c1} & ${c2}`, `DESCRIPTION:Participants: ${c1} | ${c2}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const blob = new Blob([ics], { type: 'text/calendar' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `meeting-${c1}-${c2}.ics`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    window.exportEmail = (c1, c2, u1, u2, dur, rec) => {
        const subj = encodeURIComponent(`Meeting: ${c1} & ${c2}`);
        const body = encodeURIComponent(`CITIES: ${c1} & ${c2}\nWINDOW: ${u1} - ${u2}\nDURATION: ${dur} min\nRECURRENCE: ${rec}\n\nNOTES:\n${notesArea.innerText || 'None'}`);
        location.href = `mailto:?subject=${subj}&body=${body}`;
    };

    window.showQR = () => {
        const url = location.href;
        if (typeof QRCode !== 'undefined') {
            qrImage.style.display = 'none';
            let canvas = qrModal.querySelector('canvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.style.borderRadius = '8px';
                canvas.style.margin = '12px auto';
                canvas.style.maxWidth = '100%';
                qrImage.parentNode.insertBefore(canvas, qrImage);
            }
            canvas.style.display = '';
            new QRCode(canvas, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
        } else {
            const isDark = document.body.classList.contains('dark');
            const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=${isDark ? '0f1724' : 'ffffff'}&color=${isDark ? 'e8edf3' : '1e2d3d'}&data=${encodeURIComponent(url)}`;
            qrImage.src = fallbackUrl;
            qrImage.style.display = '';
            const existingCanvas = qrModal.querySelector('canvas');
            if (existingCanvas) existingCanvas.style.display = 'none';
            qrImage.onerror = () => {
                qrImage.style.display = 'none';
                qrStatus.textContent = `QR unavailable. Copy: ${url.slice(0, 40)}...`;
            };
        }
        qrModal.classList.add('show');
    };

    window.closeQR = () => {
        qrModal.classList.remove('show');
        qrImage.style.display = '';
        qrImage.onerror = null;
        qrStatus.textContent = 'Scan to open this dashboard';
        const canvas = qrModal.querySelector('canvas');
        if (canvas) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
        }
    };

    window.exportNotesTxt = () => {
        const active = notesTabs.find(t => t.id === activeTabId);
        if (!active) return;
        const text = active.content.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        const blob = new Blob([text || 'No notes yet.'], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${active.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('✅ Notes exported!');
    };

    window.closeSupport = () => supportModal.classList.remove('show');
});
