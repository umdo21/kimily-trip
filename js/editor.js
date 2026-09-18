window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;
window.TripSync.api = window.TripSync.api || {};

// Smart Parser Helper for Links, Places & Booking Info
function parseSmartInput(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  const res = {
    title: '',
    category: 'attraction',
    icon: '📍',
    google_maps_link: '',
    booking_link: '',
    lat: null,
    lng: null,
    start_time: '',
    end_time: '',
    budget: 0,
    description: '',
    detectedType: ''
  };

  // 1. Google Maps URL matching
  const gmapUrlMatch = text.match(/https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)[^\s)]+/i);
  if (gmapUrlMatch) {
    const url = gmapUrlMatch[0];
    res.google_maps_link = url;
    res.detectedType = '구글 지도 장소';
    
    // Check coordinates in URL (@lat,lng or q=lat,lng)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      res.lat = parseFloat(atMatch[1]);
      res.lng = parseFloat(atMatch[2]);
    } else {
      const qMatch = url.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        res.lat = parseFloat(qMatch[1]);
        res.lng = parseFloat(qMatch[2]);
      }
    }

    // Place Name extraction from /place/NAME/
    const placeMatch = url.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      try {
        res.title = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).split(',')[0].trim();
      } catch(e) {
        res.title = placeMatch[1].replace(/\+/g, ' ').split(',')[0].trim();
      }
    }
  }

  // 2. Flight parsing (run on non-URL text only to avoid numeric coordinate collisions)
  const nonUrlText = text.replace(/https?:\/\/[^\s]+/g, ' ').trim();
  const flightMatch = nonUrlText.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공|피치항공|일본항공|전일본공수|JAL|ANA|델타항공|유나이티드)?\s*\b(KE|OZ|7C|LJ|TW|BX|RS|ZE|JL|NH|DL|UA|AA|SQ|CX|VN|TG)\s*([0-9]{3,4})\b/i) ||
                      nonUrlText.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공|피치항공)\s*([0-9]{3,4})\b/i);

  if (flightMatch) {
    const airline = flightMatch[1] || '';
    const code = flightMatch[2] ? `${flightMatch[2].toUpperCase()}${flightMatch[3]}` : (flightMatch[1] + ' ' + flightMatch[2]);
    res.title = `${airline} ${code}`.trim();
    res.category = 'flight';
    res.icon = '✈️';
    res.detectedType = '항공편';
  }

  // 3. Ticket Link & Booking Reference
  const bookingMatch = nonUrlText.match(/(예약번호|예약코드|티켓번호|확인번호|Booking Ref|Confirmation)\s*[:：]?\s*([A-Za-z0-9-]+)/i);
  if (bookingMatch) {
    res.description = `예약번호: ${bookingMatch[2]}`;
    if (!res.detectedType) res.detectedType = '예약 정보';
  }

  const ticketUrlMatch = text.match(/https?:\/\/(www\.)?(klook\.com|kkday\.com|agoda\.com|booking\.com|airbnb\.com|hotels\.com|naver\.com)[^\s)]+/i);
  if (ticketUrlMatch) {
    res.booking_link = ticketUrlMatch[0];
    const domain = ticketUrlMatch[2].toLowerCase();
    if (domain.includes('agoda') || domain.includes('booking') || domain.includes('airbnb') || domain.includes('hotels')) {
      res.category = 'accommodation';
      res.icon = '🏨';
      if (!res.detectedType) res.detectedType = '숙소 예약 링크';
    } else if (domain.includes('klook') || domain.includes('kkday')) {
      res.category = 'attraction';
      res.icon = '🎟️';
      if (!res.detectedType) res.detectedType = '티켓 예약 링크';
    }
  }

  // If title not yet set from URL or flight, check nonUrlText
  if (!res.title && nonUrlText) {
    res.title = nonUrlText
      .replace(/^\[[^\]]+\]\s*/, '')
      .split('\n')[0]
      .replace(/\b([0-1]?[0-9]|2[0-3]):[0-5][0-9]\b/g, '')
      .replace(/(예약번호|예약코드|티켓번호|확인번호|Booking Ref)[^,]*/gi, '')
      .replace(/[-~–]\s*$/g, '')
      .trim();
  }

  // 4. Time extraction (HH:MM)
  const timeMatches = nonUrlText.match(/\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/g);
  if (timeMatches && timeMatches.length >= 1) {
    res.start_time = timeMatches[0];
    if (timeMatches.length >= 2) {
      res.end_time = timeMatches[1];
    }
  }

  // 5. Category & Icon auto-detection from keywords (if not flight)
  const targetForCat = `${res.title} ${text}`;
  if (res.category !== 'flight') {
    if (/호텔|리조트|호스텔|펜션|스테이|민박|게스트하우스|Hotel|Inn|Resort/i.test(targetForCat)) {
      res.category = 'accommodation';
      res.icon = '🏨';
    } else if (/카페|커피|디저트|베이커리|스타벅스|Tea|Cafe|Coffee|Bakery/i.test(targetForCat)) {
      res.category = 'cafe';
      res.icon = '☕';
    } else if (/라멘|식당|스시|초밥|고기|갈비|국수|우동|이자카야|파스타|피자|레스토랑|맛집|Restaurant|Diner/i.test(targetForCat)) {
      res.category = 'restaurant';
      res.icon = '🍽️';
    } else if (/쇼핑|돈키호테|백화점|마트|시장|아울렛|몰|Store|Shop|Mall|Market/i.test(targetForCat)) {
      res.category = 'shopping';
      res.icon = '🛍️';
    } else if (/공항|역|열차|라피트|하루카|버스|지하철|렌터카|택시|Station|Airport|Line/i.test(targetForCat)) {
      res.category = 'transport';
      res.icon = '🚅';
    } else if (/USJ|유니버설|디즈니|전망대|성|신사|사원|박물관|미술관|공원|수족관|아쿠아리움|온천|타워|Castle|Park/i.test(targetForCat)) {
      res.category = 'attraction';
      res.icon = '🏛️';
    }
  }

  // Clean title
  if (res.title) {
    res.title = res.title.replace(/\s{2,}/g, ' ').trim();
  }

  return res;
}

