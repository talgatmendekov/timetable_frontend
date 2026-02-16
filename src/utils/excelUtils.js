// src/utils/excelUtils.js
// Excel import/export using SheetJS (loaded from CDN)

// Dynamically load SheetJS from CDN if not already loaded
const loadXLSX = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
};

/**
 * EXPORT: schedule data → .xlsx file
 *
 * Format:
 *   Sheet per day (Monday, Tuesday, ...)
 *   Rows = groups, Columns = time slots
 *   Each cell = "Course\nTeacher\nRoom"
 */
export const exportToExcel = async (groups, schedule, timeSlots, days, fileName) => {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  days.forEach(day => {
    // Build 2D array: header row + one row per group
    const header = ['Group', ...timeSlots];
    const rows = groups.map(group => {
      const cells = timeSlots.map(time => {
        const key = `${group}-${day}-${time}`;
        const entry = schedule[key];
        if (!entry) return '';
        const parts = [entry.course];
        if (entry.teacher) parts.push(entry.teacher);
        if (entry.room) parts.push(entry.room);
        return parts.join('\n');
      });
      return [group, ...cells];
    });

    const wsData = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths: first col wider, rest equal
    ws['!cols'] = [
      { wch: 18 },
      ...timeSlots.map(() => ({ wch: 22 }))
    ];

    // Row heights for wrapped text
    ws['!rows'] = wsData.map(() => ({ hpt: 50 }));

    XLSX.utils.book_append_sheet(wb, ws, day);
  });

  // Also add a "All Data" flat sheet for easy re-import
  const flatHeader = ['Group', 'Day', 'Time', 'Course', 'Teacher', 'Room'];
  const flatRows = Object.values(schedule).map(entry => [
    entry.group || '',
    entry.day || '',
    entry.time || '',
    entry.course || '',
    entry.teacher || '',
    entry.room || ''
  ]);
  const flatWs = XLSX.utils.aoa_to_sheet([flatHeader, ...flatRows]);
  flatWs['!cols'] = flatHeader.map((h, i) => ({ wch: i === 3 ? 28 : 16 }));
  XLSX.utils.book_append_sheet(wb, flatWs, 'All Data');

  // Trigger download
  XLSX.writeFile(wb, fileName || `university-schedule-${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * IMPORT: .xlsx file → schedule data
 *
 * Supports two formats:
 * 1. "All Data" sheet with columns: Group, Day, Time, Course, Teacher, Room
 * 2. Day-named sheets (Monday, Tuesday...) with groups as rows and times as columns
 */
export const importFromExcel = async (file) => {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const newSchedule = {};
        const newGroupsSet = new Set();

        // Try "All Data" sheet first
        if (wb.SheetNames.includes('All Data')) {
          const ws = wb.Sheets['All Data'];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          // Skip header row
          for (let i = 1; i < rows.length; i++) {
            const [group, day, time, course, teacher, room] = rows[i];
            if (!group || !day || !time || !course) continue;
            const key = `${group}-${day}-${time}`;
            newSchedule[key] = {
              group: String(group).trim(),
              day: String(day).trim(),
              time: String(time).trim(),
              course: String(course).trim(),
              teacher: teacher ? String(teacher).trim() : '',
              room: room ? String(room).trim() : ''
            };
            newGroupsSet.add(String(group).trim());
          }
        } else {
          // Fall back to day-named sheets
          const SCHEDULE_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

          wb.SheetNames.forEach(sheetName => {
            if (!SCHEDULE_DAYS.includes(sheetName)) return;
            const day = sheetName;
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (rows.length < 2) return;

            const timeRow = rows[0].slice(1); // skip "Group" header

            for (let r = 1; r < rows.length; r++) {
              const row = rows[r];
              const group = row[0];
              if (!group) continue;
              newGroupsSet.add(String(group).trim());

              for (let c = 0; c < timeRow.length; c++) {
                const time = timeRow[c];
                const cellValue = row[c + 1];
                if (!cellValue || String(cellValue).trim() === '') continue;

                // Parse "Course\nTeacher\nRoom" format
                const parts = String(cellValue).split('\n').map(s => s.trim());
                const course = parts[0] || '';
                const teacher = parts[1] || '';
                const room = parts[2] || '';

                if (!course) continue;

                const key = `${group}-${day}-${time}`;
                newSchedule[key] = {
                  group: String(group).trim(),
                  day,
                  time: String(time).trim(),
                  course,
                  teacher,
                  room
                };
              }
            }
          });
        }

        if (Object.keys(newSchedule).length === 0 && newGroupsSet.size === 0) {
          resolve({ success: false, error: 'No valid data found in file. Make sure it has an "All Data" sheet or day-named sheets.' });
          return;
        }

        resolve({
          success: true,
          schedule: newSchedule,
          groups: Array.from(newGroupsSet)
        });

      } catch (err) {
        reject({ success: false, error: `Failed to parse Excel file: ${err.message}` });
      }
    };

    reader.onerror = () => reject({ success: false, error: 'Failed to read file' });
    reader.readAsArrayBuffer(file);
  });
};
