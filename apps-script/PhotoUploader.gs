/**
 * TripSync - 사진 업로드 및 삭제 핸들러
 */

/**
 * 사진 업로드 처리 (uploadPhoto)
 */
function handleUploadPhoto(params) {
  var tripId = params.trip_id;
  var itineraryId = params.itinerary_id || "";
  var uploadedBy = params.uploaded_by || "Unknown";
  var caption = params.caption || "";
  var imageBase64 = params.image; // Base64 encoded JPEG
  
  if (!tripId) throw new Error("여행 ID(trip_id)가 필요합니다.");
  if (!imageBase64) throw new Error("이미지 데이터(image)가 필요합니다.");
  
  // Base64 데이터에서 'data:image/jpeg;base64,' 접두어 제거
  var base64Data = imageBase64;
  if (imageBase64.indexOf("base64,") !== -1) {
    base64Data = imageBase64.split("base64,")[1];
  }
  
  // 디코딩 및 Blob 생성
  var decoded = Utilities.base64Decode(base64Data);
  var timestamp = new Date().getTime();
  var fileName = itineraryId + "_" + uploadedBy + "_" + timestamp + ".jpg";
  var blob = Utilities.newBlob(decoded, MimeType.JPEG, fileName);
  
  // 폴더 구조 가져오기 또는 생성 (KimilyTrip / {trip_id} / photos)
  var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), "KimilyTrip");
  var tripFolder = getOrCreateFolder(rootFolder, tripId);
  var photosFolder = getOrCreateFolder(tripFolder, "photos");
  
  // 파일 생성
  var file = photosFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileId = file.getId();
  var fileUrl = file.getUrl();
  // 구글 드라이브 썸네일 URL (종종 다운로드 링크로 사용되거나 특별 URL 포맷 사용)
  var thumbnailUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400-h400";
  
  // photos 시트에 메타데이터 기록
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('photos');
  if (sheet) {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = [];
    
    var data = {
      "trip_id": tripId,
      "itinerary_id": itineraryId,
      "uploaded_by": uploadedBy,
      "file_id": fileId,
      "file_url": fileUrl,
      "thumbnail_url": thumbnailUrl,
      "caption": caption,
      "uploaded_at": new Date().toISOString()
    };
    
    for (var i = 0; i < headers.length; i++) {
      newRow.push(data[headers[i]] || "");
    }
    sheet.appendRow(newRow);
  }
  
  return {
    "success": true, 
    "photo": {
      "file_id": fileId, 
      "file_url": fileUrl, 
      "thumbnail_url": thumbnailUrl
    }
  };
}

/**
 * 사진 삭제 처리 (deletePhoto)
 */
function handleDeletePhoto(params) {
  var fileId = params.file_id;
  if (!fileId) throw new Error("파일 ID(file_id)가 필요합니다.");
  
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true); // 휴지통으로 이동
  } catch(e) {
    // 파일이 이미 없거나 권한이 없는 경우 무시하고 시트 데이터만 삭제 시도
  }
  
  // photos 시트에서 해당 행 삭제
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('photos');
  if (sheet) {
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    var idColIdx = headers.indexOf('file_id');
    
    if (idColIdx !== -1) {
      for (var i = values.length - 1; i >= 1; i--) { // 역순으로 순회하며 삭제
        if (values[i][idColIdx] === fileId) {
          sheet.deleteRow(i + 1); // 1-based index
          break;
        }
      }
    }
  }
  
  return { "success": true };
}

/**
 * 폴더가 있으면 가져오고 없으면 생성하는 헬퍼 함수
 */
function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}