window.TripSync.editor = {
  _getItem(itemId) {
    const items = window.TripSync.getCurrentDayItems() || [];
    return items.find(i => String(i.id) === String(itemId));
  },

  markVisited(itemId) {
    const item = this._getItem(itemId);
    if (!item) return;
    
    const trip = window.TripSync.state.currentTrip;
    const currencyUnit = (trip && trip.info && trip.info.currency === 'JPY') ? '엔' : '원';
    
    const html = `
      <div class="editor-modal">
        <h3 style="font-size:1.25rem; font-weight:800; color:#0F172A; margin-bottom:4px;">✅ 방문 완료 기록</h3>
        <p style="font-size:0.88rem; color:#64748B; margin-bottom:16px;"><strong>${item.icon || '📍'} ${item.title}</strong></p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 시작 시간</label>
            <input type="time" id="visit_start" value="${item.start_time || ''}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 종료 시간</label>
            <input type="time" id="visit_end" value="${item.end_time || ''}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
        </div>
        
        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 지출 (${currencyUnit})</label>
          <input type="number" id="visit_spend" value="${item.budget || 0}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
        </div>
        
        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">방문 후기 메모</label>
          <input type="text" id="visit_notes" placeholder="예: 대기 15분, 아이들도 국물까지 완식!" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem;">
        </div>
        
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btn_visit_confirm" style="flex:1; padding:12px; border-radius:10px;">방문 완료 저장</button>
          <button class="btn-secondary" style="padding:12px 18px; border-radius:10px;" onclick="TripSync.hideModal()">취소</button>
        </div>
      </div>
    `;
    
    window.TripSync.showModal(html);
    
    document.getElementById('btn_visit_confirm').onclick = () => {
      const actual_start_time = document.getElementById('visit_start').value;
      const actual_end_time = document.getElementById('visit_end').value;
      const actual_spend = parseInt(document.getElementById('visit_spend').value || 0, 10);
      const actual_notes = document.getElementById('visit_notes').value;
      
      if (typeof window.TripSync.api.updateItem === 'function') {
        window.TripSync.api.updateItem(itemId, { 
          status: 'visited', 
          actual_start_time, 
          actual_end_time, 
          actual_spend,
          actual_notes
        });
      } else {
        item.status = 'visited';
        item.actual_start_time = actual_start_time;
        item.actual_end_time = actual_end_time;
        item.actual_spend = actual_spend;
        item.actual_notes = actual_notes;
      }
      
      window.TripSync.hideModal();
      window.TripSync.timeline.render();
      if (window.TripSync.map && window.TripSync.map.render) {
        window.TripSync.map.render();
      }
      window.TripSync.showToast('✅ 방문 완료로 표시했습니다', 'success');
    };
  },

  markSkipped(itemId) {
    const item = this._getItem(itemId);
    if (!item) return;

    const html = `
      <div class="editor-modal">
        <h3 style="font-size:1.25rem; font-weight:800; color:#0F172A; margin-bottom:4px;">⏭️ 일정 스킵</h3>
        <p style="font-size:0.88rem; color:#64748B; margin-bottom:16px;"><strong>${item.icon || '📍'} ${item.title}</strong></p>
        
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">스킵 사유</label>
          <textarea id="skip_reason" rows="3" placeholder="예: 비가 너무 많이 와서 실내로 변경, 아이 낮잠 등" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; resize:vertical;"></textarea>
        </div>
        
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btn_skip_confirm" style="flex:1; padding:12px; border-radius:10px;">스킵 확인</button>
          <button class="btn-secondary" style="padding:12px 18px; border-radius:10px;" onclick="TripSync.hideModal()">취소</button>
        </div>
      </div>
    `;
    
    window.TripSync.showModal(html);
    
    document.getElementById('btn_skip_confirm').onclick = () => {
      const reason = document.getElementById('skip_reason').value;
      
      if (typeof window.TripSync.api.updateItem === 'function') {
        window.TripSync.api.updateItem(itemId, { status: 'skipped', actual_notes: reason });
      } else {
        item.status = 'skipped';
        item.actual_notes = reason;
      }
      
      window.TripSync.hideModal();
      window.TripSync.timeline.render();
      if (window.TripSync.map && window.TripSync.map.render) {
        window.TripSync.map.render();
      }
      window.TripSync.showToast('⏭️ 일정을 스킵했습니다', 'info');
    };
  },

  showChangeModal(itemId) {
    const item = this._getItem(itemId);
    if (!item) return;

    const trip = window.TripSync.state.currentTrip;
    const currencyUnit = (trip && trip.info && trip.info.currency === 'JPY') ? '엔' : '원';

    const html = `
      <div class="editor-modal">
        <h3 style="font-size:1.25rem; font-weight:800; color:#0F172A; margin-bottom:4px;">🔄 일정 변경 (실제 방문지 입력)</h3>
        <p style="font-size:0.85rem; color:#64748B; margin-bottom:14px;">원래 계획: <del>${item.title}</del></p>
        
        <!-- Smart Auto Input Box -->
        <div class="smart-input-box">
          <div class="smart-input-header">
            <span class="smart-icon">⚡</span>
            <strong>스마트 링크 자동 완성</strong>
            <span class="smart-badge">구글맵 / 예약정보</span>
          </div>
          <div class="smart-input-row">
            <input type="text" id="change_smart_input" placeholder="새 장소의 구글맵 링크나 장소명을 붙여넣으세요" class="smart-text-input">
            <button type="button" id="btn_change_smart_parse" class="btn-smart-action">⚡ 분석</button>
          </div>
          <div id="change_smart_feedback" class="smart-parse-feedback" style="display:none;"></div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 방문 장소 이름</label>
          <input type="text" id="change_title" value="${item.actual_title || item.title}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
        </div>
        
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">구글맵 링크</label>
          <input type="url" id="change_link" value="${item.google_maps_link || ''}" placeholder="https://maps.app.goo.gl/..." style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem;">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 시작 시간</label>
            <input type="time" id="change_start" value="${item.actual_start_time || item.start_time || ''}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 종료 시간</label>
            <input type="time" id="change_end" value="${item.actual_end_time || item.end_time || ''}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
        </div>
        
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">실제 지출 (${currencyUnit})</label>
          <input type="number" id="change_spend" value="${item.actual_spend || item.budget || 0}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
        </div>
        
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">변경 사유 / 메모</label>
          <textarea id="change_notes" rows="2" placeholder="예: 현지 도착 후 웨이팅이 길어 옆집으로 변경" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; resize:vertical;">${item.actual_notes || ''}</textarea>
        </div>
        
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btn_change_confirm" style="flex:1; padding:12px; border-radius:10px;">변경 내용 저장</button>
          <button class="btn-secondary" style="padding:12px 18px; border-radius:10px;" onclick="TripSync.hideModal()">취소</button>
        </div>
      </div>
    `;
    
    window.TripSync.showModal(html);

    // Smart Parse for Change Modal
    let changeParsedLat = null;
    let changeParsedLng = null;
    const changeSmartInput = document.getElementById('change_smart_input');
    const changeFeedback = document.getElementById('change_smart_feedback');
    
    const doChangeParse = () => {
      const val = changeSmartInput.value;
      if (!val) return;
      const parsed = parseSmartInput(val);
      if (parsed) {
        if (parsed.title) document.getElementById('change_title').value = parsed.title;
        if (parsed.google_maps_link) document.getElementById('change_link').value = parsed.google_maps_link;
        if (parsed.start_time) document.getElementById('change_start').value = parsed.start_time;
        if (parsed.end_time) document.getElementById('change_end').value = parsed.end_time;
        if (parsed.lat && parsed.lng) {
          changeParsedLat = parsed.lat;
          changeParsedLng = parsed.lng;
        }
        changeFeedback.style.display = 'block';
        changeFeedback.innerHTML = `✨ 자동 인식 성공: <strong>${parsed.title || '장소'}</strong> ${parsed.lat ? `(위도: ${parsed.lat.toFixed(4)}, 경도: ${parsed.lng.toFixed(4)})` : ''}`;
      }
    };

    document.getElementById('btn_change_smart_parse').onclick = doChangeParse;
    changeSmartInput.addEventListener('paste', () => setTimeout(doChangeParse, 50));
    
    document.getElementById('btn_change_confirm').onclick = () => {
      const actual_title = document.getElementById('change_title').value;
      const google_maps_link = document.getElementById('change_link').value;
      const actual_start_time = document.getElementById('change_start').value;
      const actual_end_time = document.getElementById('change_end').value;
      const actual_notes = document.getElementById('change_notes').value;
      const actual_spend = parseInt(document.getElementById('change_spend').value || 0, 10);
      
      const updates = { 
        status: 'changed', 
        actual_title, 
        google_maps_link,
        actual_start_time, 
        actual_end_time, 
        actual_notes, 
        actual_spend 
      };
      if (changeParsedLat && changeParsedLng) {
        updates.lat = changeParsedLat;
        updates.lng = changeParsedLng;
      }
      
      if (typeof window.TripSync.api.updateItem === 'function') {
        window.TripSync.api.updateItem(itemId, updates);
      } else {
        Object.assign(item, updates);
      }
      
      window.TripSync.hideModal();
      window.TripSync.timeline.render();
      if (window.TripSync.map && window.TripSync.map.render) {
        window.TripSync.map.render();
      }
      window.TripSync.showToast('🔄 일정이 변경되었습니다', 'success');
    };
  },

  deleteItem(itemId) {
    if (confirm('이 일정을 삭제할까요?')) {
      if (typeof window.TripSync.api.updateItem === 'function') {
        window.TripSync.api.updateItem(itemId, { status: 'deleted' });
      } else {
        const item = this._getItem(itemId);
        if (item) item.status = 'deleted';
      }
      window.TripSync.timeline.render();
      if (window.TripSync.map && window.TripSync.map.render) {
        window.TripSync.map.render();
      }
      window.TripSync.showToast('🗑️ 일정이 삭제되었습니다', 'info');
    }
  },

  showAddModal() {
    const trip = window.TripSync.state.currentTrip;
    if (!trip) return;
    
    // Calculate default date for current selected Day
    let defaultDate = '';
    if (trip.info && trip.info.start_date) {
      const parts = String(trip.info.start_date).split('T')[0].split('-');
      const start = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      start.setDate(start.getDate() + (window.TripSync.state.currentDay || 0));
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const d = String(start.getDate()).padStart(2, '0');
      defaultDate = `${y}-${m}-${d}`;
    }
    
    const currencyUnit = (trip.info && trip.info.currency === 'JPY') ? '엔' : '원';
    
    const html = `
      <div class="editor-modal">
        <h3 style="font-size:1.3rem; font-weight:800; color:#0F172A; margin-bottom:6px;">➕ 새 일정 추가</h3>
        <p style="font-size:0.85rem; color:#64748B; margin-bottom:16px;">구글맵 링크나 예약번호를 붙여넣으면 내용이 자동으로 채워집니다.</p>

        <!-- Smart Auto Input Box -->
        <div class="smart-input-box">
          <div class="smart-input-header">
            <span class="smart-icon">⚡</span>
            <strong>스마트 링크 / 예약정보 자동 완성</strong>
            <span class="smart-badge">자동 감지</span>
          </div>
          <p class="smart-input-desc">구글 지도 공유 링크, 항공편명(KE723 등), 티켓 예약 링크/텍스트를 붙여넣으세요.</p>
          <div class="smart-input-row">
            <input type="text" id="smart_auto_input" placeholder="예: https://maps.app.goo.gl/... 또는 대한항공 KE723 09:00" class="smart-text-input">
            <button type="button" id="btn_smart_parse" class="btn-smart-action">⚡ 자동 분석</button>
          </div>
          <div id="smart_parse_result" class="smart-parse-feedback" style="display:none;"></div>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">날짜</label>
            <input type="date" id="add_date" value="${defaultDate}" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.92rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">카테고리</label>
            <select id="add_category" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.92rem;">
              <option value="restaurant">🍽️ 식사</option>
              <option value="attraction" selected>🏛️ 관광</option>
              <option value="cafe">☕ 카페</option>
              <option value="shopping">🛍️ 쇼핑</option>
              <option value="transport">🚅 이동</option>
              <option value="accommodation">🏨 숙소</option>
              <option value="flight">✈️ 항공</option>
              <option value="free">⭐ 자유</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">시작 시간 *</label>
            <input type="time" id="add_start" value="10:00" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">종료 시간 *</label>
            <input type="time" id="add_end" value="11:30" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">장소 이름 *</label>
          <input type="text" id="add_title" placeholder="예: 오사카성, 이치란 라멘" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">구글맵 링크 / 주소</label>
          <input type="url" id="add_link" placeholder="https://maps.app.goo.gl/..." style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem;">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">예상 예산 (${currencyUnit})</label>
            <input type="number" id="add_budget" value="0" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">아이콘 이모지</label>
            <input type="text" id="add_icon" placeholder="예: 🏯, 🍜" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem; text-align:center;">
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">메모 / 예약 세부정보</label>
          <textarea id="add_desc" rows="2" placeholder="예약번호, 찾아가는 길, 가족 팁 등" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; resize:vertical;"></textarea>
        </div>
        
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btn_add_confirm" style="flex:1; padding:13px; font-size:0.95rem; border-radius:10px;">일정 추가하기</button>
          <button class="btn-secondary" style="padding:13px 18px; font-size:0.95rem; border-radius:10px;" onclick="TripSync.hideModal()">취소</button>
        </div>
      </div>
    `;
    
    window.TripSync.showModal(html);

    let parsedLat = null;
    let parsedLng = null;
    let parsedBookingLink = '';

    const smartInput = document.getElementById('smart_auto_input');
    const resultBox = document.getElementById('smart_parse_result');

    const handleSmartParse = () => {
      const val = (smartInput.value || '').trim();
      if (!val) return;
      const parsed = parseSmartInput(val);
      if (parsed) {
        if (parsed.title) document.getElementById('add_title').value = parsed.title;
        if (parsed.category) document.getElementById('add_category').value = parsed.category;
        if (parsed.icon) document.getElementById('add_icon').value = parsed.icon;
        if (parsed.google_maps_link) document.getElementById('add_link').value = parsed.google_maps_link;
        if (parsed.start_time) document.getElementById('add_start').value = parsed.start_time;
        if (parsed.end_time) document.getElementById('add_end').value = parsed.end_time;
        if (parsed.description) document.getElementById('add_desc').value = parsed.description;
        if (parsed.budget) document.getElementById('add_budget').value = parsed.budget;
        if (parsed.lat && parsed.lng) {
          parsedLat = parsed.lat;
          parsedLng = parsed.lng;
        }
        if (parsed.booking_link) {
          parsedBookingLink = parsed.booking_link;
        }

        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div style="font-weight:700; color:#1D4ED8; margin-bottom:2px;">
            ⚡ ${parsed.detectedType || '자동 분석 완료'}: <strong>${parsed.title || '장소'}</strong>
          </div>
          <div style="font-size:0.8rem; color:#475569;">
            카테고리: ${parsed.category} ${parsed.icon} ${parsed.lat ? `· 좌표: (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)})` : ''}
          </div>
        `;
      }
    };

    document.getElementById('btn_smart_parse').onclick = handleSmartParse;
    smartInput.addEventListener('paste', () => setTimeout(handleSmartParse, 50));
    smartInput.addEventListener('change', handleSmartParse);
    
    document.getElementById('btn_add_confirm').onclick = () => {
      const date = document.getElementById('add_date').value;
      const start_time = document.getElementById('add_start').value;
      const end_time = document.getElementById('add_end').value;
      const category = document.getElementById('add_category').value;
      const title = document.getElementById('add_title').value;
      const google_maps_link = document.getElementById('add_link').value;
      const description = document.getElementById('add_desc').value;
      const budget = parseInt(document.getElementById('add_budget').value || 0, 10);
      const icon = document.getElementById('add_icon').value;
      
      if (!title || !start_time || !end_time) {
        alert('장소 이름과 시간은 필수입니다.');
        return;
      }
      
      const tripId = trip.trip_id || trip.id || (trip.info && trip.info.trip_id);
      
      const newItem = {
        id: 'itm_' + new Date().getTime(),
        trip_id: tripId, 
        date, 
        start_time, 
        end_time, 
        category, 
        title, 
        google_maps_link, 
        description, 
        budget, 
        icon, 
        lat: parsedLat, 
        lng: parsedLng,
        booking_link: parsedBookingLink,
        status: 'planned',
        sort_order: (trip.itinerary || []).length + 1
      };
      
      // Save via API (optimistic update handles memory & cache)
      if (typeof window.TripSync.api.addItem === 'function') {
        window.TripSync.api.addItem(newItem).catch(e => {
          console.warn('Backend addItem failed or offline, saved locally', e);
        });
      } else {
        if (!trip.itinerary) trip.itinerary = [];
        trip.itinerary.push(newItem);
      }
      
      window.TripSync.hideModal();
      window.TripSync.timeline.render();
      if (window.TripSync.map && window.TripSync.map.render) {
        window.TripSync.map.render();
      }
      window.TripSync.showToast('✅ 새 일정이 추가되었습니다!', 'success');
    };
  },

  initSortable() {
    const el = document.getElementById('timeline-section');
    if (!el) return;
    
    if (typeof Sortable !== 'undefined') {
      if (this._sortableInstance) {
        this._sortableInstance.destroy();
      }
      
      this._sortableInstance = Sortable.create(el, {
        handle: '.drag-handle',
        animation: 150,
        onEnd: (evt) => {
          const newOrder = Array.from(el.querySelectorAll('.timeline-card')).map(card => card.getAttribute('data-id'));
          if (typeof window.TripSync.api.reorderItems === 'function') {
            window.TripSync.api.reorderItems(newOrder);
          }
          window.TripSync.showToast('순서가 변경되었습니다', 'success');
        }
      });
    }
  }
};
