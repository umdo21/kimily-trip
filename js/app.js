window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;

// Preserve existing modules, setup config and state
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwNvCUcA7SkLg2niX-OcU1scLECP4OqYOGfynOUqu3tIdjGcLmgWeUZvc3WOlBRhgXG/exec';

window.TripSync.config = window.TripSync.config || {
  SCRIPT_URL: localStorage.getItem('KimilyTrip_SCRIPT_URL') || localStorage.getItem('TripSync_SCRIPT_URL') || DEFAULT_SCRIPT_URL,
  MAPS_API_KEY: localStorage.getItem('KimilyTrip_MAPS_API_KEY') || localStorage.getItem('TripSync_MAPS_API_KEY') || '',
};

window.TripSync.state = window.TripSync.state || {
  trips: [],
  currentTripId: null,
  currentTrip: null,
  currentDay: 0,
  currentView: 'timeline', // 'timeline' | 'gallery' | 'summary'
  editMode: false,
  viewMode: 'plan', // 'plan' | 'memory' | 'ongoing'
  loading: false,
};

window.TripSync.showToast = function(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `show ${type}`;
  setTimeout(() => {
    toast.className = '';
  }, 3200);
};

window.TripSync.setLoading = function(loading) {
  window.TripSync.state.loading = loading;
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.classList.toggle('active', loading);
};

window.TripSync.showModal = function(htmlContent) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  content.innerHTML = `
    <button onclick="TripSync.hideModal()" style="position:absolute; top:16px; right:16px; background:#F1F5F9; border:none; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; color:#64748B; display:flex; align-items:center; justify-content:center; transition:background 0.2s;" title="닫기">✕</button>
    ${htmlContent}
  `;
  overlay.classList.add('active');
};

window.TripSync.hideModal = function() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('active');
};

async function init() {
  // 1. Instant Render from local cache (0ms perceived load time)
  const cachedTrips = window.TripSync.api.getCachedTrips();
  if (cachedTrips && cachedTrips.length > 0) {
    window.TripSync.state.trips = cachedTrips;
    populateTripSelector();
    handleRoute(true); // silent / instant route handle
  } else {
    window.TripSync.setLoading(true);
  }

  try {
    const trips = await window.TripSync.api.loadTrips();
    window.TripSync.state.trips = trips || [];
    
    if (window.TripSync.state.trips.length === 0) {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.style.display = 'block';
    } else {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.style.display = 'none';
      populateTripSelector();
      await handleRoute(false);
    }
  } catch (error) {
    console.error('Initialization error:', error);
  } finally {
    window.TripSync.setLoading(false);
  }
  
  window.addEventListener('hashchange', () => handleRoute(false));
  
  const tripSelect = document.getElementById('trip-selector');
  if (tripSelect) {
    tripSelect.addEventListener('change', (e) => {
      if (e.target.value === '__NEW_TRIP__') {
        window.TripSync.showNewTripModal();
        e.target.value = window.TripSync.state.currentTripId || '';
        return;
      }
      onTripChange(e.target.value);
    });
  }
  
  // Setup FAB
  setupFab();
  
  // Notice only once if using demo mode without configured SCRIPT_URL
  if (!window.TripSync.config.SCRIPT_URL && !localStorage.getItem('KimilyTrip_demo_notified')) {
    setTimeout(() => {
      window.TripSync.showToast('✨ Kimily Trip 샘플 데이터를 불러왔습니다. 자유롭게 둘러보세요!', 'info');
      localStorage.setItem('KimilyTrip_demo_notified', 'true');
    }, 600);
  }
}

function setupFab() {
  const fab = document.getElementById('fab');
  if (!fab) return;
  const isEdit = window.TripSync.state.editMode;
  fab.innerHTML = `
    <button class="fab-btn ${isEdit ? 'active' : ''}" onclick="TripSync.toggleEditMode()" title="${isEdit ? '편집 완료' : '일정 편집'}">
      ${isEdit ? '<span>✅</span><span class="fab-label">완료</span>' : '<span>✏️</span><span class="fab-label">편집</span>'}
    </button>
  `;
}

