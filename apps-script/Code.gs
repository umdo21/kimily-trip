/**
 * TripSync - Google Apps Script 백엔드 (읽기 API)
 */

/**
 * GET 요청 핸들러 (읽기 API)
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    var result = {};
    
    if (action === 'trips') {
      // 모든 여행 목록 반환
      var tripsData = getSheetData('trip_info');
      result = { "trips": tripsData };
      
    } else if (action === 'trip') {
      // 특정 여행 상세 정보 반환
      var tripId = e.parameter.id;
      if (!tripId) throw new Error("여행 ID(id)가 필요합니다.");
      
      var tripsData = getSheetData('trip_info');
      var tripInfo = tripsData.filter(function(row) { return row.trip_id === tripId; })[0];
      
      if (!tripInfo) throw new Error("해당 여행을 찾을 수 없습니다.");
      
      var flights = filterByTripId(getSheetData('flights'), tripId);
      var accommodations = filterByTripId(getSheetData('accommodations'), tripId);
      var itinerary = sortItinerary(filterByTripId(getSheetData('itinerary'), tripId));
      var photos = filterByTripId(getSheetData('photos'), tripId);
      
      result = {
        "info": tripInfo,
        "flights": flights,
        "accommodations": accommodations,
        "itinerary": itinerary,
        "photos": photos
      };
      
    } else if (action === 'ics') {
      // ICS 캘린더 파일 생성
      var tripId = e.parameter.id;
      if (!tripId) throw new Error("여행 ID(id)가 필요합니다.");
      
      var tripsData = getSheetData('trip_info');
      var tripInfo = tripsData.filter(function(row) { return row.trip_id === tripId; })[0];
      if (!tripInfo) throw new Error("해당 여행을 찾을 수 없습니다.");
      
      var flights = filterByTripId(getSheetData('flights'), tripId);
      var itinerary = filterByTripId(getSheetData('itinerary'), tripId);
      
      var tripData = { info: tripInfo, flights: flights, itinerary: itinerary };
      var icsContent = generateICS(tripData);
      
      return ContentService.createTextOutput(icsContent)
        .setMimeType(ContentService.MimeType.VCARD); // Apps Script에서 ICS 다운로드를 위해 VCARD나 TEXT 사용
    } else {
      throw new Error("유효하지 않은 action 파라미터입니다.");
    }
    
    // JSON 또는 JSONP 반환
    return createJsonResponse(result, e.parameter.callback);
    
  } catch (error) {
    return createJsonResponse({ "success": false, "error": error.message }, e.parameter.callback);
  }
}

/**
 * JSON 응답 생성 (CORS 및 JSONP 처리)
 */
function createJsonResponse(data, callback) {
  var jsonString = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 시트의 모든 데이터를 객체 배열로 읽어오기
 */
function getSheetData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var displayValues = dataRange.getDisplayValues();
  if (values.length <= 1) return []; // 헤더만 있는 경우
  
  var headers = values[0];
  var result = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var displayRow = displayValues[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      if (header !== "") {
        var rawVal = row[j];
        // 날짜/시간 셀인 경우 시트에 표시된 텍스트(YYYY-MM-DD, HH:mm 등) 그대로 반환
        if (rawVal instanceof Date) {
          obj[header] = displayRow[j];
        } else {
          obj[header] = rawVal;
        }
      }
    }
    result.push(obj);
  }
  return result;
}

/**
 * 특정 여행 ID에 해당하는 데이터 필터링
 */
function filterByTripId(data, tripId) {
  return data.filter(function(item) {
    return item.trip_id === tripId;
  });
}

/**
 * 일정(itinerary) 정렬 로직
 * 날짜(date) -> 시작시간(start_time) -> 정렬순서(sort_order)
 */
