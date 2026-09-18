window.TripSync = window.TripSync || {};

window.TripSync.print = {
  
  preparePrint() {
    const trip = window.TripSync.state.currentTrip;
    if (!trip) return;
    
    this.renderPrintHeader(trip);
    this.renderSpendSummary(trip.itinerary || []);
    
    // Ensure all images are loaded before printing
    const images = document.querySelectorAll('img');
    let loadedCount = 0;
    
    if (images.length === 0) {
      window.print();
      return;
    }
    
    images.forEach(img => {
      if (img.complete) {
        loadedCount++;
        if (loadedCount === images.length) window.print();
      } else {
        img.addEventListener('load', () => {
          loadedCount++;
          if (loadedCount === images.length) window.print();
        });
        img.addEventListener('error', () => {
          loadedCount++;
          if (loadedCount === images.length) window.print();
        });
      }
    });
  },
  
  renderPrintHeader(trip) {
    let headerContainer = document.getElementById('print-header');
    if (!headerContainer) {
      headerContainer = document.createElement('div');
      headerContainer.id = 'print-header';
      headerContainer.className = 'print-only';
      document.body.insertBefore(headerContainer, document.body.firstChild);
    }
    
    const rawMembers = trip.info?.members;
    const membersList = Array.isArray(rawMembers) 
      ? rawMembers.join(', ') 
      : (typeof rawMembers === 'string' ? rawMembers : '가족');
    const dates = `${trip.info?.start_date || ''} ~ ${trip.info?.end_date || ''}`;
    const tripTitle = trip.info?.trip_name || trip.info?.name || '여행 일정';
    const tripEmoji = trip.info?.cover_emoji || trip.info?.icon || '✈️';
    
    headerContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <h1 style="margin: 0; font-size: 28px;">${tripEmoji} ${tripTitle}</h1>
        <p style="margin: 10px 0 5px 0; font-size: 16px;"><strong>일정:</strong> ${dates}</p>
        <p style="margin: 0; font-size: 16px;"><strong>함께하는 사람들:</strong> ${membersList}</p>
      </div>
    `;
  },
  
  renderSpendSummary(itinerary) {
    let summaryContainer = document.getElementById('print-summary');
    if (!summaryContainer) {
      summaryContainer = document.createElement('div');
      summaryContainer.id = 'print-summary';
      summaryContainer.className = 'print-only';
      document.body.appendChild(summaryContainer);
    }
    
    // Calculate per-day totals
    const dayTotals = {};
    let totalPlanned = 0;
    let totalActual = 0;
    
    itinerary.forEach(item => {
      if (item.status === 'deleted') return;
      const date = item.date || '날짜 미지정';
      
      if (!dayTotals[date]) {
        dayTotals[date] = { planned: 0, actual: 0 };
      }
      
      const p = item.budget || 0;
      const a = item.actual_spend || 0;
      
      dayTotals[date].planned += p;
      dayTotals[date].actual += a;
      
      totalPlanned += p;
      totalActual += a;
    });
    
    let rowsHtml = '';
    Object.keys(dayTotals).sort().forEach(date => {
      rowsHtml += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${date}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${dayTotals[date].planned.toLocaleString()}원</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${dayTotals[date].actual.toLocaleString()}원</td>
        </tr>
      `;
    });
    
    summaryContainer.innerHTML = `
      <div style="margin-top: 40px; page-break-inside: avoid;">
        <h3 style="border-bottom: 1px solid #333; padding-bottom: 5px;">💰 비용 요약</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">날짜</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">예상 비용</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">실제 비용</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #eee;">
              <td style="border: 1px solid #ddd; padding: 8px;">총합</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalPlanned.toLocaleString()}원</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalActual.toLocaleString()}원</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }
};