window.TripSync.showSettings = function() {
  window.TripSync.showModal(`
    <div style="padding: 4px;">
      <h2 style="font-size: 1.3rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">⚙️ Kimily Trip 연동 설정</h2>
      <p style="font-size: 0.88rem; color: #64748B; margin-bottom: 20px; line-height: 1.5;">
        Google Sheets와 Google Maps API를 연동하여 우리 가족만의 전용 여행 플래너를 완성하세요.
      </p>
      <div style="margin-bottom: 16px;">
        <label style="display:block; font-weight: 700; font-size: 0.88rem; color: #334155; margin-bottom: 6px;">Google Apps Script 웹 앱 URL</label>
        <input type="text" id="setting-script-url" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%; padding:12px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; box-sizing:border-box; transition:border-color 0.2s;" value="${window.TripSync.config.SCRIPT_URL}">
        <small style="display:block; color: #94A3B8; font-size: 0.78rem; margin-top: 5px;">(apps-script/README.md 가이드에 따라 배포한 웹 앱 URL)</small>
      </div>
      <div style="margin-bottom: 24px;">
        <label style="display:block; font-weight: 700; font-size: 0.88rem; color: #334155; margin-bottom: 6px;">Google Maps API Key <span style="font-weight:normal; color:#94A3B8;">(선택)</span></label>
        <input type="text" id="setting-maps-key" placeholder="AIzaSy..." style="width:100%; padding:12px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; box-sizing:border-box; transition:border-color 0.2s;" value="${window.TripSync.config.MAPS_API_KEY}">
        <small style="display:block; color: #94A3B8; font-size: 0.78rem; margin-top: 5px;">(미입력 시에도 시각적 동선 뷰와 애플 지도/구글맵 앱 바로열기 100% 지원)</small>
      </div>
      <div style="display:flex; gap: 10px;">
        <button class="btn-primary" style="flex:1; padding: 13px; font-size: 0.95rem; border-radius: 10px;" onclick="saveSettings()">저장 후 연동하기</button>
        <button class="btn-secondary" style="padding: 13px 20px; font-size: 0.95rem; border-radius: 10px;" onclick="TripSync.hideModal()">닫기</button>
      </div>
    </div>
  `);
};

window.saveSettings = function() {
  const scriptUrl = (document.getElementById('setting-script-url').value || '').trim();
  const mapsKey = (document.getElementById('setting-maps-key').value || '').trim();
  localStorage.setItem('KimilyTrip_SCRIPT_URL', scriptUrl);
  localStorage.setItem('TripSync_SCRIPT_URL', scriptUrl);
  localStorage.setItem('KimilyTrip_MAPS_API_KEY', mapsKey);
  localStorage.setItem('TripSync_MAPS_API_KEY', mapsKey);
  // Clear cached trips so fresh data from the newly connected sheet is loaded
  localStorage.removeItem('KimilyTrip_cached_trips');
  window.TripSync.config.SCRIPT_URL = scriptUrl;
  window.TripSync.config.MAPS_API_KEY = mapsKey;
  window.TripSync.hideModal();
  location.reload();
};

