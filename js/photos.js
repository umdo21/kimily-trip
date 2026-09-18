window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;

function resizeImage(file, maxSize = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.TripSync.photos = {
  _currentFilter: 'ALL',

  renderThumbnails() {
    const trip = window.TripSync.state.currentTrip;
    if (!trip || !trip.photos) return;
    
    const viewMode = window.TripSync.state.viewMode;
    
    document.querySelectorAll('.card-photos').forEach(container => {
      const itemId = container.getAttribute('data-id');
      const itemPhotos = trip.photos.filter(p => String(p.itinerary_id) === String(itemId));
      
      let html = '';
      itemPhotos.forEach(photo => {
        const photoUrl = photo.thumbnail_url || photo.file_url || photo.url;
        const uploader = photo.uploaded_by || photo.uploader || '가족';
        const caption = photo.caption || '';
        
        html += `
          <div class="photo-thumb" onclick="TripSync.photos.showLightbox('${photoUrl}', '${caption}')" title="${uploader}의 사진">
            <img src="${photoUrl}" alt="${caption}">
            <span class="photo-thumb-uploader">${uploader}</span>
          </div>
        `;
      });
      
      if (viewMode === 'plan' || viewMode === 'ongoing' || !itemPhotos.length) {
        html += `
          <div class="photo-thumb add-photo-btn" onclick="TripSync.photos.showUploadModal('${itemId}')" title="가족 사진 추가">
            <span style="font-size: 18px;">📸</span>
            <span style="font-size: 9px; margin-top: 2px; font-weight: 600;">추가</span>
          </div>
        `;
      }
      
      container.innerHTML = html;
    });
  },
  
  showUploadModal(itineraryId) {
    const trip = window.TripSync.state.currentTrip;
    const rawMembers = (trip && trip.info && trip.info.members) ? trip.info.members : ['아빠', '엄마', '하온', '하겸'];
    const members = Array.isArray(rawMembers) ? rawMembers : (typeof rawMembers === 'string' ? rawMembers.split(',').map(m => m.trim()) : ['아빠']);
    
    let membersHtml = members.map(m => `<option value="${m}">${m}</option>`).join('');
    
    const html = `
      <div class="photo-upload-modal">
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">📸 가족 추억 사진 남기기</h3>
        <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 16px;">각자 디바이스에서 찍은 멋진 사진을 1장씩 올려보세요.</p>
        
        <div style="margin-bottom: 12px;">
          <label style="display:block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">누가 찍은 사진인가요?</label>
          <select id="upload_member" style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem;">${membersHtml}</select>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display:block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">사진 선택</label>
          <input type="file" id="upload_file" accept="image/*" capture="environment" style="width:100%; padding:8px 0; font-size:0.9rem;">
        </div>
        
        <div id="upload_preview" style="margin:12px 0; max-width:100%; display:none; text-align:center;">
          <img id="upload_preview_img" src="" style="max-width:100%; max-height:200px; border-radius:12px; object-fit:contain; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        </div>
        
        <div style="margin-bottom: 18px;">
          <label style="display:block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">한 줄 메모</label>
          <input type="text" id="upload_caption" placeholder="예: 구로몬 시장 참치초밥 최고! 아이들이 너무 잘 먹음" style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:10px; font-size:0.9rem; box-sizing:border-box;">
        </div>
        
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btn_upload_confirm" style="flex:1; padding: 12px; border-radius: 10px;">업로드 완료</button>
          <button class="btn-secondary" style="padding: 12px 18px; border-radius: 10px;" onclick="TripSync.hideModal()">취소</button>
        </div>
      </div>
    `;
    
    window.TripSync.showModal(html);
    
    const fileInput = document.getElementById('upload_file');
    const previewImg = document.getElementById('upload_preview_img');
    const previewContainer = document.getElementById('upload_preview');
    
    let selectedBase64 = null;
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedBase64 = await resizeImage(file);
        previewImg.src = selectedBase64;
        previewContainer.style.display = 'block';
      }
    });
    
    document.getElementById('btn_upload_confirm').onclick = async () => {
      if (!selectedBase64) {
        alert('사진을 선택해주세요.');
        return;
      }
      
      const uploader = document.getElementById('upload_member').value;
      const caption = document.getElementById('upload_caption').value;
      const tripId = trip.trip_id || trip.id || (trip.info && trip.info.trip_id);
      
      // Save locally first so user sees it right away
      if (!trip.photos) trip.photos = [];
      const newPhoto = {
        trip_id: tripId,
        itinerary_id: itineraryId,
        uploaded_by: uploader,
        uploader: uploader,
        file_url: selectedBase64,
        thumbnail_url: selectedBase64,
        url: selectedBase64,
        caption: caption,
        uploaded_at: new Date().toISOString()
      };
      trip.photos.push(newPhoto);
      
      if (typeof window.TripSync.api.uploadPhoto === 'function' && window.TripSync.config.SCRIPT_URL) {
        try {
          await window.TripSync.api.uploadPhoto(tripId, itineraryId, uploader, caption, selectedBase64);
        } catch(e) {
          console.warn('Backend photo upload failed or offline, saved locally', e);
        }
      }
      
      window.TripSync.hideModal();
      window.TripSync.photos.renderThumbnails();
      if (document.getElementById('gallery-section').style.display !== 'none') {
        window.TripSync.photos.renderGallery();
      }
      window.TripSync.showToast('📸 사진이 업로드되었습니다!', 'success');
    };
  },

  setFilter(member) {
    this._currentFilter = member;
    this.renderGallery();
  },
  
  renderGallery() {
    const gallerySection = document.getElementById('gallery-section');
    if (!gallerySection) return;
    
    const trip = window.TripSync.state.currentTrip;
    if (!trip || !trip.photos || trip.photos.length === 0) {
      gallerySection.innerHTML = `
        <div class="gallery-empty-state">
          <div class="empty-icon-circle">📸</div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color:#0F172A; margin-bottom: 6px;">아직 등록된 여행 사진이 없습니다</h4>
          <p style="font-size: 0.88rem; color:#64748B; margin-bottom: 16px;">일정 카드의 📸 버튼을 눌러 우리 가족만의 추억 사진을 남겨보세요!</p>
        </div>
      `;
      return;
    }
    
    // Extract ordered list of family members
    const rawMembers = (trip && trip.info && trip.info.members) ? trip.info.members : ['아빠', '엄마', '하온', '하겸'];
    const definedMembers = Array.isArray(rawMembers)
      ? rawMembers
      : (typeof rawMembers === 'string' ? rawMembers.split(',').map(m => m.trim()) : ['아빠', '엄마', '하온', '하겸']);
    
    const allMembersSet = new Set(definedMembers);
    trip.photos.forEach(p => {
      const up = p.uploaded_by || p.uploader;
      if (up) allMembersSet.add(up);
    });
    const uploaders = Array.from(allMembersSet);
    
    // Filter photos based on current filter
    const currentFilter = this._currentFilter || 'ALL';
    const filteredPhotos = currentFilter === 'ALL'
      ? trip.photos
      : trip.photos.filter(p => (p.uploaded_by || p.uploader) === currentFilter);
    
    // Build filter chips
    let filterChipsHtml = `
      <div class="gallery-filter-bar">
        <button class="gallery-filter-chip ${currentFilter === 'ALL' ? 'active' : ''}" onclick="TripSync.photos.setFilter('ALL')">
          전체 보기 (${trip.photos.length})
        </button>
    `;
    uploaders.forEach(member => {
      const count = trip.photos.filter(p => (p.uploaded_by || p.uploader) === member).length;
      filterChipsHtml += `
        <button class="gallery-filter-chip ${currentFilter === member ? 'active' : ''}" onclick="TripSync.photos.setFilter('${member}')">
          👤 ${member} (${count})
        </button>
      `;
    });
    filterChipsHtml += `</div>`;
    
    // Group filtered photos by itinerary ID
    const grouped = {};
    filteredPhotos.forEach(photo => {
      const id = photo.itinerary_id || 'general';
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(photo);
    });
    
    let contentHtml = '';
    const items = trip.itinerary || [];
    
    if (filteredPhotos.length === 0) {
      contentHtml = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px 20px; color:#64748B;">
          <p style="font-size: 1.5rem; margin-bottom: 8px;">🔍</p>
          <p>선택한 가족 구성원의 사진이 없습니다.</p>
        </div>
      `;
    } else {
      Object.keys(grouped).forEach(itemId => {
        const item = items.find(i => String(i.id) === String(itemId)) || { title: '여행의 특별한 순간', icon: '✨' };
        
        contentHtml += `
          <div class="gallery-group-card">
            <div class="gallery-group-header">
              <span class="gallery-group-icon">${item.icon || '📍'}</span>
              <h4 class="gallery-group-title">${item.title}</h4>
              <span class="gallery-group-count">${grouped[itemId].length}장</span>
            </div>
            <div class="gallery-grid">
        `;
        
        grouped[itemId].forEach(photo => {
          const photoUrl = photo.thumbnail_url || photo.file_url || photo.url;
          const uploader = photo.uploaded_by || photo.uploader || '가족';
          const caption = photo.caption || '';
          
          contentHtml += `
            <div class="gallery-item-card" onclick="TripSync.photos.showLightbox('${photoUrl}', '${caption.replace(/'/g, "\\'")}')">
              <div class="gallery-img-wrapper">
                <img src="${photoUrl}" alt="${caption}" loading="lazy">
                <span class="gallery-uploader-badge">${uploader}</span>
              </div>
              ${caption ? `<div class="gallery-caption"><p>${caption}</p></div>` : ''}
            </div>
          `;
        });
        
        contentHtml += `</div></div>`;
      });
    }
    
    gallerySection.innerHTML = filterChipsHtml + contentHtml;
  },
  
  showLightbox(photoUrl, caption) {
    const html = `
      <div class="lightbox-container">
        <div class="lightbox-img-wrapper">
          <img src="${photoUrl}" class="lightbox-img">
        </div>
        ${caption ? `<p class="lightbox-caption">${caption}</p>` : ''}
      </div>
    `;
    
    window.TripSync.showModal(html);
  }
};
