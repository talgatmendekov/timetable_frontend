// Frontend: src/utils/alatooImport.js
// Parser for Ala-Too University Excel format - FIXED VERSION

import * as XLSX from 'xlsx';

// ─── Bug Fix 1: Room extraction ──────────────────────────────────────────────
// OLD: took only the LAST word as room → "B110 LAB" became just "LAB"
// NEW: walks backwards collecting consecutive room tokens (B110, LAB, BIGLAB, etc.)
//      so "Dr. Daniiar Satybaldiev B110 LAB" → teacher="Dr. Daniiar Satybaldiev", room="B110 LAB"
const ROOM_TOKEN = /^(B\d+|LAB\d*(\(\d+\))?|BIGLAB|Lab\d*(\(\d+\))?|и\d+|[Aa]\d+)$/i;

function extractTeacherRoom(teacherRoomStr) {
  if (!teacherRoomStr) return { teacher: '', room: '' };
  const parts = teacherRoomStr.trim().split(/\s+/);
  if (!parts.length) return { teacher: '', room: '' };

  const roomTokens = [];
  let i = parts.length - 1;

  // Walk backwards, collecting consecutive tokens that look like room identifiers
  while (i >= 0 && ROOM_TOKEN.test(parts[i])) {
    roomTokens.unshift(parts[i]);
    i--;
  }

  const teacher = parts.slice(0, i + 1).join(' ');
  const room    = roomTokens.join(' ');
  return { teacher, room };
}

// ─── Bug Fix 2: Duration from merged cells ───────────────────────────────────
// OLD: always set duration = 1 because sheet_to_json only reads the top-left cell
//      of a merged range; the column span (= hours) was ignored entirely.
// NEW: after reading the sheet we also inspect sheet['!merges'] which XLSX.js
//      exposes.  Each merge entry is { s:{r,c}, e:{r,c} } (0-based).
//      We build a lookup map (row,col) → colSpan so that when we encounter a
//      non-empty cell we can instantly know how many time-slots it covers.
function buildMergeMap(sheet) {
  const map = {};
  const merges = sheet['!merges'] || [];
  merges.forEach(({ s, e }) => {
    const colSpan = e.c - s.c + 1;
    if (colSpan > 1) {
      map[`${s.r},${s.c}`] = colSpan;
    }
  });
  return map;
}

// ─── Main parser ─────────────────────────────────────────────────────────────
export const parseAlatooSchedule = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const schedule = [];
        const timeSlots = {
          '08.00-08.40':    '08:00',
          '08.45-09.25':    '08:45',
          '09.30-10.10':    '09:30',
          '10.15-10.55':    '10:15',
          '11.00-11.40':    '11:00',
          '11.45-12.25':    '11:45',
          '12:30-13.10':    '12:30',
          '13.10-13.55':    '13:10',
          '14.00-14.40':    '14:00',
          '14:45 - 15:25':  '14:45',
          '15:30 - 16:10':  '15:30',
          '16:15 - 16:55':  '16:15',
          '17:00 - 17:40':  '17:00',
          '17:45 - 18:25':  '17:45',
        };

        const daySheets = [
          'MONDAY Spring25',
          'TUESDAY Spring25',
          'WEDNESDAY Spring25',
          'THURSDAY Spring25',
          'FRIDAY Spring25',
          'SATURDAY Spring25',
        ];

        console.log('🔍 Starting Ala-Too parser (fixed)…');

        daySheets.forEach(sheetName => {
          if (!workbook.SheetNames.includes(sheetName)) {
            console.log(`⚠️  Sheet "${sheetName}" not found`);
            return;
          }

          const day  = sheetName.split(' ')[0].charAt(0) + sheetName.split(' ')[0].slice(1).toLowerCase();
          const sheet = workbook.Sheets[sheetName];

          // ── Bug Fix 2: build merge lookup before iterating rows ──
          const mergeMap = buildMergeMap(sheet);

          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          console.log(`📄 Processing ${sheetName} (${day})`);

          // Find the row that contains "08.00" (time-slot header row)
          let headerRowIndex  = -1;
          let timeColumnStart = -1;

          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            for (let j = 0; j < row.length; j++) {
              if (row[j] && row[j].toString().includes('08.00')) {
                headerRowIndex  = i;
                timeColumnStart = j;
                break;
              }
            }
            if (headerRowIndex !== -1) break;
          }

          if (headerRowIndex === -1) {
            console.log(`❌ Could not find time header in ${sheetName}`);
            return;
          }

          console.log(`✅ Time header at row ${headerRowIndex + 1}, col ${timeColumnStart + 1}`);

          // Build ordered list of time-slot keys (in column order)
          const timeColumnKeys = Object.keys(timeSlots); // same order as the sheet

          let classCount = 0;

          // Data rows start two rows after the header row
          for (let rowIdx = headerRowIndex + 2; rowIdx < jsonData.length; rowIdx++) {
            const row = jsonData[rowIdx];
            if (!row || row.length < 3) continue;

            // Group name is in column index 2
            const rawGroup = row[2] ? row[2].toString().trim() : '';
            if (!rawGroup.match(/^(COMSE|COMFCI|COMCEH|MATDAIS|MATMIE|EEAIR|IEMIT|COM-|MATH-)/i)) {
              continue;
            }
            const groupName = rawGroup;

            // Iterate time-slot columns
            for (let timeIdx = 0; timeIdx < timeColumnKeys.length; timeIdx++) {
              const colIdx = timeColumnStart + timeIdx;
              if (colIdx >= row.length) break;

              const cellValue = row[colIdx];
              if (!cellValue ||
                  cellValue.toString().trim() === '' ||
                  cellValue.toString().includes('LUNCH')) continue;

              // ── Bug Fix 2: look up column span for this cell ──────────────
              // jsonData rows are 0-based; rowIdx and colIdx are already 0-based
              // XLSX !merges use 0-based (r, c) matching jsonData indices
              const mergeKey = `${rowIdx},${colIdx}`;
              const duration = mergeMap[mergeKey] || 1;

              // Parse "Course\nTeacher Room" cell format
              const lines   = cellValue.toString().split('\n');
              const course   = lines[0]?.trim() || '';
              const teacherRoomStr = lines[1]?.trim() || '';

              if (!course) continue;

              // ── Bug Fix 1: proper teacher / room extraction ───────────────
              const { teacher, room } = extractTeacherRoom(teacherRoomStr);

              // Determine subject type from course name OR room label
              let subjectType = 'lecture';
              const courseLower  = course.toLowerCase();
              const roomLower    = room.toLowerCase();
              if (
                courseLower.includes('lab') ||
                courseLower.includes('практика') ||
                roomLower.includes('lab') ||        // catches "B110 LAB", "BIGLAB", etc.
                roomLower.includes('biglab')
              ) {
                subjectType = 'lab';
              } else if (
                courseLower.includes('seminar') ||
                courseLower.includes('семинар')
              ) {
                subjectType = 'seminar';
              }

              schedule.push({
                group:       groupName,
                day:         day,
                time:        timeSlots[timeColumnKeys[timeIdx]],
                course:      course,
                teacher:     teacher,
                room:        room,
                subjectType: subjectType,
                duration:    duration,   // ← now correctly 2, 3 or 4 instead of always 1
              });

              classCount++;
            }
          }

          console.log(`📊 Found ${classCount} classes in ${sheetName}`);
        });

        console.log(`✅ Total parsed: ${schedule.length} classes`);

        if (schedule.length === 0) {
          reject(new Error('No schedule data found. Please check the file format.'));
        } else {
          resolve(schedule);
        }
      } catch (error) {
        console.error('❌ Parser error:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};