# Integration Guide - 3 New Features

## 1. MOBILE-FIRST RESPONSIVE DESIGN

### Files:
- `mobile-first-responsive.css`

### Integration:
1. Add the entire content of `mobile-first-responsive.css` to the END of your `src/index.css`
2. Test on mobile by opening Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M)
3. Test different screen sizes: 375px (iPhone), 768px (iPad), 1024px (Desktop)

### Features:
- Sticky group column (stays visible while scrolling horizontally)
- Touch-friendly buttons (44px minimum)
- Horizontal scroll for table on mobile
- Stacked filters and controls
- Full-screen modal on mobile
- iOS zoom prevention (16px inputs)

---

## 2. GUEST LAB BOOKING SYSTEM

### Frontend Files:
- `GuestBooking.js` → `src/components/`
- `GuestBooking.css` → `src/components/`

### Backend Files:
- `bookingRoutes.js` → `src/routes/`
- `booking-migration.sql` (add to `scripts/startup.js`)

### Integration Steps:

#### A) Backend (Railway):

1. **Update `scripts/startup.js`** - Add booking table creation:
   ```javascript
   // Add after schedules table creation
   await client.query(`
     CREATE TABLE IF NOT EXISTS booking_requests (
       id SERIAL PRIMARY KEY,
       name VARCHAR(100) NOT NULL,
       email VARCHAR(100) NOT NULL,
       phone VARCHAR(50),
       room VARCHAR(50) NOT NULL,
       day VARCHAR(20) NOT NULL,
       start_time VARCHAR(10) NOT NULL,
       duration INTEGER DEFAULT 1,
       purpose TEXT NOT NULL,
       status VARCHAR(20) DEFAULT 'pending',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     );
     CREATE INDEX IF NOT EXISTS idx_booking_status ON booking_requests(status);
   `);
   ```

2. **Update `src/server.js`** - Add booking routes:
   ```javascript
   const bookingRoutes = require('./routes/bookingRoutes');
   app.use('/api/booking-requests', bookingRoutes);
   ```

3. Deploy to Railway

#### B) Frontend (Vercel):

1. **Add `GuestBooking.js` and `GuestBooking.css`** to `src/components/`

2. **Update `src/App.js`** - Add in guest mode section:
   ```javascript
   import GuestBooking from './components/GuestBooking';
   
   const [showBooking, setShowBooking] = useState(false);
   
   // In guest mode render:
   {!isAuthenticated && (
     <>
       <button onClick={() => setShowBooking(true)} className="btn btn-primary">
         🏫 {t('bookLab') || 'Book a Lab'}
       </button>
       <GuestBooking isOpen={showBooking} onClose={() => setShowBooking(false)} />
     </>
   )}
   ```

3. **Add translations** to `src/data/i18n.js`:
   ```javascript
   bookLab: 'Book a Lab',
   yourName: 'Your Name',
   enterName: 'Enter your name',
   phone: 'Phone',
   startTime: 'Start Time',
   purpose: 'Purpose/Reason',
   describePurpose: 'Describe why you need this lab...',
   submitRequest: 'Submit Request',
   bookingSubmitted: 'Request Submitted!',
   bookingSubmittedMsg: 'Admin will review and approve your booking request.',
   bookingFailed: 'Booking request failed.',
   bookingError: 'Network error.',
   ```

4. **Create admin view** to manage booking requests (optional - can be added later)

---

## 3. ALA-TOO EXCEL IMPORT FIX

### Files:
- `alatooImport.js` → `src/utils/`

### Integration:

1. **Add file** `alatooImport.js` to `src/utils/`

2. **Update import handler** in your component (probably `App.js` or `Header.js`):
   ```javascript
   import { parseAlatooSchedule } from './utils/alatooImport';
   
   const handleImport = async (e) => {
     const file = e.target.files[0];
     if (!file) return;
     
     try {
       const schedule = await parseAlatooSchedule(file);
       
       // Import to backend
       for (const entry of schedule) {
         await scheduleAPI.save(
           entry.group,
           entry.day,
           entry.time,
           entry.course,
           entry.teacher,
           entry.room,
           entry.subjectType,
           entry.duration
         );
       }
       
       alert(`✅ Successfully imported ${schedule.length} classes!`);
       window.location.reload();
     } catch (error) {
       alert(`❌ Import failed: ${error.message}`);
     }
   };
   ```

3. **Install XLSX library** (if not already):
   ```bash
   npm install xlsx
   ```

4. Test with your `SPRING_25-26_schedule.xlsx` file

---

## Testing Checklist:

### Mobile Responsive:
- [ ] Open on actual phone
- [ ] Test table horizontal scroll
- [ ] Check sticky group column
- [ ] Test all buttons are tappable (44px+)
- [ ] Test modal on mobile
- [ ] Test landscape mode

### Guest Booking:
- [ ] Guest can submit booking
- [ ] Form validation works
- [ ] Success message appears
- [ ] Backend receives request
- [ ] Admin can see pending requests
- [ ] Admin can approve/reject

### Excel Import:
- [ ] Upload SPRING_25-26_schedule.xlsx
- [ ] All days import correctly
- [ ] Groups appear correctly
- [ ] Time slots match (08:00, 08:45, etc.)
- [ ] Teachers and rooms extracted
- [ ] Subject types detected

---

## Priority Order:

1. **Mobile-first CSS** (URGENT - most users on mobile)
2. **Excel import fix** (for easy schedule setup)
3. **Guest booking** (nice-to-have feature)