window.TripSync.showNewTripModal = function() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const defaultStart = `${y}-${m}-${d}`;
  
  const later = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const ly = later.getFullYear();
  const lm = String(later.getMonth() + 1).padStart(2, '0');
  const ld = String(later.getDate()).padStart(2, '0');
  const defaultEnd = `${ly}-${lm}-${ld}`;

  const html = `
    <div style="padding: 4px;">
      <h2 style="font-size: 1.3rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">✈️ 새 여행 등록하기</h2>
      <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 18px; line-height: 1.4;">
        구글 시트를 열 필요 없이, 이곳에서 새로운 여행을 바로 생성할 수 있습니다.
      </p>

      <div style="margin-bottom: 14px;">
        <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">여행 이름 *</label>
        <input type="text" id="new_trip_name" placeholder="예: 2026 다낭 힐링 가족여행" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
      </div>

      <div style="margin-bottom: 14px;">
        <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">여행 목적지 *</label>
        <input type="text" id="new_trip_dest" placeholder="예: 베트남 다낭" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">시작일 *</label>
          <input type="date" id="new_trip_start" value="${defaultStart}" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.92rem;">
        </div>
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">종료일 *</label>
          <input type="date" id="new_trip_end" value="${defaultEnd}" required style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.92rem;">
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:12px; margin-bottom:14px;">
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">대표 이모지</label>
          <select id="new_trip_emoji" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
            <option value="✈️">✈️ 비행기</option>
            <option value="🇻🇳">🇻🇳 베트남</option>
            <option value="🇯🇵">🇯🇵 일본</option>
            <option value="🇹🇭">🇹🇭 태국</option>
            <option value="🇨🇳">🇨🇳 중국</option>
            <option value="🇺🇸">🇺🇸 미국</option>
            <option value="🇪🇺">🇪🇺 유럽</option>
            <option value="🏝️">🏝️ 휴양지</option>
            <option value="🍊">🍊 제주</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">통화 단위</label>
          <select id="new_trip_currency" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
            <option value="KRW">KRW (원)</option>
            <option value="JPY">JPY (엔)</option>
            <option value="USD">USD (달러)</option>
            <option value="VND">VND (동)</option>
            <option value="CNY">CNY (위안)</option>
            <option value="EUR">EUR (유로)</option>
          </select>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display:block; font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:4px;">참여 가족 구성원</label>
        <input type="text" id="new_trip_members" value="아빠, 엄마, 하온, 하겸" style="width:100%; padding:10px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.95rem;">
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn-primary" id="btn_create_trip_submit" style="flex:1; padding:13px; font-size:0.95rem; border-radius:10px;">여행 생성하고 시작하기</button>
        <button class="btn-secondary" style="padding:13px 18px; font-size:0.95rem; border-radius:10px;" onclick="TripSync.hideModal()">취소</button>
      </div>
    </div>
  `;

  window.TripSync.showModal(html);

  document.getElementById('btn_create_trip_submit').onclick = async () => {
    const name = (document.getElementById('new_trip_name').value || '').trim();
    const dest = (document.getElementById('new_trip_dest').value || '').trim();
    const start_date = document.getElementById('new_trip_start').value;
    const end_date = document.getElementById('new_trip_end').value;
    const cover_emoji = document.getElementById('new_trip_emoji').value;
    const currency = document.getElementById('new_trip_currency').value;
    const members = document.getElementById('new_trip_members').value;

    if (!name || !dest || !start_date || !end_date) {
      alert('여행 이름, 목적지, 시작일, 종료일을 모두 입력해주세요.');
      return;
    }

    const tripId = 'trip_' + Date.now().toString(36);
    const newTrip = {
      trip_id: tripId,
      trip_name: name,
      destination: dest,
      start_date,
      end_date,
      status: 'planning',
      cover_emoji,
      members,
      currency,
      timezone: 'Asia/Seoul'
    };

    window.TripSync.hideModal();
    await window.TripSync.api.addTrip(newTrip);
    populateTripSelector();
    window.location.hash = `#/${tripId}/day/0`;
    window.TripSync.showToast(`✨ ${name} 여행이 생성되었습니다!`, 'success');
  };
};

function populateTripSelector() {
  const select = document.getElementById('trip-selector');
  if (!select) return;
  const list = window.TripSync.state.trips || [];
  const itemsHtml = list.map(t => {
    const id = t.trip_id || t.id;
    const name = t.trip_name || t.name;
    const emoji = t.cover_emoji || '✈️';
    return `<option value="${id}">${emoji} ${name}</option>`;
  }).join('');
  select.innerHTML = itemsHtml + `<option value="__NEW_TRIP__">➕ 새 여행 등록...</option>`;
  if (window.TripSync.state.currentTripId) {
    select.value = window.TripSync.state.currentTripId;
  }
}

