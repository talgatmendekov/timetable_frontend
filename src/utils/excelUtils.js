// src/utils/excelUtils.js
// Excel import/export using SheetJS (loaded from CDN)

const loadXLSX = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
};

// ── Ala-Too format detection ──────────────────────────────────────────────────
const ALATOO_SHEETS = [
  'MONDAY Spring25', 'TUESDAY Spring25', 'WEDNESDAY Spring25',
  'THURSDAY Spring25', 'FRIDAY Spring25', 'SATURDAY Spring25',
];

const ALATOO_DAY_MAP = {
  'MONDAY Spring25':    'Monday',
  'TUESDAY Spring25':   'Tuesday',
  'WEDNESDAY Spring25': 'Wednesday',
  'THURSDAY Spring25':  'Thursday',
  'FRIDAY Spring25':    'Friday',
  'SATURDAY Spring25':  'Saturday',
};

function isAlatooFormat(wb) {
  return wb.SheetNames.some(n => ALATOO_SHEETS.includes(n));
}

// ── Normalize time: strip spaces, keep original separators (dots/colons) ─────
function normalizeTime(t) {
  return t.toString().trim().replace(/\s+/g, '');
}

// ── Extract teacher + room from second line of cell ───────────────────────────
const ROOM_TOKEN = /\b(B\s*\d+\w*|BIGLAB|BigLab|LAB\d*(\(\d+\))?|LAB5?\(\d+\)|Sport\s*Hall|и\d+|[Aa]\d+|[Cc]\d+)\b/i;

function extractTeacherRoom(str) {
  if (!str) return { teacher: '', room: '' };
  str = str.trim().replace(/^[/\\]+/, '').trim();
  // Remove notes
  str = str.replace(/\s+make.?up.*$/i, '').trim();
  str = str.replace(/\s+\d{1,2}[.:]\d{2}.*$/, '').trim();

  const m = str.match(ROOM_TOKEN);
  if (m) {
    const room = m[1].replace(/\s+/g, '');
    const teacher = (str.slice(0, m.index) + str.slice(m.index + m[0].length))
      .trim().replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s{2,}/g, ' ');
    return { teacher: teacher.substring(0, 100), room: room.substring(0, 50) };
  }
  return { teacher: str.substring(0, 100), room: '' };
}

// ── Build merge map for duration detection ────────────────────────────────────
function buildMergeMap(sheet) {
  const map = {};
  (sheet['!merges'] || []).forEach(({ s, e }) => {
    const colSpan = e.c - s.c + 1;
    if (colSpan > 1) map[`${s.r},${s.c}`] = colSpan;
  });
  return map;
}

// ── Detect subject type from course/room strings ──────────────────────────────
function detectSubjectType(course, room) {
  const cl = course.toLowerCase();
  const rl = room.toLowerCase();
  if (cl.includes('lab') || rl.includes('lab') || rl.includes('biglab')) return 'lab';
  if (cl.includes('seminar') || cl.includes('семинар')) return 'seminar';
  if (cl.includes('practic') || cl.includes('практик')) return 'practice';
  return 'lecture';
}

// ── Parser for Ala-Too university format ──────────────────────────────────────
function parseAlatooWorkbook(wb, XLSX) {
  const schedule = {};
  const groupsSet = new Set();

  ALATOO_SHEETS.forEach(sheetName => {
    if (!wb.SheetNames.includes(sheetName)) return;

    const dayName = ALATOO_DAY_MAP[sheetName];
    const sheet   = wb.Sheets[sheetName];
    const mergeMap = buildMergeMap(sheet);
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find time header row — has ≥4 cells matching time pattern in cols 3-16
    let timeRowIdx = -1;
    let timeSlots  = []; // [{col, time}]

    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const slots = [];
      for (let j = 3; j <= 16; j++) {
        const c = rows[i][j];
        if (c && /\d{2}[.:]\d{2}/.test(c.toString())) {
          slots.push({ col: j, time: normalizeTime(c) });
        }
      }
      if (slots.length >= 4) { timeRowIdx = i; timeSlots = slots; break; }
    }

    if (timeRowIdx === -1) {
      console.warn(`⚠ No time row in ${sheetName}`);
      return;
    }

    console.log(`📄 ${dayName}: ${timeSlots.length} time slots (row ${timeRowIdx})`);

    // Parse group rows — stop at ROOM section
    for (let ri = timeRowIdx + 1; ri < rows.length; ri++) {
      const row  = rows[ri];
      const col2 = row[2] ? row[2].toString().trim() : '';

      if (col2.toUpperCase() === 'ROOM') break;
      if (!col2 || !/^(COM|MAT|EEA|IEM|MATH)/i.test(col2) || col2.length > 30) continue;

      const group = col2.trim().replace(/\s+/g, '').replace(/\/+/g, '/');
      groupsSet.add(group);

      timeSlots.forEach(({ col, time }) => {
        const cellVal = row[col];
        if (!cellVal || !cellVal.toString().trim()) return;

        const content = cellVal.toString().trim();
        if (/^(LUNCH|BREAK)/i.test(content) || content.length < 3) return;

        const lines   = content.split('\n').map(l => l.trim()).filter(Boolean);
        const course  = lines[0] ? lines[0].substring(0, 100) : '';
        if (!course) return;

        const { teacher, room } = extractTeacherRoom(lines[1] || '');

        // Duration from merge map
        const duration = mergeMap[`${ri},${col}`] || 1;

        const key = `${group}-${dayName}-${time}`;
        schedule[key] = {
          group, day: dayName, time, course,
          teacher, room,
          subjectType: detectSubjectType(course, room),
          duration,
        };
      });
    }
  });

  return { schedule, groups: Array.from(groupsSet).sort() };
}