function sortItinerary(items) {
  return items.sort(function(a, b) {
    var dateA = a.date || "";
    var dateB = b.date || "";
    if (dateA !== dateB) return dateA > dateB ? 1 : -1;
    
    var timeA = a.start_time || "";
    var timeB = b.start_time || "";
    if (timeA !== timeB) return timeA > timeB ? 1 : -1;
    
    var orderA = parseInt(a.sort_order) || 0;
    var orderB = parseInt(b.sort_order) || 0;
    return orderA - orderB;
  });
}

/**
 * iCalendar (ICS) 형식 텍스트 생성
 */
function generateICS(tripData) {
  var ics = [];
  ics.push("BEGIN:VCALENDAR");
  ics.push("VERSION:2.0");
  ics.push("PRODID:-//TripSync//KR");
  ics.push("CALSCALE:GREGORIAN");
  
  var timezone = tripData.info.timezone || "Asia/Seoul";
  ics.push("X-WR-TIMEZONE:" + timezone);

  // 일정 이벤트 추가
  tripData.itinerary.forEach(function(item) {
    if (!item.date || !item.start_time) return;
    
    ics.push("BEGIN:VEVENT");
    var uid = item.id || Utilities.getUuid();
    ics.push("UID:" + uid + "@tripsync.local");
    
    // 날짜 포맷 (YYYYMMDDTHHMMSS)
    var startDateStr = item.date.toString().replace(/-/g, "") + "T" + item.start_time.toString().replace(/:/g, "") + "00";
    var endDateStr = startDateStr;
    if (item.end_time) {
      endDateStr = item.date.toString().replace(/-/g, "") + "T" + item.end_time.toString().replace(/:/g, "") + "00";
    } else {
      // 종료 시간이 없으면 1시간 추가
      var d = parseDateTime(item.date, item.start_time);
      if (d) {
        d.setHours(d.getHours() + 1);
        endDateStr = formatDateForICS(d);
      }
    }
    
    ics.push("DTSTART;TZID=" + timezone + ":" + startDateStr);
    ics.push("DTEND;TZID=" + timezone + ":" + endDateStr);
    ics.push("SUMMARY:" + (item.title || "일정"));
    
    if (item.address) ics.push("LOCATION:" + item.address);
    if (item.notes) ics.push("DESCRIPTION:" + item.notes.replace(/\n/g, "\\n"));
    
    // 알림 설정
    if (item.alert_minutes_before && !isNaN(item.alert_minutes_before)) {
      ics.push("BEGIN:VALARM");
      ics.push("TRIGGER:-PT" + item.alert_minutes_before + "M");
      ics.push("ACTION:DISPLAY");
      ics.push("DESCRIPTION:Reminder");
      ics.push("END:VALARM");
    }
    ics.push("END:VEVENT");
  });
  
  // 항공편 이벤트 추가
  tripData.flights.forEach(function(flight) {
    if (!flight.dep_datetime) return;
    
    ics.push("BEGIN:VEVENT");
    var uid = (flight.flight_no || Utilities.getUuid()) + "@tripsync.local";
    ics.push("UID:" + uid);
    
    var startD = new Date(flight.dep_datetime);
    var endD = flight.arr_datetime ? new Date(flight.arr_datetime) : new Date(startD.getTime() + 2 * 60 * 60 * 1000); // 기본 2시간
    
    ics.push("DTSTART;TZID=" + timezone + ":" + formatDateForICS(startD));
    ics.push("DTEND;TZID=" + timezone + ":" + formatDateForICS(endD));
    
    var directionStr = flight.direction === "outbound" ? "출국편" : (flight.direction === "inbound" ? "귀국편" : "항공편");
    ics.push("SUMMARY:" + directionStr + " - " + (flight.flight_no || ""));
    ics.push("LOCATION:" + (flight.dep_airport || ""));
    
    var desc = [];
    if (flight.airline) desc.push("항공사: " + flight.airline);
    if (flight.booking_ref) desc.push("예약번호: " + flight.booking_ref);
    if (flight.notes) desc.push("메모: " + flight.notes);
    ics.push("DESCRIPTION:" + desc.join("\\n"));
    
    // 항공편은 기본 3시간 전 알림
    ics.push("BEGIN:VALARM");
    ics.push("TRIGGER:-PT180M");
    ics.push("ACTION:DISPLAY");
    ics.push("DESCRIPTION:공항 출발 알림");
    ics.push("END:VALARM");
    
    ics.push("END:VEVENT");
  });

  ics.push("END:VCALENDAR");
  
  return ics.join("\r\n");
}