async function handleRoute(silent = false) {
  const hash = window.location.hash.replace('#/', '').split('/');
  let tripId = hash[0];
  let view = hash[1] || 'day';
  let param = hash[2] || '0';
  
  if (!tripId && window.TripSync.state.trips.length > 0) {
    const firstTrip = window.TripSync.state.trips[0];
    tripId = firstTrip.trip_id || firstTrip.id;
    view = 'day';
    param = '0';
    try {
      history.replaceState(null, '', `#/${tripId}/day/0`);
    } catch(e) {
      window.location.hash = `#/${tripId}/day/0`;
    }
  }
  
  // If trip changed or not yet loaded
  if (tripId && (!window.TripSync.state.currentTrip || tripId !== window.TripSync.state.currentTripId)) {
    window.TripSync.state.currentTripId = tripId;
    const select = document.getElementById('trip-selector');
    if (select) select.value = tripId;
    
    // Check cached trip first for instant display without spinner
    const cachedTrip = window.TripSync.api.getCachedTrip(tripId);
    if (cachedTrip && cachedTrip.info) {
      window.TripSync.state.currentTrip = cachedTrip;
      const status = (cachedTrip.info && cachedTrip.info.status) || 'planning';
      renderStatusBadge(status);
      window.TripSync.state.viewMode = determineViewMode(cachedTrip);
    } else {
      if (!silent) window.TripSync.setLoading(true);
    }

    try {
      const trip = await window.TripSync.api.loadTrip(tripId);
      window.TripSync.state.currentTrip = trip;
      
      const status = (trip.info && trip.info.status) || 'planning';
      renderStatusBadge(status);
      window.TripSync.state.viewMode = determineViewMode(trip);
    } catch(err) {
      console.error('Failed to load trip', err);
    } finally {
      window.TripSync.setLoading(false);
    }
  }
  
  if (!window.TripSync.state.currentTrip) return;
  
  if (view === 'day') {
    window.TripSync.state.currentDay = parseInt(param, 10) || 0;
    renderDayTabs(window.TripSync.state.currentTrip.info.start_date, window.TripSync.state.currentTrip.info.end_date);
    window.TripSync.switchView('timeline', false);
  } else if (view === 'gallery') {
    window.TripSync.switchView('gallery', false);
  } else if (view === 'summary') {
    window.TripSync.switchView('summary', false);
  }
}

function onTripChange(tripId) {
  window.location.hash = `#/${tripId}/day/0`;
}

window.TripSync.onDayChange = function(dayIndex) {
  window.location.hash = `#/${window.TripSync.state.currentTripId}/day/${dayIndex}`;
};

window.TripSync.switchView = function(viewName, updateHash = true) {
  window.TripSync.state.currentView = viewName;
  
  // Update view mode tabs active state
  document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-view-${viewName}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const timelineSection = document.getElementById('timeline-section');
  const mapSection = document.getElementById('map-section');
  const gallerySection = document.getElementById('gallery-section');
  const summarySection = document.getElementById('summary-section');
  const dayTabs = document.getElementById('day-tabs');
  const mainContent = document.getElementById('main-content');
  
  if (viewName === 'timeline') {
    if (dayTabs) dayTabs.style.display = 'flex';
    if (timelineSection) timelineSection.style.display = 'block';
    if (mapSection) mapSection.style.display = 'block';
    if (gallerySection) gallerySection.style.display = 'none';
    if (summarySection) summarySection.style.display = 'none';
    if (mainContent) mainContent.style.paddingTop = '165px';
    
    if (window.TripSync.timeline && window.TripSync.timeline.render) {
      window.TripSync.timeline.render();
    }
    if (window.TripSync.map && window.TripSync.map.render) {
      window.TripSync.map.render();
    }
    if (updateHash) {
      window.location.hash = `#/${window.TripSync.state.currentTripId}/day/${window.TripSync.state.currentDay}`;
    }
  } else if (viewName === 'gallery') {
    if (dayTabs) dayTabs.style.display = 'none';
    if (timelineSection) timelineSection.style.display = 'none';
    if (mapSection) mapSection.style.display = 'none';
    if (gallerySection) gallerySection.style.display = 'grid';
    if (summarySection) summarySection.style.display = 'none';
    if (mainContent) mainContent.style.paddingTop = '115px';
    
    if (window.TripSync.photos && window.TripSync.photos.renderGallery) {
      window.TripSync.photos.renderGallery();
    }
    if (updateHash) {
      window.location.hash = `#/${window.TripSync.state.currentTripId}/gallery`;
    }
  } else if (viewName === 'summary') {
    if (dayTabs) dayTabs.style.display = 'none';
    if (timelineSection) timelineSection.style.display = 'none';
    if (mapSection) mapSection.style.display = 'none';
    if (gallerySection) gallerySection.style.display = 'none';
    if (summarySection) summarySection.style.display = 'block';
    if (mainContent) mainContent.style.paddingTop = '115px';
    
    if (window.TripSync.timeline && window.TripSync.timeline.renderSummary) {
      window.TripSync.timeline.renderSummary();
    }
    if (updateHash) {
      window.location.hash = `#/${window.TripSync.state.currentTripId}/summary`;
    }
  }
};

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).split('T')[0].split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderDayTabs(startDateStr, endDateStr) {
  const tabsContainer = document.getElementById('day-tabs');
  if (!tabsContainer) return;
  
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  let html = '';
  const daysKor = ['일', '월', '화', '수', '목', '금', '토'];
  
  for (let i = 0; i < diffDays; i++) {
    const d = new Date(start.getTime());
    d.setDate(d.getDate() + i);
    const dateDisplay = `${d.getMonth() + 1}/${d.getDate()} (${daysKor[d.getDay()]})`;
    const isActive = i === window.TripSync.state.currentDay ? 'active' : '';
    html += `<button class="day-tab ${isActive}" onclick="TripSync.onDayChange(${i})">Day ${i + 1} · ${dateDisplay}</button>`;
  }
  tabsContainer.innerHTML = html;
}

