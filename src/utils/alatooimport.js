// Frontend: src/utils/alatooImport.js
// Parser for Ala-Too University Excel format - FIXED VERSION

import * as XLSX from 'xlsx';

export const parseAlatooSchedule = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const schedule = [];
        const timeSlots = {
          '08.00-08.40': '08:00',
          '08.45-09.25': '08:45',
          '09.30-10.10': '09:30',
          '10.15-10.55': '10:15',
          '11.00-11.40': '11:00',
          '11.45-12.25': '11:45',
          '12:30-13.10': '12:30',
          '13.10-13.55': '13:10',
          '14.00-14.40': '14:00',
          '14:45 - 15:25': '14:45',
          '15:30 - 16:10': '15:30',
          '16:15 - 16:55': '16:15',
          '17:00 - 17:40': '17:00',
          '17:45 - 18:25': '17:45',
        };

        const daySheets = [
          'MONDAY Spring25',
          'TUESDAY Spring25', 
          'WEDNESDAY Spring25',
          'THURSDAY Spring25',
          'FRIDAY Spring25',
          'SATURDAY Spring25'
        ];

        console.log('🔍 Starting Ala-Too parser...');

        daySheets.forEach(sheetName => {
          if (!workbook.SheetNames.includes(sheetName)) {
            console.log(`⚠️ Sheet "${sheetName}" not found`);
            return;
          }
          
          const day = sheetName.split(' ')[0].charAt(0) + sheetName.split(' ')[0].slice(1).toLowerCase();
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          console.log(`📄 Processing ${sheetName} (${day})`);

          // Find header row with time slots (row 3, index 2)
          let headerRowIndex = -1;
          let timeColumnStart = -1;
          
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            for (let j = 0; j < row.length; j++) {
              if (row[j] && row[j].toString().includes('08.00')) {
                headerRowIndex = i;
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

          console.log(`✅ Found time header at row ${headerRowIndex + 1}, column ${timeColumnStart + 1}`);

          // Parse groups and classes (start from headerRowIndex + 2)
          let classCount = 0;
          
          for (let rowIdx = headerRowIndex + 2; rowIdx < jsonData.length; rowIdx++) {
            const row = jsonData[rowIdx];
            if (!row || row.length < 3) continue;

            // Group name is in column 2 (index 2)
            let groupName = '';
            if (row[2]) {
              const cellText = row[2].toString().trim();
              // Check if it contains a group pattern (COMSE, COMFCI, etc.)
              if (cellText.match(/^(COMSE|COMFCI|COMCEH|MATDAIS|MATMIE|EEAIR|IEMIT|COM-|MATH-)/i)) {
                groupName = cellText;
              }
            }

            if (!groupName) continue;

            // Parse each time slot
            const timeColumns = Object.keys(timeSlots);
            for (let timeIdx = 0; timeIdx < timeColumns.length; timeIdx++) {
              const colIdx = timeColumnStart + timeIdx;
              if (colIdx >= row.length) break;

              const cellValue = row[colIdx];
              if (!cellValue || 
                  cellValue.toString().trim() === '' || 
                  cellValue.toString().includes('LUNCH')) continue;

              // Parse cell format: "Course\nTeacher Room"
              const lines = cellValue.toString().split('\n');
              const course = lines[0]?.trim() || '';
              const teacherRoom = lines[1]?.trim() || '';
              
              if (!course) continue;

              // Extract teacher and room
              let teacher = '';
              let room = '';
              
              if (teacherRoom) {
                const parts = teacherRoom.split(/\s+/);
                if (parts.length > 0) {
                  room = parts[parts.length - 1]; // Last part is usually room
                  teacher = parts.slice(0, -1).join(' '); // Rest is teacher
                }
              }

              // Determine subject type
              let subjectType = 'lecture';
              const courseLower = course.toLowerCase();
              if (courseLower.includes('lab') || courseLower.includes('практика')) {
                subjectType = 'lab';
              } else if (courseLower.includes('seminar') || courseLower.includes('семинар')) {
                subjectType = 'seminar';
              }

              schedule.push({
                group: groupName,
                day: day,
                time: timeSlots[timeColumns[timeIdx]],
                course: course,
                teacher: teacher,
                room: room,
                subjectType: subjectType,
                duration: 1
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