window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;

window.TripSync.map = {
  _map: null,
  _markers: [],
  _polyline: null,
  
  init() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    
    if (typeof google === 'undefined' || !google.maps) {
      this.renderVisualRoute();
      return;
    }
    
    try {
      const defaultLocation = { lat: 34.6723, lng: 135.5005 }; // Osaka Shinsaibashi default
      
      this._map = new google.maps.Map(canvas, {
        center: defaultLocation,
        zoom: 13,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });
      this.render();
    } catch(e) {
      console.warn("Google Maps init failed, using visual route fallback:", e);
      this._map = null;
      this.renderVisualRoute();
    }
  },
  
  render() {
    if (!this._map) {
      this.renderVisualRoute();
      return;
    }
    
    // Clear existing
    this._markers.forEach(m => m.setMap(null));
    this._markers = [];
    if (this._polyline) {
      this._polyline.setMap(null);
    }
    
    const items = window.TripSync.getCurrentDayItems() || [];
    const pathCoordinates = [];
    const bounds = new google.maps.LatLngBounds();
    const isMemoryMode = window.TripSync.state.viewMode === 'memory';
    
    let markerIndex = 1;
    
    items.forEach(item => {
      if (!item.lat || !item.lng) return;
      if (item.status === 'deleted') return;
      
      const position = { lat: parseFloat(item.lat), lng: parseFloat(item.lng) };
      const isAccommodation = item.category === 'accommodation';
      const isSkipped = item.status === 'skipped';
      
      // Determine marker color
      let color = '#3182F6'; // modern electric blue
      if (isSkipped) color = '#94A3B8';
      else if (isAccommodation) color = '#F43F5E';
      else if (item.status === 'visited') color = '#10B981';
      else if (item.category === 'restaurant') color = '#FF6B4A';
      else if (item.category === 'cafe') color = '#D97706';
      
      const marker = new google.maps.Marker({
        position,
        map: this._map,
        label: {
          text: isAccommodation ? '🏨' : String(markerIndex++),
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
        title: item.title,
        _itemId: item.id
      });
      
      const infoHtml = `
        <div style="padding: 6px; font-family: 'Pretendard', sans-serif; min-width: 160px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color:#0F172A;">${item.icon || '📍'} ${item.title}</h4>
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">🕒 ${item.start_time || ''} ~ ${item.end_time || ''}</p>
          ${item.address ? `<p style="margin: 0 0 8px 0; font-size: 11px; color: #475569;">📍 ${item.address}</p>` : ''}
          <div style="display:flex; gap:4px;">
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; border-radius:4px;" onclick="TripSync.map.openInMaps(${item.lat}, ${item.lng}, '${item.title}')">
              지도앱 열기
            </button>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px; border-radius:4px;" onclick="TripSync.map.openDirections(${item.lat}, ${item.lng})">
              길찾기
            </button>
          </div>
        </div>
      `;
      
      const infoWindow = new google.maps.InfoWindow({ content: infoHtml });
      
      marker.addListener('click', () => {
        infoWindow.open(this._map, marker);
        const card = document.querySelector(`.timeline-card[data-id="${item.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight-pulse');
          setTimeout(() => { card.classList.remove('highlight-pulse'); }, 1800);
        }
      });
      
      this._markers.push(marker);
      if (!isSkipped) pathCoordinates.push(position);
      bounds.extend(position);
    });
    
    // Draw polyline
    if (pathCoordinates.length > 1) {
      this._polyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: isMemoryMode ? '#10B981' : '#3182F6',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: this._map
      });
      this._map.fitBounds(bounds);
    } else if (pathCoordinates.length === 1) {
      this._map.setCenter(pathCoordinates[0]);
      this._map.setZoom(15);
    }
  },
  
  renderVisualRoute() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    
    const items = window.TripSync.getCurrentDayItems() || [];
    const validItems = items.filter(i => i.status !== 'deleted');
    
    if (validItems.length === 0) {
      canvas.innerHTML = `
        <div class="visual-route-container empty">
          <p style="font-size: 24px; margin-bottom: 6px;">🗺️</p>
          <p style="font-size: 13px; color: #64748B;">이 날짜에 등록된 장소가 없습니다.</p>
        </div>
      `;
      return;
    }
    
    let stepsHtml = '';
    validItems.forEach((item, idx) => {
      const isSkipped = item.status === 'skipped';
      const isVisited = item.status === 'visited';
      const isChanged = item.status === 'changed';
      
      let badgeColor = '#3182F6';
      if (isSkipped) badgeColor = '#94A3B8';
      else if (isVisited) badgeColor = '#10B981';
      else if (item.category === 'restaurant') badgeColor = '#FF6B4A';
      else if (item.category === 'cafe') badgeColor = '#D97706';
      else if (item.category === 'accommodation') badgeColor = '#F43F5E';
      
      const displayTitle = isChanged ? (item.actual_title || item.title) : item.title;
      
      stepsHtml += `
        <div class="route-step-item" onclick="TripSync.map.focusTimelineCard('${item.id}')">
          <div class="route-step-badge" style="background:${badgeColor};">${idx + 1}</div>
          <div class="route-step-info">
            <div class="route-step-header">
              <span class="route-step-time">${item.start_time || ''}</span>
              <span class="route-step-title ${isSkipped ? 'strikethrough' : ''}">${item.icon || '📍'} ${displayTitle}</span>
              ${isVisited ? '<span class="status-pill visited">방문</span>' : ''}
              ${isSkipped ? '<span class="status-pill skipped">스킵</span>' : ''}
              ${isChanged ? '<span class="status-pill changed">변경</span>' : ''}
            </div>
            ${item.address ? `<div class="route-step-address">${item.address}</div>` : ''}
          </div>
          <div class="route-step-actions" onclick="event.stopPropagation();">
            ${(item.lat && item.lng) ? `
              <button class="btn-route-action" onclick="TripSync.map.openInMaps(${item.lat}, ${item.lng}, '${displayTitle.replace(/'/g, "\\'")}')" title="구글 지도 열기">🗺️</button>
              <button class="btn-route-action" onclick="TripSync.map.openDirections(${item.lat}, ${item.lng})" title="구글맵 길찾기">🧭</button>
              <button class="btn-route-action btn-route-amap" onclick="TripSync.map.openInAmap(${item.lat}, ${item.lng}, '${displayTitle.replace(/'/g, "\\'")}')" title="중국 고덕지도(高德地图)로 열기">🇨🇳</button>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    canvas.innerHTML = `
      <div class="visual-route-container">
        <div class="visual-route-header">
          <div>
            <h3 class="visual-route-heading">🗺️ 오늘의 추천 동선</h3>
            <span class="visual-route-sub">총 ${validItems.length}개 방문지 순서</span>
          </div>
          <div class="visual-route-top-actions">
            <button class="btn-route-all" onclick="TripSync.map.openAllInGoogleMaps()" title="구글 지도에서 전체 경로 열기">
              <span>구글맵 전체</span> ↗
            </button>
            <button class="btn-route-all btn-route-all-amap" onclick="TripSync.map.openAllInAmap()" title="중국 고덕지도(高德地图)로 열기">
              <span>🇨🇳 고덕지도</span>
            </button>
          </div>
        </div>
        <div class="visual-route-list">
          ${stepsHtml}
        </div>
      </div>
    `;
  },
  
  focusTimelineCard(itemId) {
    const card = document.querySelector(`.timeline-card[data-id="${itemId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('highlight-pulse');
      setTimeout(() => { card.classList.remove('highlight-pulse'); }, 1800);
    }
  },
  
  focusMarker(itemId) {
    if (this._map) {
      const marker = this._markers.find(m => String(m._itemId) === String(itemId));
      if (marker) {
        this._map.panTo(marker.getPosition());
        this._map.setZoom(16);
        google.maps.event.trigger(marker, 'click');
        return;
      }
    }
    this.focusTimelineCard(itemId);
  },
  
  openInMaps(lat, lng, title) {
    // 모든 기기(iOS, Android, PC/Mac)에서 일관되게 구글 지도로 열기
    const query = title ? `${encodeURIComponent(title)}` : `${lat},${lng}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title || '')}+${lat},${lng}`, '_blank');
  },
  
  openDirections(lat, lng) {
    // 모든 기기에서 구글 지도 길찾기로 열기
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  },

  openInAmap(lat, lng, title) {
    // 중국 여행 필수: 고덕지도 (高德地图, Amap)
    // WGS84 좌표를 고덕지도 GCJ02 좌표로 자동 변환 처리
    const name = encodeURIComponent(title || '목적지');
    const url = `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&coordinate=wgs84&callnative=1`;
    window.open(url, '_blank');
  },

  openAmapDirections(lat, lng, title) {
    // 고덕지도 길찾기
    const name = encodeURIComponent(title || '목적지');
    const url = `https://uri.amap.com/navigation?to=${lng},${lat},${name}&mode=car&coordinate=wgs84&callnative=1`;
    window.open(url, '_blank');
  },
  
  openAllInGoogleMaps() {
    const items = window.TripSync.getCurrentDayItems() || [];
    const valid = items.filter(i => i.lat && i.lng && i.status !== 'skipped' && i.status !== 'deleted');
    if (valid.length === 0) return;
    
    if (valid.length === 1) {
      this.openInMaps(valid[0].lat, valid[0].lng, valid[0].title);
      return;
    }
    
    const origin = `${valid[0].lat},${valid[0].lng}`;
    const destination = `${valid[valid.length - 1].lat},${valid[valid.length - 1].lng}`;
    const waypoints = valid.slice(1, -1).map(i => `${i.lat},${i.lng}`).join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? '&waypoints=' + encodeURIComponent(waypoints) : ''}`;
    window.open(url, '_blank');
  },

  openAllInAmap() {
    const items = window.TripSync.getCurrentDayItems() || [];
    const valid = items.filter(i => i.lat && i.lng && i.status !== 'skipped' && i.status !== 'deleted');
    if (valid.length === 0) return;
    const dest = valid[valid.length - 1];
    this.openInAmap(dest.lat, dest.lng, dest.title);
  }
};