function renderStatusBadge(status) {
  const badge = document.getElementById('trip-status-badge');
  if (!badge) return;
  badge.className = 'badge ' + status;
  if (status === 'planning') badge.textContent = '📋 계획중';
  else if (status === 'ongoing') badge.textContent = '🧭 여행중';
  else if (status === 'completed') badge.textContent = '📸 완료';
  else badge.textContent = status;
}

function determineViewMode(trip) {
  if (!trip || !trip.info) return 'plan';
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const start = trip.info.start_date;
  const end = trip.info.end_date;
  
  if (trip.info.status === 'completed' || (end && end < todayStr)) return 'memory';
  if (trip.info.status === 'ongoing' || (start && end && start <= todayStr && end >= todayStr)) return 'ongoing';
  return 'plan';
}

window.TripSync.getCurrentDayItems = function() {
  if (!window.TripSync.state.currentTrip) return [];
  const trip = window.TripSync.state.currentTrip;
  if (!trip.info || !trip.info.start_date) return trip.itinerary || [];
  
  const start = parseLocalDate(trip.info.start_date);
  const targetDate = new Date(start.getTime());
  targetDate.setDate(targetDate.getDate() + (window.TripSync.state.currentDay || 0));
  const currentDateStr = formatLocalDate(targetDate);
  
  // Filter itinerary by matching date with deduplication
  const seenKeys = new Set();
  let items = [];
  (trip.itinerary || []).forEach(item => {
    const itemDate = (window.TripSync.api && window.TripSync.api.normalizeDateStr) 
      ? window.TripSync.api.normalizeDateStr(item.date) 
      : (item.date ? String(item.date).split('T')[0] : '');
    if (itemDate !== currentDateStr) return;
    const dedupeKey = item.id || `${itemDate}_${item.start_time}_${item.title}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      items.push(item);
    }
  });
  
  // Sort by start_time, then sort_order
  items.sort((a, b) => {
    if (a.start_time && b.start_time && a.start_time !== b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  return items;
};

window.TripSync.toggleEditMode = function() {
  if (window.TripSync.timeline && typeof window.TripSync.timeline.toggleEditMode === 'function') {
    window.TripSync.timeline.toggleEditMode();
  } else {
    window.TripSync.state.editMode = !window.TripSync.state.editMode;
  }
  setupFab();
};

window.TripSync.loadSampleTrip = async function() {
  window.TripSync.state.trips = await window.TripSync.api.loadTrips();
  populateTripSelector();
  window.location.hash = '#/osaka_2026/day/0';
};

document.addEventListener('DOMContentLoaded', init);