function parseDateTime(dateStr, timeStr) {
  try {
    var parts = dateStr.split("-");
    var tParts = timeStr.split(":");
    if (parts.length >= 3 && tParts.length >= 2) {
      return new Date(parts[0], parts[1]-1, parts[2], tParts[0], tParts[1], 0);
    }
  } catch(e) {}
  return null;
}

function formatDateForICS(date) {
  var pad = function(n) { return n < 10 ? '0' + n : n; };
  return date.getFullYear() +
         pad(date.getMonth() + 1) +
         pad(date.getDate()) + "T" +
         pad(date.getHours()) +
         pad(date.getMinutes()) + "00";
}

/**
 * 스프레드시트 열릴 때 커스텀 메뉴 등록
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('✈️ Kimily Trip')
      .addItem('⚡ 구글 지도 링크 전체 자동 분석 & 빈칸 채우기', 'autoFillAllMapLinks')
      .addSeparator()
      .addItem('💡 사용 안내 & 스마트 입력 팁', 'showHelpDialog')
      .addToUi();
  } catch(e) {
    // 트리거 환경 등에 따라 UI가 없을 수 있음
  }
}

/**
 * onEdit 트리거: 구글 지도 URL 붙여넣기 시 자동 파싱 (좌표, 장소명, 카테고리 자동 완성)
 */
function onEdit(e) {
  if (!e || !e.source) return;
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();
  
  // itinerary 또는 accommodations 시트만 처리
  if (sheetName !== "itinerary" && sheetName !== "accommodations") return;
  
  var range = e.range;
  var col = range.getColumn();
  var row = range.getRow();
  
  // 헤더 행은 무시
  if (row <= 1) return;
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var urlColIdx = headers.indexOf("google_maps_link") + 1;
  var latColIdx = headers.indexOf("lat") + 1;
  var lngColIdx = headers.indexOf("lng") + 1;
  var titleColIdx = sheetName === "itinerary" ? (headers.indexOf("title") + 1) : (headers.indexOf("name") + 1);
  var catColIdx = headers.indexOf("category") + 1;
  var iconColIdx = headers.indexOf("icon") + 1;
  
  // 수정된 열이 google_maps_link 열인지 확인
  if (col === urlColIdx) {
    var url = range.getValue();
    if (!url || typeof url !== 'string') return;
    
    var details = extractDetailsFromMapsUrl(url);
    if (!details) return;
    
    // 1. 위도 / 경도 자동 입력
    if (details.lat && latColIdx > 0) sheet.getRange(row, latColIdx).setValue(details.lat);
    if (details.lng && lngColIdx > 0) sheet.getRange(row, lngColIdx).setValue(details.lng);
    
    // 2. 장소 이름이 비어있다면 자동 입력
    if (titleColIdx > 0 && details.title) {
      var curTitle = sheet.getRange(row, titleColIdx).getValue();
      if (!curTitle) {
        sheet.getRange(row, titleColIdx).setValue(details.title);
      }
    }
    
    // 3. 카테고리 / 아이콘이 비어있다면 자동 입력
    if (catColIdx > 0 && details.category) {
      var curCat = sheet.getRange(row, catColIdx).getValue();
      if (!curCat) {
        sheet.getRange(row, catColIdx).setValue(details.category);
      }
    }
    if (iconColIdx > 0 && details.icon) {
      var curIcon = sheet.getRange(row, iconColIdx).getValue();
      if (!curIcon) {
        sheet.getRange(row, iconColIdx).setValue(details.icon);
      }
    }
  }
}