// ── Parser for standard export format ────────────────────────────────────────
function parseStandardWorkbook(wb, XLSX) {
  const schedule  = {};
  const groupsSet = new Set();

  // "All Data" flat sheet
  if (wb.SheetNames.includes('All Data')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['All Data'], { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const [group, day, time, course, teacher, room] = rows[i];
      if (!group || !day || !time || !course) continue;
      const key = `${group}-${day}-${time}`;
      schedule[key] = {
        group: String(group).trim(), day: String(day).trim(),
        time: String(time).trim(), course: String(course).trim(),
        teacher: teacher ? String(teacher).trim() : '',
        room: room ? String(room).trim() : '',
        subjectType: 'lecture', duration: 1,
      };
      groupsSet.add(String(group).trim());
    }
    return { schedule, groups: Array.from(groupsSet).sort() };
  }

  // Day-named sheets
  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].forEach(day => {
    if (!wb.SheetNames.includes(day)) return;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[day], { header: 1 });
    if (rows.length < 2) return;
    const timeRow = rows[0].slice(1);
    for (let r = 1; r < rows.length; r++) {
      const row   = rows[r];
      const group = row[0];
      if (!group) continue;
      groupsSet.add(String(group).trim());
      timeRow.forEach((time, c) => {
        const cell = row[c + 1];
        if (!cell || !String(cell).trim()) return;
        const parts = String(cell).split('\n').map(s => s.trim());
        const key = `${group}-${day}-${time}`;
        schedule[key] = {
          group: String(group).trim(), day,
          time: String(time).trim(), course: parts[0] || '',
          teacher: parts[1] || '', room: parts[2] || '',
          subjectType: 'lecture', duration: 1,
        };
      });
    }
  });

  return { schedule, groups: Array.from(groupsSet).sort() };
}

/**
 * EXPORT: schedule data → .xlsx file
 */
export const exportToExcel = async (groups, schedule, timeSlots, days, fileName) => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  days.forEach(day => {
    const header = ['Group', ...timeSlots];
    const rows = groups.map(group => {
      const cells = timeSlots.map(time => {
        const entry = schedule[`${group}-${day}-${time}`];
        if (!entry) return '';
        return [entry.course, entry.teacher, entry.room].filter(Boolean).join('\n');
      });
      return [group, ...cells];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [{ wch: 18 }, ...timeSlots.map(() => ({ wch: 22 }))];
    ws['!rows'] = [header, ...rows].map(() => ({ hpt: 50 }));
    XLSX.utils.book_append_sheet(wb, ws, day);
  });

  // Flat sheet for re-import
  const flatHeader = ['Group','Day','Time','Course','Teacher','Room'];
  const flatRows = Object.values(schedule).map(e => [
    e.group||'', e.day||'', e.time||'', e.course||'', e.teacher||'', e.room||''
  ]);
  const flatWs = XLSX.utils.aoa_to_sheet([flatHeader, ...flatRows]);
  flatWs['!cols'] = flatHeader.map((_, i) => ({ wch: i === 3 ? 28 : 16 }));
  XLSX.utils.book_append_sheet(wb, flatWs, 'All Data');

  XLSX.writeFile(wb, fileName || `university-schedule-${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * IMPORT: .xlsx file → schedule data
 * Auto-detects Ala-Too format OR standard export format
 */
export const importFromExcel = async (file) => {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });

        console.log('📂 Sheets:', wb.SheetNames);

        const result = isAlatooFormat(wb)
          ? (() => { console.log('✅ Ala-Too format detected'); return parseAlatooWorkbook(wb, XLSX); })()
          : (() => { console.log('✅ Standard format detected'); return parseStandardWorkbook(wb, XLSX); })();

        const count = Object.keys(result.schedule).length;
        console.log(`✅ Parsed ${count} entries across ${result.groups.length} groups`);

        if (count === 0) {
          resolve({ success: false, error: 'No valid schedule data found in file.' });
          return;
        }

        resolve({ success: true, schedule: result.schedule, groups: result.groups });
      } catch (err) {
        console.error('Import error:', err);
        reject({ success: false, error: `Failed to parse Excel: ${err.message}` });
      }
    };

    reader.onerror = () => reject({ success: false, error: 'Failed to read file' });
    reader.readAsArrayBuffer(file);
  });
};