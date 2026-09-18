window.TripSync = window.TripSync || {};

window.TripSync.calendar = {
  
  _formatICSDate(dateStr, timeStr) {
    if (!dateStr || !timeStr) return '';
    // Expected dateStr: YYYY-MM-DD, timeStr: HH:MM
    const datePart = dateStr.replace(/-/g, '');
    const timePart = timeStr.replace(/:/g, '') + '00';
    // Format: TZID=Asia/Seoul:20261011T090000
    // Simplify for vanilla JS without heavy timezone library, using local time loosely or UTC
    // Using standard local format as per prompt's example format
    return `TZID=Asia/Seoul:${datePart}T${timePart}`;
  },
  
  _escapeICS(text) {
    if (!text) return '';
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  },
  
  _generateUID() {
    return Math.random().toString(36).substring(2) + '@tripsync.local';
  },
  
  _buildVEvent(item, dateStr) {
    if (!item.start_time || !item.end_time) return '';
    
    const dtStart = this._formatICSDate(dateStr, item.start_time);
    const dtEnd = this._formatICSDate(dateStr, item.end_time);
    const summary = this._escapeICS(`${item.icon || ''} ${item.title}`);
    const location = this._escapeICS(item.address || '');
    const description = this._escapeICS(`${item.description || ''}\n${item.actual_notes || ''}\n${item.booking_link || ''}`);
    const url = item.booking_link || item.google_maps_link || '';
    const uid = this._generateUID();
    const stamp = this._formatICSDate(new Date().toISOString().split('T')[0], '00:00'); // simple stamp

    return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${stamp}
DTSTART;${dtStart}
DTEND;${dtEnd}
SUMMARY:${summary}
LOCATION:${location}
DESCRIPTION:${description}
URL:${url}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER:-PT30M
END:VALARM
END:VEVENT
`;
  },
  
  _triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadAll() {
    const trip = window.TripSync.state.currentTrip;
    if (!trip || !trip.itinerary) return;
    
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TripSync//Itinerary//KO
CALSCALE:GREGORIAN
`;

    // Process all items across all days (assuming itinerary is an object grouping items by date, or array)
    // The structure might vary, let's assume it's flat with 'date' field or we iterate
    const items = trip.itinerary || []; 
    items.forEach(item => {
      // Find date for item
      const itemDate = item.date; // assuming item has date
      if (itemDate && item.status !== 'deleted') {
        icsContent += this._buildVEvent(item, itemDate);
      }
    });
    
    icsContent += 'END:VCALENDAR';
    const tripName = trip.info?.trip_name || trip.info?.name || 'Trip';
    const tripId = trip.info?.trip_id || trip.id || 'calendar';
    this._triggerDownload(icsContent, `${tripName}_${tripId}.ics`);
  },

  downloadItem(itemId) {
    // Assuming flat list in current day for simplicity
    const items = window.TripSync.getCurrentDayItems() || [];
    const item = items.find(i => String(i.id) === String(itemId));
    if (!item) return;

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TripSync//Itinerary//KO
`;
    
    icsContent += this._buildVEvent(item, item.date || new Date().toISOString().split('T')[0]);
    icsContent += 'END:VCALENDAR';
    
    this._triggerDownload(icsContent, `${item.title}_${item.date || 'event'}.ics`);
  },

  downloadDay(dayIndex) {
    // Requires knowing date of dayIndex. Assuming we get items and they have 'date'
    // Fallback implementation: use getCurrentDayItems if dayIndex matches current
    const items = window.TripSync.getCurrentDayItems() || [];
    if (!items.length) return;
    
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TripSync//Itinerary//KO
`;
    
    items.forEach(item => {
      if (item.status !== 'deleted') {
        icsContent += this._buildVEvent(item, item.date || new Date().toISOString().split('T')[0]);
      }
    });
    
    icsContent += 'END:VCALENDAR';
    this._triggerDownload(icsContent, `Day${dayIndex + 1}_Itinerary.ics`);
  }
};