/**
 * 구글 맵스 URL에서 상세 정보(좌표, 장소명, 카테고리, 아이콘) 추출
 */
function extractDetailsFromMapsUrl(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    var rawUrl = url.trim();
    
    // 1. short URL (https://maps.app.goo.gl/...) 리다이렉트 추적
    if (rawUrl.indexOf("maps.app.goo.gl") !== -1 || rawUrl.indexOf("goo.gl/maps") !== -1) {
      var response = UrlFetchApp.fetch(rawUrl, { followRedirects: false, muteHttpExceptions: true });
      var locationUrl = response.getHeaders()['Location'];
      if (locationUrl) rawUrl = locationUrl;
    }
    
    var result = {
      lat: null,
      lng: null,
      title: null,
      category: null,
      icon: null
    };
    
    // 2. 장소명(Title) 추출: /maps/place/장소명/
    var placeMatch = rawUrl.match(/\/place\/([^/@?]+)/);
    if (placeMatch && placeMatch[1]) {
      var decodedTitle = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      // 주소 번지수나 불필요한 기호 정리
      decodedTitle = decodedTitle.split(',')[0].trim();
      result.title = decodedTitle;
    }
    
    // 3. 위도/경도(lat/lng) 추출
    // 패턴 A: @위도,경도
    var atMatch = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch && atMatch.length >= 3) {
      result.lat = parseFloat(atMatch[1]);
      result.lng = parseFloat(atMatch[2]);
    }
    
    // 패턴 B: ?q=위도,경도
    if (!result.lat) {
      var qMatch = rawUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch && qMatch.length >= 3) {
        result.lat = parseFloat(qMatch[1]);
        result.lng = parseFloat(qMatch[2]);
      }
    }
    
    // 패턴 C: ll=위도,경도
    if (!result.lat) {
      var llMatch = rawUrl.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch && llMatch.length >= 3) {
        result.lat = parseFloat(llMatch[1]);
        result.lng = parseFloat(llMatch[2]);
      }
    }
    
    // 4. 장소명 기반 카테고리 및 아이콘 자동 감지
    if (result.title) {
      var titleLower = result.title.toLowerCase();
      if (/호텔|리조트|호스텔|펜션|hotel|inn|resort|stay|guesthouse/i.test(titleLower)) {
        result.category = "accommodation";
        result.icon = "🏨";
      } else if (/카페|커피|스타벅스|디저트|cafe|coffee|bakery|tea/i.test(titleLower)) {
        result.category = "cafe";
        result.icon = "☕";
      } else if (/라멘|식당|스시|초밥|고기|갈비|우동|이자카야|레스토랑|맛집|restaurant|diner/i.test(titleLower)) {
        result.category = "restaurant";
        result.icon = "🍽️";
      } else if (/공항|역|열차|지하철|터미널|station|airport|terminal/i.test(titleLower)) {
        result.category = "transport";
        result.icon = "🚅";
      } else if (/쇼핑|돈키호테|백화점|마트|아울렛|시장|mall|market|store/i.test(titleLower)) {
        result.category = "shopping";
        result.icon = "🛍️";
      } else {
        result.category = "attraction";
        result.icon = "🏛️";
      }
    }
    
    return (result.lat || result.title) ? result : null;
  } catch(e) {
    Logger.log("URL 상세 분석 실패: " + e.message);
  }
  return null;
}

/**
 * 시트 내 모든 구글 지도 링크 일괄 분석 및 빈 필드 자동 채우기
 */
