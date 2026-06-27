// ==========================================
// File: utils/imageHelpers.js
// ==========================================

/**
 * Converts a Google Drive or Dropbox sharing link to a direct image URL.
 * If the URL is already a direct link, it returns the URL unchanged.
 * 
 * @param {string} url The sharing URL
 * @returns {string} The direct image source URL
 */
export const getDirectImageUrl = (url) => {
  if (!url) return '';
  const urlStr = String(url).trim();

  // 1. Google Drive Link Conversion
  // Match patterns:
  // - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // - https://drive.google.com/open?id=FILE_ID
  // - https://docs.google.com/file/d/FILE_ID/edit
  let driveId = '';
  const matchD1 = urlStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const matchD2 = urlStr.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  
  if (matchD1) {
    driveId = matchD1[1];
  } else if (matchD2) {
    driveId = matchD2[1];
  }

  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // 2. Dropbox Link Conversion
  // e.g., https://www.dropbox.com/s/xxxx/yyyy.jpg?dl=0
  if (urlStr.includes('dropbox.com')) {
    if (urlStr.includes('dl=0')) {
      return urlStr.replace('dl=0', 'raw=1');
    } else if (!urlStr.includes('raw=1')) {
      return urlStr + (urlStr.includes('?') ? '&raw=1' : '?raw=1');
    }
  }

  return urlStr;
};
