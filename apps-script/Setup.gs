/**
 * Kimily Trip - 스프레드시트 1초 자동 초기화 & 샘플 데이터 생성기
 * 작성자: Kimily Trip Developer
 */

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('✈️ Kimily Trip')
      .addItem('🚀 시트 자동 생성 및 샘플 데이터 채우기', 'setupKimilyTripSpreadsheet')
      .addToUi();
  } catch (e) {
    // 트리거 등 UI 없는 환경 예외 무시
  }
}

function setupKimilyTripSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 시트 스펙 정의 (시트명, 컬럼 헤더, 샘플 행 데이터)
  var sheetsSpec = {
    "trip_info": {
      headers: ["trip_id", "trip_name", "destination", "start_date", "end_date", "timezone", "members", "currency", "status", "cover_emoji"],
      rows: [
        ["osaka_2026", "오사카 가족여행", "일본 오사카", "2026-10-10", "2026-10-13", "Asia/Tokyo", "아빠, 엄마, 하온, 하겸", "JPY", "planning", "🇯🇵"],
        ["jeju_2025", "제주도 힐링 가족여행", "대한민국 제주", "2025-05-02", "2025-05-05", "Asia/Seoul", "아빠, 엄마, 하온, 하겸", "KRW", "completed", "🍊"]
      ]
    },
    "flights": {
      headers: ["trip_id", "direction", "airline", "flight_no", "dep_airport", "arr_airport", "dep_datetime", "arr_datetime", "booking_ref", "booking_link", "notes"],
      rows: [
        ["osaka_2026", "outbound", "대한항공", "KE723", "인천 (ICN)", "간사이 (KIX)", "2026-10-10 09:00", "2026-10-10 11:00", "KAL9821", "https://www.koreanair.com", "모바일 체크인 완료"],
        ["osaka_2026", "inbound", "대한항공", "KE724", "간사이 (KIX)", "인천 (ICN)", "2026-10-13 18:30", "2026-10-13 20:30", "KAL9822", "https://www.koreanair.com", "수하물 23kg x 4개"],
        ["jeju_2025", "outbound", "아시아나항공", "OZ8901", "김포 (GMP)", "제주 (CJU)", "2025-05-02 08:30", "2025-05-02 09:40", "AS9812", "", "가족 4인 왕복"],
        ["jeju_2025", "inbound", "아시아나항공", "OZ8990", "제주 (CJU)", "김포 (GMP)", "2025-05-05 17:20", "2025-05-05 18:30", "AS9813", "", ""]
      ]
    },
    "accommodations": {
      headers: ["trip_id", "name", "check_in", "check_out", "address", "google_maps_link", "lat", "lng", "booking_link", "phone", "notes"],
      rows: [
        ["osaka_2026", "호텔 닛코 오사카 (Hotel Nikko Osaka)", "2026-10-10 15:00", "2026-10-13 11:00", "1-3-3 Nishi-Shinsaibashi, Chuo-ku, Osaka", "https://maps.google.com/?q=34.6723,135.5005", 34.6723, 135.5005, "https://www.hno.co.jp", "+81-6-6244-1111", "신사이바시역 8번 출구 직결, 쿼드러플 패밀리룸"],
        ["jeju_2025", "제주 신라호텔 (The Shilla Jeju)", "2025-05-02 15:00", "2025-05-05 11:00", "제주특별자치도 서귀포시 중문관광로 72번길 75", "https://maps.google.com/?q=33.2476,126.4082", 33.2476, 126.4082, "", "064-735-5114", "수영장 및 키즈 라운지 이용"]
      ]
    },
    "itinerary": {
      headers: ["id", "trip_id", "date", "start_time", "end_time", "category", "title", "address", "google_maps_link", "lat", "lng", "description", "budget", "booking_link", "alert_minutes_before", "icon", "notes", "status", "actual_title", "actual_start_time", "actual_end_time", "actual_notes", "actual_spend", "sort_order"],
      rows: [
        // Osaka Day 1
        ["osk_1", "osaka_2026", "2026-10-10", "11:30", "12:30", "transport", "간사이 공항 → 난바 (라피트 특급)", "Kansai Airport Station", "https://maps.google.com/?q=34.4320,135.2304", 34.4320, 135.2304, "라피트 특급열차 탑승 (난바역까지 38분 직통)", 5200, "", 30, "🚅", "", "planned", "", "", "", "", 0, 1],
        ["osk_2", "osaka_2026", "2026-10-10", "13:00", "14:00", "restaurant", "이치란 라멘 도톤보리 본관", "오사카부 오사카시 주오구 소에몬초 7-18", "https://maps.google.com/?q=34.6687,135.5013", 34.6687, 135.5013, "돈코츠 라멘 & 키즈 식기 구비", 4800, "", 30, "🍜", "", "planned", "", "", "", "", 0, 2],
        ["osk_3", "osaka_2026", "2026-10-10", "14:30", "15:30", "accommodation", "호텔 닛코 오사카 체크인", "1-3-3 Nishi-Shinsaibashi, Chuo-ku, Osaka", "https://maps.google.com/?q=34.6723,135.5005", 34.6723, 135.5005, "짐 풀고 잠시 휴식", 0, "", 30, "🏨", "", "planned", "", "", "", "", 0, 3],
        ["osk_4", "osaka_2026", "2026-10-10", "16:30", "19:00", "attraction", "도톤보리 산책 & 글리코상 가족사진", "Dotonbori, Chuo Ward, Osaka", "https://maps.google.com/?q=34.6687,135.5013", 34.6687, 135.5013, "글리코상 포즈로 4인 가족사진 촬영!", 0, "", 30, "📸", "", "planned", "", "", "", "", 0, 4],
        // Osaka Day 2 (USJ)
        ["osk_7", "osaka_2026", "2026-10-11", "08:30", "09:30", "transport", "숙소 → USJ 이동 (JR 유메사키선)", "Universal City Station", "https://maps.google.com/?q=34.6668,135.4323", 34.6668, 135.4323, "유니버설 시티역 하차", 1600, "", 30, "🚃", "", "planned", "", "", "", "", 0, 1],
        ["osk_8", "osaka_2026", "2026-10-11", "09:30", "18:00", "attraction", "유니버설 스튜디오 재팬 (USJ)", "2 Chome-1-33 Sakurajima, Konohana Ward, Osaka", "https://maps.google.com/?q=34.6654,135.4323", 34.6654, 135.4323, "슈퍼 닌텐도 월드 파워업 밴드 착용, 마리오 카트 탑승!", 38000, "https://www.usj.co.jp", 30, "🎢", "", "planned", "", "", "", "", 0, 2],
        // Jeju
        ["jj_1", "jeju_2025", "2025-05-02", "11:00", "12:30", "restaurant", "자매국수 본점", "제주 제주시 항골남길 46", "https://maps.google.com/?q=33.5188,126.5412", 33.5188, 126.5412, "진한 국물의 고기국수 & 비빔국수", 45000, "", 30, "🍜", "", "visited", "자매국수 본점 (방문 완료)", "11:15", "12:20", "대기 15분 후 입장, 아이들도 국물까지 완식!", 48000, 1],
        ["jj_2", "jeju_2025", "2025-05-02", "14:00", "16:00", "attraction", "섭지코지 해안 산책", "제주 서귀포시 성산읍 고성리", "https://maps.google.com/?q=33.4241,126.9312", 33.4241, 126.9312, "탁 트인 해안 절경 걷기", 10000, "", 30, "🌊", "", "changed", "아쿠아플라넷 제주 (실내 변경)", "14:30", "17:00", "강풍으로 아이들 감기 걱정되어 아쿠아리움으로 급변경!", 96000, 2],
        ["jj_3", "jeju_2025", "2025-05-02", "18:00", "19:30", "restaurant", "숙성도 중문점", "제주 서귀포시 일주서로 966", "https://maps.google.com/?q=33.2536,126.4172", 33.2536, 126.4172, "워터에이징 흑돼지 뼈등심 구이", 110000, "", 30, "🥩", "", "visited", "숙성도 중문점", "18:10", "19:40", "테이블링 원격줄서기로 바로 입장, 멜젓 볶음밥 최고!", 118000, 3]
      ]
    },
    "photos": {
      headers: ["trip_id", "itinerary_id", "uploaded_by", "file_id", "file_url", "thumbnail_url", "caption", "uploaded_at"],
      rows: [
        ["osaka_2026", "osk_2", "엄마", "sample_1", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80", "아이들도 너무 잘 먹은 이치란 라멘", "2026-10-10T14:00:00Z"],
        ["osaka_2026", "osk_4", "아빠", "sample_2", "https://images.unsplash.com/photo-1590559899731-a372a1dfa599?w=600&q=80", "https://images.unsplash.com/photo-1590559899731-a372a1dfa599?w=600&q=80", "도톤보리 글리코상 앞 가족사진", "2026-10-10T17:30:00Z"],
        ["osaka_2026", "osk_8", "하온", "sample_3", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80", "마리오 카트 1등 했어요!", "2026-10-11T12:30:00Z"],
        ["osaka_2026", "osk_8", "하겸", "sample_4", "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80", "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=80", "키노피오 모자 쓰고 찰칵", "2026-10-11T14:00:00Z"],
        ["jeju_2025", "jj_1", "아빠", "sample_5", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80", "진한 고기국수 한 그릇", "2025-05-02T12:00:00Z"],
        ["jeju_2025", "jj_2", "하온", "sample_6", "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80", "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80", "대형 수조 가오리가 인사해줬어요", "2025-05-02T15:30:00Z"]
      ]
    }
  };

  for (var sheetName in sheetsSpec) {
    var spec = sheetsSpec[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }

    // 1행: 헤더
    sheet.appendRow(spec.headers);
    var headerRange = sheet.getRange(1, 1, 1, spec.headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#3182F6"); // Kimily Trip Electric Blue
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);

    // 샘플 행 추가
    if (spec.rows && spec.rows.length > 0) {
      for (var r = 0; r < spec.rows.length; r++) {
        sheet.appendRow(spec.rows[r]);
      }
    }
    
    // 열 너비 자동 맞춤
    for (var c = 1; c <= spec.headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  // 기본 생성된 빈 '시트1'이 남아있다면 삭제
  var defaultSheet = ss.getSheetByName("시트1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  SpreadsheetApp.getUi().alert("🎉 Kimily Trip 시트 자동 생성이 완료되었습니다!\n\n이제 [배포 > 새 배포 > 웹 앱]을 통해 배포하고 웹 앱 URL을 프론트엔드 설정(⚙️)에 붙여넣으세요.");
}