function autoFillAllMapLinks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ["itinerary", "accommodations"];
  var totalUpdated = 0;
  
  sheets.forEach(function(sName) {
    var sheet = ss.getSheetByName(sName);
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    
    var headers = data[0];
    var urlCol = headers.indexOf("google_maps_link");
    var latCol = headers.indexOf("lat");
    var lngCol = headers.indexOf("lng");
    var titleCol = sName === "itinerary" ? headers.indexOf("title") : headers.indexOf("name");
    var catCol = headers.indexOf("category");
    var iconCol = headers.indexOf("icon");
    
    if (urlCol === -1) return;
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var url = row[urlCol];
      if (!url || typeof url !== 'string' || url.trim() === '') continue;
      
      var needsLat = (latCol !== -1 && (!row[latCol] || row[latCol] === ''));
      var needsTitle = (titleCol !== -1 && (!row[titleCol] || row[titleCol] === ''));
      var needsCat = (catCol !== -1 && (!row[catCol] || row[catCol] === ''));
      
      if (needsLat || needsTitle || needsCat) {
        var details = extractDetailsFromMapsUrl(url);
        if (details) {
          if (needsLat && details.lat) {
            sheet.getRange(i + 1, latCol + 1).setValue(details.lat);
            sheet.getRange(i + 1, lngCol + 1).setValue(details.lng);
          }
          if (needsTitle && details.title) {
            sheet.getRange(i + 1, titleCol + 1).setValue(details.title);
          }
          if (needsCat && details.category) {
            sheet.getRange(i + 1, catCol + 1).setValue(details.category);
          }
          if (iconCol !== -1 && (!row[iconCol] || row[iconCol] === '') && details.icon) {
            sheet.getRange(i + 1, iconCol + 1).setValue(details.icon);
          }
          totalUpdated++;
        }
      }
    }
  });
  
  SpreadsheetApp.getUi().alert('완료', '총 ' + totalUpdated + '개 행의 구글 지도 정보(좌표/장소명)를 자동 채웠습니다!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 커스텀 함수: =KIMILY_COORDS(url, "lat") 또는 "lng"
 * @customfunction
 */
function KIMILY_COORDS(url, type) {
  if (!url) return "";
  var details = extractDetailsFromMapsUrl(url);
  if (!details) return "";
  if (type === "lng") return details.lng || "";
  return details.lat || "";
}

/**
 * 커스텀 함수: =KIMILY_TITLE(url)
 * @customfunction
 */
function KIMILY_TITLE(url) {
  if (!url) return "";
  var details = extractDetailsFromMapsUrl(url);
  return (details && details.title) ? details.title : "";
}

/**
 * 안내 팝업
 */
function showHelpDialog() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif; padding:15px; line-height:1.6;">' +
    '<h3 style="color:#2563EB;">✈️ Kimily Trip 스마트 입력 가이드</h3>' +
    '<p><strong>1. 구글 지도 링크 붙여넣기:</strong><br>' +
    '<code>itinerary</code> 또는 <code>accommodations</code> 시트의 <code>google_maps_link</code> 열에 구글맵 공유 링크(maps.app.goo.gl 또는 웹 링크)를 붙여넣으시면, 위도/경도/장소명/카테고리가 자동으로 입력됩니다.</p>' +
    '<p><strong>2. 상단 메뉴 일괄 실행:</strong><br>' +
    '<code>[Kimily Trip] &gt; [⚡ 구글 지도 링크 전체 자동 분석 &amp; 빈칸 채우기]</code>를 클릭하시면 기존에 입력된 링크들의 좌표와 장소명을 한 번에 채울 수 있습니다.</p>' +
    '<p><strong>3. 웹 프론트엔드 모달:</strong><br>' +
    '웹 화면 우측 상단 <strong>[➕ 추가]</strong> 버튼을 눌러 구글맵 링크, 항공편명(KE723 등), 티켓 예약번호를 붙여넣으시면 1초 만에 스마트 자동 완성이 동작합니다.</p>' +
    '</div>'
  ).setWidth(420).setHeight(320);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Kimily Trip 스마트 도우미');
}
