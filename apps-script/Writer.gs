/**
 * TripSync - Google Apps Script 백엔드 (쓰기 API)
 */

/**
 * POST 요청 핸들러 (쓰기 API 및 사진 업로드)
 */
function doPost(e) {
  try {
    // POST body 파싱 (JSON 형태인 경우)
    var postData = {};
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch(parseErr) {
        // x-www-form-urlencoded의 경우 e.parameter 사용
      }
    }
    
    // 파라미터 병합 (e.parameter와 JSON body)
    var params = Object.assign({}, e.parameter, postData);
    var action = params.action;
    
    var result = {};
    
    if (action === 'updateItem') {
      result = updateItineraryItem(params);
    } else if (action === 'addItem') {
      result = addItineraryItem(params);
    } else if (action === 'addTrip') {
      result = addTrip(params);
    } else if (action === 'reorder') {
      result = reorderItineraryItems(params);
    } else if (action === 'uploadPhoto') {
      result = handleUploadPhoto(params); // PhotoUploader.gs 에 정의됨
    } else if (action === 'deletePhoto') {
      result = handleDeletePhoto(params); // PhotoUploader.gs 에 정의됨
    } else {
      throw new Error("유효하지 않은 action 파라미터입니다.");
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 일정 항목 업데이트 (updateItem)
 */
function updateItineraryItem(params) {
  var id = params.id;
  if (!id) throw new Error("항목 ID(id)가 필요합니다.");
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('itinerary');
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = values[0];
  
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) throw new Error("itinerary 시트에 'id' 열이 존재하지 않습니다.");
  
  var targetRowIdx = -1;
  for (var i = 1; i < values.length; i++) {
    if (values[i][idColIdx] === id) {
      targetRowIdx = i + 1; // 1-based index
      break;
    }
  }
  
  if (targetRowIdx === -1) throw new Error("해당 ID의 일정을 찾을 수 없습니다.");
  
  var updatedData = {};
  
  // 전달된 파라미터 중 시트 헤더와 일치하는 열만 업데이트
  for (var j = 0; j < headers.length; j++) {
    var colName = headers[j];
    if (params[colName] !== undefined && colName !== 'id') {
      sheet.getRange(targetRowIdx, j + 1).setValue(params[colName]);
      updatedData[colName] = params[colName];
    }
  }
  
  updatedData.id = id;
  return { "success": true, "updated": updatedData };
}

/**
 * 새 일정 항목 추가 (addItem)
 */
function addItineraryItem(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('itinerary');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  var newId = "itm_" + new Date().getTime();
  var newRow = [];
  var itemData = {};
  
  for (var i = 0; i < headers.length; i++) {
    var colName = headers[i];
    var val = "";
    if (colName === 'id') {
      val = newId;
    } else if (params[colName] !== undefined) {
      val = params[colName];
    }
    newRow.push(val);
    itemData[colName] = val;
  }
  
  sheet.appendRow(newRow);
  return { "success": true, "item": itemData };
}

/**
 * 항목 정렬 순서 벌크 업데이트 (reorder)
 */
function reorderItineraryItems(params) {
  var items = params.items;
  if (!items || !Array.isArray(items)) {
    // JSON 문자열인 경우 파싱
    if (typeof items === 'string') {
      items = JSON.parse(items);
    } else {
      throw new Error("정렬할 항목 배열(items)이 필요합니다.");
    }
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('itinerary');
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = values[0];
  
  var idColIdx = headers.indexOf('id');
  var sortOrderColIdx = headers.indexOf('sort_order');
  
  if (idColIdx === -1 || sortOrderColIdx === -1) {
    throw new Error("필수 열(id 또는 sort_order)을 찾을 수 없습니다.");
  }
  
  // 효율적인 업데이트를 위한 ID 맵 구성
  var rowMap = {};
  for (var i = 1; i < values.length; i++) {
    var itemId = values[i][idColIdx];
    if (itemId) {
      rowMap[itemId] = i + 1; // 1-based row index
    }
  }
  
  items.forEach(function(item) {
    if (item.id && item.sort_order !== undefined) {
      var targetRowIdx = rowMap[item.id];
      if (targetRowIdx) {
        sheet.getRange(targetRowIdx, sortOrderColIdx + 1).setValue(item.sort_order);
      }
    }
  });
  
  return { "success": true };
}

/**
 * 새 여행지 추가 (addTrip)
 */
function addTrip(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('trip_info');
  if (!sheet) throw new Error("trip_info 시트를 찾을 수 없습니다.");
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var tripId = params.trip_id || ("trip_" + new Date().getTime());
  var newRow = [];
  var tripData = {};
  
  for (var i = 0; i < headers.length; i++) {
    var colName = headers[i];
    var val = "";
    if (colName === 'trip_id') {
      val = tripId;
    } else if (params[colName] !== undefined) {
      val = params[colName];
    }
    newRow.push(val);
    tripData[colName] = val;
  }
  
  sheet.appendRow(newRow);
  return { "success": true, "trip": tripData };
}
