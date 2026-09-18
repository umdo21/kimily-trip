window.TripSync = window.TripSync || {};
window.KimilyTrip = window.TripSync;

window.TripSync.api = {
  // Local cache helpers (Stale-While-Revalidate pattern)
  getCachedTrips() {
    try {
      const data = localStorage.getItem('KimilyTrip_cached_trips');
      return data ? JSON.parse(data) : null;
    } catch(e) { return null; }
  },

  setCachedTrips(trips) {
    try {
      localStorage.setItem('KimilyTrip_cached_trips', JSON.stringify(trips));
    } catch(e) {}
  },

  getCachedTrip(tripId) {
    try {
      const data = localStorage.getItem(`KimilyTrip_cached_trip_${tripId}`);
      return data ? JSON.parse(data) : null;
    } catch(e) { return null; }
  },

  setCachedTrip(tripId, tripData) {
    try {
      localStorage.setItem(`KimilyTrip_cached_trip_${tripId}`, JSON.stringify(tripData));
    } catch(e) {}
  },

  jsonp(url, timeoutMs = 3800) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
      let timer = null;
      let script = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        delete window[callbackName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, timeoutMs);

      window[callbackName] = function(data) {
        cleanup();
        resolve(data);
      };
      
      script = document.createElement('script');
      script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP failed'));
      };
      document.body.appendChild(script);
    });
  },

  async request(action, params = {}, method = 'GET', body = null, timeoutMs = 4500) {
    const config = window.TripSync.config || {};
    if (!config.SCRIPT_URL) throw new Error("SCRIPT_URL is missing");
    
    // For GET requests use JSONP with timeout
    if (method === 'GET') {
      const urlParams = new URLSearchParams({ action, ...params });
      return this.jsonp(`${config.SCRIPT_URL}?${urlParams.toString()}`, timeoutMs);
    } else {
      // POST requests via fetch with AbortController timeout
      const urlParams = new URLSearchParams({ action, ...params });
      const url = `${config.SCRIPT_URL}?${urlParams.toString()}`;
      
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          signal: controller.signal
        });
        clearTimeout(timer);
        return await response.json();
      } catch(err) {
        clearTimeout(timer);
        throw err;
      }
    }
  },

  async loadTrips() {
    // 1. Return cached trips immediately if available (0ms instant render)
    const cached = this.getCachedTrips();
    if (cached && cached.length > 0) {
      // Refresh silently in background
      if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
        this.request('trips').then(res => {
          if (res && res.trips && res.trips.length > 0) {
            this.setCachedTrips(res.trips);
            window.TripSync.state.trips = res.trips;
            if (typeof window.populateTripSelector === 'function') {
              window.populateTripSelector();
            }
          }
        }).catch(() => {});
      }
      return cached;
    }

    // 2. Fetch from server if no cache
    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      try {
        const res = await this.request('trips');
        if (res && res.trips && res.trips.length > 0) {
          this.setCachedTrips(res.trips);
          return res.trips;
        }
      } catch (e) {
        console.warn('Apps Script 연결 지연 또는 오프라인, 로컬 샘플을 표시합니다:', e);
      }
    }
    
    // 3. Fallback to built-in Sample Trips & cache
    const defaultTrips = [
      {
        trip_id: 'osaka_2026',
        trip_name: '오사카 가족여행',
        destination: '일본 오사카',
        start_date: '2026-10-10',
        end_date: '2026-10-13',
        status: 'planning',
        cover_emoji: '🇯🇵',
        members: '아빠, 엄마, 하온, 하겸',
        currency: 'JPY',
        timezone: 'Asia/Tokyo'
      },
      {
        trip_id: 'jeju_2025',
        trip_name: '제주도 힐링 가족여행',
        destination: '대한민국 제주',
        start_date: '2025-05-02',
        end_date: '2025-05-05',
        status: 'completed',
        cover_emoji: '🍊',
        members: '아빠, 엄마, 하온, 하겸',
        currency: 'KRW',
        timezone: 'Asia/Seoul'
      }
    ];
    this.setCachedTrips(defaultTrips);
    return defaultTrips;
  },

  async loadTrip(tripId) {
    // 1. Return cached trip details immediately if available (0ms instant render)
    const cached = this.getCachedTrip(tripId);
    if (cached && cached.info) {
      // In background, refresh from server silently
      if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
        this.request('trip', { id: tripId }).then(res => {
          if (res && res.info) {
            this.setCachedTrip(tripId, res);
            if (window.TripSync.state.currentTripId === tripId) {
              window.TripSync.state.currentTrip = res;
              if (window.TripSync.timeline && typeof window.TripSync.timeline.render === 'function') {
                window.TripSync.timeline.render();
              }
              if (window.TripSync.map && typeof window.TripSync.map.render === 'function') {
                window.TripSync.map.render();
              }
            }
          }
        }).catch(() => {});
      }
      return cached;
    }

    // 2. Fetch from server if no cache
    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      try {
        const res = await this.request('trip', { id: tripId });
        if (res && res.info) {
          this.setCachedTrip(tripId, res);
          return res;
        }
      } catch (e) {
        console.warn('Apps Script 연결 지연 또는 오프라인, 로컬 상세 데이터를 표시합니다:', e);
      }
    }

    // Return detailed sample trip
    if (tripId === 'jeju_2025') {
      return {
        info: {
          trip_id: 'jeju_2025',
          trip_name: '제주도 힐링 가족여행',
          destination: '대한민국 제주',
          start_date: '2025-05-02',
          end_date: '2025-05-05',
          status: 'completed',
          cover_emoji: '🍊',
          members: '아빠, 엄마, 하온, 하겸',
          currency: 'KRW',
          timezone: 'Asia/Seoul'
        },
        flights: [
          { departure_airport: 'GMP (김포)', arrival_airport: 'CJU (제주)', dep_airport: '김포 (GMP)', arr_airport: '제주 (CJU)', departure_time: '2025-05-02 08:30', arrival_time: '2025-05-02 09:40', dep_datetime: '2025-05-02 08:30', arr_datetime: '2025-05-02 09:40', airline: '아시아나항공', flight_no: 'OZ8901', booking_ref: 'AS9812' },
          { departure_airport: 'CJU (제주)', arrival_airport: 'GMP (김포)', dep_airport: '제주 (CJU)', arr_airport: '김포 (GMP)', departure_time: '2025-05-05 17:20', arrival_time: '2025-05-05 18:30', dep_datetime: '2025-05-05 17:20', arr_datetime: '2025-05-05 18:30', airline: '아시아나항공', flight_no: 'OZ8990', booking_ref: 'AS9813' }
        ],
        accommodations: [
          { name: '제주 신라호텔 (The Shilla Jeju)', check_in: '2025-05-02 15:00', check_out: '2025-05-05 11:00', address: '제주특별자치도 서귀포시 중문관광로 72번길 75', lat: 33.2476, lng: 126.4082, phone: '064-735-5114' }
        ],
        itinerary: [
          {
            id: 'jj_1', trip_id: 'jeju_2025', date: '2025-05-02', start_time: '11:00', end_time: '12:30',
            category: 'restaurant', title: '자매국수 본점', address: '제주 제주시 항골남길 46',
            description: '공항 근처 진한 국물의 고기국수 & 비빔국수 맛집', budget: 45000, icon: '🍜',
            lat: 33.5188, lng: 126.5412, status: 'visited',
            actual_title: '자매국수 본점 (방문 완료)', actual_start_time: '11:15', actual_end_time: '12:20',
            actual_notes: '대기 15분 후 입장! 아이들도 고기국수 국물까지 완식', actual_spend: 48000, sort_order: 1
          },
          {
            id: 'jj_2', trip_id: 'jeju_2025', date: '2025-05-02', start_time: '14:00', end_time: '16:00',
            category: 'attraction', title: '섭지코지 해안 산책', address: '제주 서귀포시 성산읍 고성리',
            description: '탁 트인 해안 절경과 유채꽃밭 걷기', budget: 10000, icon: '🌊',
            lat: 33.4241, lng: 126.9312, status: 'changed',
            actual_title: '아쿠아플라넷 제주 (실내 변경)', actual_start_time: '14:30', actual_end_time: '17:00',
            actual_notes: '갑자기 강풍이 불어 아이들 감기 걱정으로 아쿠아리움으로 급변경! 물개 공연 너무 좋아함', actual_spend: 96000, sort_order: 2
          },
          {
            id: 'jj_3', trip_id: 'jeju_2025', date: '2025-05-02', start_time: '18:00', end_time: '19:30',
            category: 'restaurant', title: '숙성도 중문점', address: '제주 서귀포시 일주서로 966',
            description: '워터에이징 흑돼지 뼈등심 구이', budget: 110000, icon: '🥩',
            lat: 33.2536, lng: 126.4172, status: 'visited',
            actual_title: '숙성도 중문점', actual_start_time: '18:10', actual_end_time: '19:40',
            actual_notes: '테이블링 원격줄서기로 바로 입장, 멜젓 볶음밥 최고!', actual_spend: 118000, sort_order: 3
          },
          {
            id: 'jj_4', trip_id: 'jeju_2025', date: '2025-05-03', start_time: '10:00', end_time: '12:30',
            category: 'attraction', title: '휴애리 자연생활공원', address: '제주 서귀포시 남원읍 신례동로 256',
            description: '흑돼지 미끄럼틀 & 수국 축제 온실 감상', budget: 40000, icon: '🌺',
            lat: 33.3087, lng: 126.6341, status: 'visited',
            actual_title: '휴애리 공원', actual_start_time: '10:00', actual_end_time: '12:15',
            actual_notes: '아이들 동물 당근 주기 체험 2번이나 함', actual_spend: 46000, sort_order: 1
          }
        ],
        photos: [
          {
            itinerary_id: 'jj_1', uploaded_by: '아빠',
            url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
            caption: '진한 고기국수 한 그릇!'
          },
          {
            itinerary_id: 'jj_1', uploaded_by: '엄마',
            url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&q=80',
            caption: '아이들 맛있게 먹는 모습 흐뭇'
          },
          {
            itinerary_id: 'jj_2', uploaded_by: '하온',
            url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
            caption: '대형 수조 가오리가 인사해줬어요'
          },
          {
            itinerary_id: 'jj_4', uploaded_by: '하겸',
            url: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=600&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=600&q=80',
            caption: '아기 흑돼지들에게 당근 주기 성공!'
          },
          {
            itinerary_id: 'jj_3', uploaded_by: '아빠',
            url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
            thumbnail_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
            caption: '육즙 가득 흑돼지구이'
          }
        ]
      };
    }

    // Default: osaka_2026
    return {
      info: {
        trip_id: 'osaka_2026',
        trip_name: '오사카 가족여행',
        destination: '일본 오사카',
        start_date: '2026-10-10',
        end_date: '2026-10-13',
        status: 'planning',
        cover_emoji: '🇯🇵',
        members: '아빠, 엄마, 하온, 하겸',
        currency: 'JPY',
        timezone: 'Asia/Tokyo'
      },
      flights: [
        { departure_airport: 'ICN (인천)', arrival_airport: 'KIX (간사이)', dep_airport: '인천 (ICN)', arr_airport: '간사이 (KIX)', departure_time: '2026-10-10 09:00', arrival_time: '2026-10-10 11:00', dep_datetime: '2026-10-10 09:00', arr_datetime: '2026-10-10 11:00', airline: '대한항공', flight_no: 'KE723', booking_ref: 'KAL9821' },
        { departure_airport: 'KIX (간사이)', arrival_airport: 'ICN (인천)', dep_airport: '간사이 (KIX)', arr_airport: '인천 (ICN)', departure_time: '2026-10-13 18:30', arrival_time: '2026-10-13 20:30', dep_datetime: '2026-10-13 18:30', arr_datetime: '2026-10-13 20:30', airline: '대한항공', flight_no: 'KE724', booking_ref: 'KAL9822' }
      ],
      accommodations: [
        { name: '호텔 닛코 오사카 (Hotel Nikko Osaka)', check_in: '2026-10-10 15:00', check_out: '2026-10-13 11:00', address: '1-3-3 Nishi-Shinsaibashi, Chuo-ku, Osaka', lat: 34.6723, lng: 135.5005, phone: '+81-6-6244-1111' }
      ],
      itinerary: [
        // Day 1
        {
          id: 'osk_1', trip_id: 'osaka_2026', date: '2026-10-10', start_time: '11:30', end_time: '12:30',
          category: 'transport', title: '간사이 공항 → 난바 (라피트 특급)', address: 'Kansai Airport Station',
          description: '라피트 특급열차 탑승 (난바역까지 38분 직통, 사전예약석)', budget: 5200, icon: '🚅',
          lat: 34.4320, lng: 135.2304, status: 'planned', sort_order: 1
        },
        {
          id: 'osk_2', trip_id: 'osaka_2026', date: '2026-10-10', start_time: '13:00', end_time: '14:15',
          category: 'restaurant', title: '이치란 라멘 도톤보리 본점', address: '7-18 Souemoncho, Chuo Ward, Osaka',
          description: '돈코츠 라멘과 반숙란. 아이들은 맵기 0단계로 주문!', budget: 4800, icon: '🍜',
          lat: 34.6687, lng: 135.5030, status: 'planned', sort_order: 2
        },
        {
          id: 'osk_3', trip_id: 'osaka_2026', date: '2026-10-10', start_time: '15:00', end_time: '15:45',
          category: 'accommodation', title: '호텔 닛코 오사카 체크인', address: '1-3-3 Nishi-Shinsaibashi, Chuo-ku, Osaka',
          description: '신사이바시역 8번 출구 직결 호텔. 짐 풀고 잠시 휴식', budget: 0, icon: '🏨',
          lat: 34.6723, lng: 135.5005, status: 'planned', sort_order: 3
        },
        {
          id: 'osk_4', trip_id: 'osaka_2026', date: '2026-10-10', start_time: '16:30', end_time: '18:30',
          category: 'attraction', title: '도톤보리 & 글리코상 가족 산책', address: 'Dotonbori, Chuo Ward, Osaka',
          description: '에비스 다리 글리코상 앞에서 가족 시그니처 포즈 촬영', budget: 3000, icon: '🏃',
          lat: 34.6690, lng: 135.5013, status: 'planned', sort_order: 4
        },
        {
          id: 'osk_4_1', trip_id: 'osaka_2026', date: '2026-10-10', start_time: '19:00', end_time: '20:30',
          category: 'restaurant', title: '쿠시카츠 다루마 신사이바시점', address: '1 Chome-5-17 Shinsaibashisuji, Chuo Ward, Osaka',
          description: '오사카 대표 먹거리 바삭한 쿠시카츠 꼬치 튀김', budget: 6500, icon: '🍢',
          lat: 34.6712, lng: 135.5018, status: 'planned', sort_order: 5
        },
        // Day 2
        {
          id: 'osk_5', trip_id: 'osaka_2026', date: '2026-10-11', start_time: '09:30', end_time: '11:45',
          category: 'attraction', title: '오사카성 천수각 & 공원 산책', address: '1-1 Osakajo, Chuo Ward, Osaka',
          description: '웅장한 오사카성 전망대와 성곽 공원 산책 (로드트레인 탑승)', budget: 3200, icon: '🏯',
          lat: 34.6873, lng: 135.5262, status: 'planned', sort_order: 1
        },
        {
          id: 'osk_6', trip_id: 'osaka_2026', date: '2026-10-11', start_time: '12:30', end_time: '14:30',
          category: 'restaurant', title: '구로몬 시장 먹거리 투어', address: '2 Chome-4-1 Nipponbashi, Chuo Ward, Osaka',
          description: '와규 꼬치, 딸기 찹쌀떡, 신선한 참치 초밥 길거리 시식', budget: 9000, icon: '🍣',
          lat: 34.6655, lng: 135.5071, status: 'planned', sort_order: 2
        },
        {
          id: 'osk_7', trip_id: 'osaka_2026', date: '2026-10-11', start_time: '15:00', end_time: '16:30',
          category: 'cafe', title: '키타하마 모토커피 (MOTO COFFEE)', address: '2 Chome-1-1 Kitahama, Chuo Ward, Osaka',
          description: '나카노시마 강변 테라스에서 커피와 티라미수 타임', budget: 3500, icon: '☕',
          lat: 34.6917, lng: 135.5065, status: 'planned', sort_order: 3
        },
        {
          id: 'osk_7_1', trip_id: 'osaka_2026', date: '2026-10-11', start_time: '17:30', end_time: '20:00',
          category: 'shopping', title: '우메다 다이마루 & 포켓몬센터', address: '3 Chome-1-1 Umeda, Kita Ward, Osaka',
          description: '아이들이 고대하던 포켓몬센터 오사카점 쇼핑', budget: 15000, icon: '🛍️',
          lat: 34.7025, lng: 135.4959, status: 'planned', sort_order: 4
        },
        // Day 3
        {
          id: 'osk_8', trip_id: 'osaka_2026', date: '2026-10-12', start_time: '08:30', end_time: '17:30',
          category: 'attraction', title: '유니버설 스튜디오 재팬 (USJ)', address: '2 Chome-1-33 Sakurajima, Konohana Ward, Osaka',
          description: '슈퍼 닌텐도 월드 파워업 밴드 & 해리포터존 종일 투어', budget: 52000, icon: '🎢',
          lat: 34.6654, lng: 135.4323, status: 'planned', sort_order: 1
        },
        {
          id: 'osk_8_1', trip_id: 'osaka_2026', date: '2026-10-12', start_time: '18:30', end_time: '20:30',
          category: 'attraction', title: '하루카스 300 전망대', address: '1 Chome-1-43 Abenosuji, Abeno Ward, Osaka',
          description: '오사카 최고 높이 빌딩에서 360도 야경 감상', budget: 6000, icon: '🌃',
          lat: 34.6460, lng: 135.5133, status: 'planned', sort_order: 2
        },
        // Day 4
        {
          id: 'osk_9', trip_id: 'osaka_2026', date: '2026-10-13', start_time: '10:00', end_time: '11:00',
          category: 'free', title: '호텔 체크아웃 & 신사이바시 산책', address: '1-3-3 Nishi-Shinsaibashi, Chuo-ku, Osaka',
          description: '체크아웃 후 기념품 구입', budget: 5000, icon: '🛍️',
          lat: 34.6723, lng: 135.5005, status: 'planned', sort_order: 1
        },
        {
          id: 'osk_10', trip_id: 'osaka_2026', date: '2026-10-13', start_time: '12:00', end_time: '15:00',
          category: 'shopping', title: '린쿠 프리미엄 아울렛', address: '3-28 Rinku Orai Minami, Izumisano, Osaka',
          description: '공항 가기 전 바닷가 아울렛 쇼핑 및 점심식사', budget: 20000, icon: '🛍️',
          lat: 34.4069, lng: 135.2952, status: 'planned', sort_order: 2
        },
        {
          id: 'osk_11', trip_id: 'osaka_2026', date: '2026-10-13', start_time: '15:30', end_time: '18:30',
          category: 'flight', title: '간사이 공항 수속 및 출국', address: 'Kansai International Airport',
          description: '면세점 쇼핑 후 인천행 KE724편 탑승', budget: 0, icon: '✈️',
          lat: 34.4320, lng: 135.2304, status: 'planned', sort_order: 3
        }
      ],
      photos: [
        {
          itinerary_id: 'osk_4', uploaded_by: '아빠',
          url: 'https://images.unsplash.com/photo-1590559899731-a372a1469e59?w=600&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1590559899731-a372a1469e59?w=600&q=80',
          caption: '도톤보리 화려한 네온사인과 글리코상'
        },
        {
          itinerary_id: 'osk_2', uploaded_by: '엄마',
          url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
          caption: '아이들도 너무 잘 먹은 이치란 라멘'
        },
        {
          itinerary_id: 'osk_6', uploaded_by: '하온',
          url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80',
          caption: '구로몬 시장에서 먹은 참치 초밥'
        },
        {
          itinerary_id: 'osk_8', uploaded_by: '하겸',
          url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80',
          caption: '슈퍼 닌텐도 월드 키노피오와 함께!'
        }
      ]
    };
  },

  async addTrip(newTrip) {
    // 1. Save locally to state & cache immediately
    const trips = window.TripSync.state.trips || [];
    const tripId = newTrip.trip_id || newTrip.id;
    const exists = trips.some(t => (t.trip_id || t.id) === tripId);
    if (!exists) {
      trips.unshift(newTrip);
      this.setCachedTrips(trips);
    }
    
    // Initialize full trip structure in cache
    const initialTripDetail = {
      info: newTrip,
      flights: [],
      accommodations: [],
      itinerary: [],
      photos: []
    };
    this.setCachedTrip(tripId, initialTripDetail);

    // 2. Dispatch to backend in background
    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      this.request('addTrip', {}, 'POST', newTrip).catch(e => {
        console.warn('Backend addTrip failed, saved locally:', e);
      });
    }

    return { success: true, trip: newTrip };
  },

  async updateItem(itemId, updates) {
    // 1. Optimistic Update: Modify memory & local cache immediately
    const trip = window.TripSync.state.currentTrip;
    if (trip && trip.itinerary) {
      const item = trip.itinerary.find(i => String(i.id) === String(itemId));
      if (item) Object.assign(item, updates);
      const tripId = (trip.info && trip.info.trip_id) || window.TripSync.state.currentTripId;
      if (tripId) this.setCachedTrip(tripId, trip);
    }

    // 2. Dispatch to backend in background without waiting
    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      this.request('updateItem', { id: itemId }, 'POST', updates).catch(e => {
        console.warn('Backend updateItem failed, kept in local cache:', e);
      });
    }
    return { success: true };
  },

  async addItem(item) {
    // 1. Optimistic Update: Add to memory & local cache immediately
    const trip = window.TripSync.state.currentTrip;
    if (trip && trip.itinerary) {
      if (!item.id) item.id = 'itm_' + Date.now();
      trip.itinerary.push(item);
      const tripId = (trip.info && trip.info.trip_id) || window.TripSync.state.currentTripId;
      if (tripId) this.setCachedTrip(tripId, trip);
    }

    // 2. Dispatch to backend in background without waiting
    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      this.request('addItem', {}, 'POST', item).catch(e => {
        console.warn('Backend addItem failed, kept in local cache:', e);
      });
    }
    return { success: true, item };
  },

  async reorderItems(items) {
    const trip = window.TripSync.state.currentTrip;
    const tripId = (trip && trip.info && trip.info.trip_id) || window.TripSync.state.currentTripId;
    if (tripId && trip) this.setCachedTrip(tripId, trip);

    if (window.TripSync.config && window.TripSync.config.SCRIPT_URL) {
      this.request('reorder', {}, 'POST', { items }).catch(e => {
        console.warn('Backend reorder failed:', e);
      });
    }
    return { success: true };
  },

  async uploadPhoto(tripId, itineraryId, uploadedBy, caption, imageBase64) {
    if (window.TripSync.config.SCRIPT_URL) {
      try {
        return await this.request('uploadPhoto', {}, 'POST', { tripId, itineraryId, uploadedBy, caption, imageBase64 });
      } catch (e) {
        console.warn('Backend uploadPhoto failed:', e);
      }
    }
    return { success: true };
  },

  async deletePhoto(fileId) {
    if (window.TripSync.config.SCRIPT_URL) {
      try {
        return await this.request('deletePhoto', { file_id: fileId }, 'POST', {});
      } catch (e) {
        console.warn('Backend deletePhoto failed:', e);
      }
    }
    return { success: true };
  },

  getIcsUrl(tripId) {
    return `${window.TripSync.config.SCRIPT_URL}?action=ics&id=${tripId}`;
  }
};
