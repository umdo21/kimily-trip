window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;

const CATEGORY_EMOJI = {
  restaurant: '🍽️',
  attraction: '🏛️',
  cafe: '☕',
  shopping: '🛍️',
  transport: '🚶',
  free: '⭐',
  flight: '✈️',
  accommodation: '🏨'
};

const CATEGORY_LABEL = {
  restaurant: '식사',
  attraction: '관광',
  cafe: '카페',
  shopping: '쇼핑',
  transport: '이동',
  free: '자유',
  flight: '항공',
  accommodation: '숙소'
};

window.TripSync.timeline = {
  render() {
    const items = window.TripSync.getCurrentDayItems() || [];
    const container = document.getElementById('timeline-section');
    if (!container) return;
    
    container.innerHTML = '';
    
    const trip = window.TripSync.state.currentTrip;
    const currencyUnit = (trip && trip.info && trip.info.currency === 'JPY') ? '엔' : '원';
    
    if (items.length === 0) {
      container.innerHTML = `
        <div class="day-empty-card">
          <div class="empty-icon-circle">🏖️</div>
          <h4 class="empty-title">이 날짜에는 아직 등록된 일정이 없습니다</h4>
          <p class="empty-desc">상단의 <strong>➕ 추가</strong> 버튼을 눌러 우리 가족의 첫 방문지를 계획해보세요!</p>
          <button class="btn-primary" style="margin-top: 14px;" onclick="TripSync.editor.showAddModal()">➕ 새 일정 추가하기</button>
        </div>
      `;
      return;
    }
    
    let validItemIndex = 1;
    
    items.forEach((item, index) => {
      const emoji = item.icon || CATEGORY_EMOJI[item.category] || '📍';
      const label = CATEGORY_LABEL[item.category] || '기타';
      const status = item.status || 'planned';
      
      const isChanged = status === 'changed';
      const isSkipped = status === 'skipped';
      const isVisited = status === 'visited';
      const isDeleted = status === 'deleted';
      
      if (isDeleted) return;
      
      // Actual Info banner
      let actualInfoHtml = '';
      if (isSkipped) {
        actualInfoHtml = `
          <div class="actual-info skipped">
            <span class="actual-label">⏭️ 일정 스킵</span>
            <span class="actual-text">${item.actual_notes || '사유 미입력'}</span>
          </div>
        `;
      } else if (isChanged) {
        actualInfoHtml = `
          <div class="actual-info changed">
            <div class="actual-header">
              <span class="actual-label">🔄 실제 변경:</span>
              <span class="actual-title"><strong>${item.actual_title || item.title}</strong></span>
            </div>
            <div class="actual-body">
              <span>🕒 ${item.actual_start_time || item.start_time} ~ ${item.actual_end_time || item.end_time}</span>
              ${item.actual_spend ? `<span class="actual-spend">💰 실제 지출: ${item.actual_spend.toLocaleString()}${currencyUnit}</span>` : ''}
              ${item.actual_notes ? `<p class="actual-note">📝 ${item.actual_notes}</p>` : ''}
            </div>
          </div>
        `;
      } else if (isVisited) {
        actualInfoHtml = `
          <div class="actual-info visited">
            <div class="actual-header">
              <span class="actual-label">✅ 방문 완료</span>
              <span>🕒 ${item.actual_start_time || item.start_time} ~ ${item.actual_end_time || item.end_time}</span>
            </div>
            ${item.actual_spend ? `<span class="actual-spend">💰 실제 지출: ${item.actual_spend.toLocaleString()}${currencyUnit}</span>` : ''}
            ${item.actual_notes ? `<p class="actual-note">📝 ${item.actual_notes}</p>` : ''}
          </div>
        `;
      }

      // Card Element
      const card = document.createElement('div');
      card.className = `timeline-card ${isSkipped ? 'skipped' : ''} ${isVisited ? 'visited' : ''}`;
      card.setAttribute('data-id', item.id);
      card.setAttribute('data-category', item.category);
      card.setAttribute('data-status', status);
      
      const titleStyle = isSkipped ? 'text-decoration: line-through; opacity: 0.55;' : '';
      
      card.innerHTML = `
        <div class="card-timeline-node">
          <span class="step-num">${validItemIndex++}</span>
        </div>
        <div class="card-time">
          <span class="time-start">${item.start_time || '--:--'}</span>
          <span class="time-end">${item.end_time ? '~ ' + item.end_time : ''}</span>
        </div>
        <div class="card-body">
          <div class="card-header">
            <span class="card-category-badge cat-${item.category}">
              <span class="cat-icon">${emoji}</span>
              <span class="cat-text">${label}</span>
            </span>
            <h3 class="card-title" style="${titleStyle}">${item.title}</h3>
          </div>
          ${item.description ? `<p class="card-desc">${item.description}</p>` : ''}
          <div class="card-meta">
            ${item.address ? `
              <span class="card-address" onclick="TripSync.map.openInMaps(${item.lat}, ${item.lng}, '${item.title}')" title="지도 앱에서 열기">
                📍 ${item.address}
              </span>
            ` : ''}
            ${item.budget ? `<span class="card-budget">예상 ${item.budget.toLocaleString()}${currencyUnit}</span>` : ''}
          </div>
          ${actualInfoHtml}
          
          <div class="card-actions no-print">
            <button class="btn-card-action" title="일정 세부 정보 수정 (링크, 시간, 메모 등)" onclick="TripSync.editor.showEditModal('${item.id}')">✏️ 수정</button>
            ${(item.lat && item.lng) ? `
              <button class="btn-card-action" title="동선 지도에서 위치 보기" onclick="TripSync.map.focusMarker('${item.id}')">📍 위치</button>
              <button class="btn-card-action" title="구글 지도 앱에서 열기" onclick="TripSync.map.openInMaps(${item.lat}, ${item.lng}, '${item.title.replace(/'/g, "\\'")}')">🗺️ 구글맵</button>
              <button class="btn-card-action btn-amap" title="중국 고덕지도(高德地图)로 열기" onclick="TripSync.map.openInAmap(${item.lat}, ${item.lng}, '${item.title.replace(/'/g, "\\'")}')">🇨🇳 고덕지도</button>
            ` : (item.google_maps_link ? `
              <a class="btn-card-action" href="${item.google_maps_link}" target="_blank" title="구글맵 링크 열기">🗺️ 지도링크</a>
            ` : '')}
            <button class="btn-card-action" title="iOS 캘린더 알림 다운로드" onclick="TripSync.calendar.downloadItem('${item.id}')">📅 캘린더</button>
            ${item.booking_link ? `<a class="btn-card-action" href="${item.booking_link}" target="_blank" title="예약 페이지 열기">🔗 예약</a>` : ''}
            <button class="btn-card-action btn-add-photo" onclick="TripSync.photos.showUploadModal('${item.id}')" title="가족 사진 추가">📸 사진</button>
          </div>
          
          <div class="card-photos" data-id="${item.id}"></div>
        </div>
        
        <div class="edit-actions" style="display: ${window.TripSync.state.editMode ? 'flex' : 'none'};">
          <button class="btn-edit-action drag-handle" title="드래그하여 순서 변경">☰ 순서</button>
          <button class="btn-edit-action btn-edit-details" onclick="TripSync.editor.showEditModal('${item.id}')" title="세부 정보 수정">✏️ 수정</button>
          <button class="btn-edit-action btn-visited" onclick="TripSync.editor.markVisited('${item.id}')">✅ 완료</button>
          <button class="btn-edit-action btn-skipped" onclick="TripSync.editor.markSkipped('${item.id}')">⏭️ 스킵</button>
          <button class="btn-edit-action btn-changed" onclick="TripSync.editor.showChangeModal('${item.id}')" title="다른 장소로 대체">🔄 대체</button>
          <button class="btn-edit-action btn-delete" onclick="TripSync.editor.deleteItem('${item.id}')">🗑️</button>
        </div>
      `;
      
      container.appendChild(card);
      
      if (index < items.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'timeline-connector';
        container.appendChild(connector);
      }
    });

    if (window.TripSync.photos && typeof window.TripSync.photos.renderThumbnails === 'function') {
      window.TripSync.photos.renderThumbnails();
    }
  },
  
  toggleEditMode() {
    window.TripSync.state.editMode = !window.TripSync.state.editMode;
    const isEdit = window.TripSync.state.editMode;
    
    // Toggle edit actions visibility
    document.querySelectorAll('.edit-actions').forEach(el => {
      el.style.display = isEdit ? 'flex' : 'none';
    });
    
    // Update FAB icon if needed
    const fab = document.getElementById('fab');
    if (fab) {
      fab.innerHTML = isEdit ? '✅ 완료' : '✏️ 편집';
    }
    
    // Initialize or destroy SortableJS
    if (isEdit && window.TripSync.editor && typeof window.TripSync.editor.initSortable === 'function') {
      window.TripSync.editor.initSortable();
    }
  },
  
  renderSummary() {
    const summarySection = document.getElementById('summary-section');
    if (!summarySection) return;
    
    const trip = window.TripSync.state.currentTrip;
    if (!trip) return;
    
    let html = '';
    
    // 1. Gather all flights (from trip.flights + itinerary flight items)
    const flightsList = [...(trip.flights || [])];
    const seenFlightTitles = new Set(flightsList.map(f => `${f.dep_airport}_${f.arr_airport}_${f.dep_datetime}`));
    
    (trip.itinerary || []).forEach(item => {
      if (item.category === 'flight') {
        const key = `${item.title}_${item.date}_${item.start_time}`;
        if (!seenFlightTitles.has(key)) {
          seenFlightTitles.add(key);
          flightsList.push({
            dep_airport: item.title,
            arr_airport: '',
            airline: item.notes || '',
            flight_no: '',
            dep_datetime: `${item.date} ${item.start_time}`,
            arr_datetime: `${item.date} ${item.end_time}`,
            booking_ref: item.booking_link || ''
          });
        }
      }
    });

    if (flightsList.length > 0) {
      html += '<div class="summary-card flights-summary" style="background:#fff; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.06);"><h4 style="margin-bottom:14px; color:#2d3748; font-size:1.1rem; display:flex; align-items:center; gap:8px;">✈️ 항공편 정보</h4><ul style="list-style:none; padding:0; margin:0;">';
      flightsList.forEach(f => {
        const dep = f.dep_airport || f.departure_airport || '';
        const arr = f.arr_airport || f.arrival_airport || '';
        const routeText = arr ? `${dep} ➔ ${arr}` : dep;
        const depTime = f.dep_datetime || f.departure_time || '';
        const arrTime = f.arr_datetime || f.arrival_time || '';
        const airlineInfo = [f.airline, f.flight_no].filter(Boolean).join(' ');
        
        html += `
          <li style="padding: 12px 0; border-bottom: 1px solid #edf2f7;">
            <strong style="font-size:1rem; color:#2d3748;">${routeText}</strong> ${airlineInfo ? `<span style="color:#4A90D9; font-weight:600;">(${airlineInfo})</span>` : ''}<br>
            <span style="font-size: 0.85rem; color: #718096;">출발: ${depTime} ${arrTime ? `| 도착: ${arrTime}` : ''}</span>
            ${f.booking_ref ? `<br><span style="font-size:0.8rem; color:#4a5568;">예약/참고: ${f.booking_ref.startsWith('http') ? `<a href="${f.booking_ref}" target="_blank" rel="noopener">예약 링크 열기 ↗</a>` : f.booking_ref}</span>` : ''}
          </li>
        `;
      });
      html += '</ul></div>';
    }
    
    // 2. Gather all accommodations (from trip.accommodations + itinerary accommodation items)
    const accomList = [...(trip.accommodations || [])];
    const seenAccomNames = new Set(accomList.map(a => `${a.name}_${a.check_in}`));
    
    (trip.itinerary || []).forEach(item => {
      if (item.category === 'accommodation') {
        const key = `${item.title}_${item.date}`;
        if (!seenAccomNames.has(key)) {
          seenAccomNames.add(key);
          accomList.push({
            name: item.title,
            check_in: `${item.date} ${item.start_time}`,
            check_out: `${item.date} ${item.end_time}`,
            address: item.address || item.description || '',
            lat: item.lat,
            lng: item.lng,
            booking_link: item.booking_link || '',
            phone: '',
            notes: item.notes || item.description || ''
          });
        }
      }
    });

    if (accomList.length > 0) {
      html += '<div class="summary-card accom-summary" style="background:#fff; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.06);"><h4 style="margin-bottom:14px; color:#2d3748; font-size:1.1rem; display:flex; align-items:center; gap:8px;">🏨 숙소 정보</h4><ul style="list-style:none; padding:0; margin:0;">';
      accomList.forEach(a => {
        html += `
          <li style="padding: 14px 0; border-bottom: 1px solid #edf2f7;">
            <strong style="font-size: 1.05rem; color: #2d3748;">${a.name}</strong><br>
            <span style="font-size: 0.85rem; color: #718096; display:inline-block; margin-top:4px;">체크인: ${a.check_in || '-'} ${a.check_out ? `| 체크아웃: ${a.check_out}` : ''}</span><br>
            ${a.address ? `<span style="font-size:0.85rem; color:#4a5568; display:inline-block; margin-top:4px;">📍 ${a.lat && a.lng ? `<a href="#" style="color:#4A90D9; text-decoration:none;" onclick="TripSync.map.openInMaps(${a.lat}, ${a.lng}, '${a.name}'); return false;">${a.address} (지도보기)</a>` : a.address}</span><br>` : ''}
            ${a.phone ? `<span style="font-size:0.8rem; color:#718096;">📞 전화: ${a.phone}</span><br>` : ''}
            ${a.booking_link ? `<span style="font-size:0.8rem;"><a href="${a.booking_link}" target="_blank" rel="noopener" style="color:#4A90D9;">예약 페이지 바로가기 ↗</a></span>` : ''}
          </li>
        `;
      });
      html += '</ul></div>';
    }
    
    // 3. Empty State if none
    if (!html) {
      html = `
        <div class="summary-empty-card" style="background:#fff; border-radius:16px; padding:40px 20px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-top:12px;">
          <div style="font-size:3rem; margin-bottom:16px;">🏨 ✈️</div>
          <h4 style="margin-bottom:8px; color:#2d3748; font-size:1.2rem; font-weight:700;">등록된 항공편이나 숙소 정보가 없습니다</h4>
          <p style="color:#718096; font-size:0.95rem; margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto;">
            우측 상단의 <strong>➕ 추가</strong> 버튼을 눌러 숙소(호텔)나 항공편 일정을 등록해보세요!
          </p>
          <button class="btn-primary" onclick="TripSync.editor.showAddModal()" style="padding:10px 22px; font-size:0.95rem;">➕ 새 숙소/항공 추가하기</button>
        </div>
      `;
    }

    summarySection.innerHTML = html;
  }
};
