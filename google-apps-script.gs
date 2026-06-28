// ═══════════════════════════════════════════════════════════════
// Wedding Manager — Google Apps Script Backend
// ═══════════════════════════════════════════════════════════════
//
// HOW TO DEPLOY (one time only):
// ────────────────────────────────
// 1. Go to https://script.google.com → New Project
// 2. Delete any existing code
// 3. Paste this entire file → Save (Ctrl+S)
// 4. Click "Deploy" → "New Deployment"
// 5. Type: Web App
// 6. Execute as: Me
// 7. Who has access: Anyone
// 8. Click "Deploy" → Copy the Web App URL
// 9. Paste that URL in the Wedding Manager → Setup tab
//
// GOOGLE SHEET STRUCTURE (auto-created):
// ────────────────────────────────────────
// Sheet "Guests":  ID | Name | Phone | Group | RSVP | Notified | Created
// Sheet "Settings": Key | Value
// ═══════════════════════════════════════════════════════════════

const GUESTS_SHEET   = 'Guests';
const SETTINGS_SHEET = 'Settings';

// ── MAIN ENTRY POINT ───────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const params = e.parameter;
    let result   = {};

    switch (action) {

      // ── PING (test connection) ──────────────────────────────
      case 'ping':
        result = { status: 'ok', message: 'Wedding Manager connected! 🌸' };
        break;

      // ── GET ALL GUESTS ──────────────────────────────────────
      case 'getGuests':
        result = { guests: _getGuests() };
        break;

      // ── ADD GUEST ───────────────────────────────────────────
      case 'addGuest':
        result = _addGuest(params.name, params.phone, params.group || 'Other');
        break;

      // ── DELETE GUEST ────────────────────────────────────────
      case 'deleteGuest':
        result = _deleteGuest(params.id);
        break;

      // ── UPDATE RSVP ─────────────────────────────────────────
      case 'updateRSVP':
        result = _updateGuestField(params.id, 5, params.rsvp); // col 5 = RSVP
        break;

      // ── UPDATE NOTIFIED ─────────────────────────────────────
      case 'updateNotified':
        result = _updateGuestField(params.id, 6, params.notified); // col 6 = Notified
        break;

      // ── GET SETTINGS ────────────────────────────────────────
      case 'getSettings':
        result = { settings: _getSettings() };
        break;

      // ── SAVE SETTINGS ───────────────────────────────────────
      case 'saveSettings':
        result = _saveSettings(params);
        break;

      default:
        result = { error: 'Unknown action: ' + action };
    }

    return _json(result);

  } catch (err) {
    return _json({ error: err.message });
  }
}

// ── HELPERS ────────────────────────────────────────────────────

function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === GUESTS_SHEET) {
      sheet.appendRow(['ID', 'Name', 'Phone', 'Group', 'RSVP', 'Notified', 'Created']);
      sheet.setFrozenRows(1);
      // Style header row
      const header = sheet.getRange(1, 1, 1, 7);
      header.setBackground('#2C1F1F').setFontColor('#FAF7F2').setFontWeight('bold');
      sheet.setColumnWidths(1, 7, [160, 180, 150, 100, 90, 90, 160]);
    }
    if (name === SETTINGS_SHEET) {
      sheet.appendRow(['Key', 'Value']);
      sheet.setFrozenRows(1);
      const header = sheet.getRange(1, 1, 1, 2);
      header.setBackground('#2C1F1F').setFontColor('#FAF7F2').setFontWeight('bold');
    }
  }
  return sheet;
}

function _getGuests() {
  const sheet = _getSheet(GUESTS_SHEET);
  const last  = sheet.getLastRow();
  if (last < 2) return [];

  const data   = sheet.getRange(2, 1, last - 1, 7).getValues();
  const guests = [];
  data.forEach(row => {
    if (row[0]) {
      guests.push({
        id:       row[0].toString(),
        name:     row[1].toString(),
        phone:    row[2].toString(),
        group:    row[3].toString(),
        rsvp:     row[4].toString() || 'Pending',
        notified: row[5].toString() || 'No',
        created:  row[6] ? new Date(row[6]).toISOString() : ''
      });
    }
  });
  return guests;
}

function _addGuest(name, phone, group) {
  if (!name || !phone) return { success: false, error: 'Name and phone required' };
  const sheet = _getSheet(GUESTS_SHEET);
  const id    = Date.now().toString();
  sheet.appendRow([id, name, phone, group, 'Pending', 'No', new Date()]);
  return { success: true, id };
}

function _deleteGuest(id) {
  const sheet = _getSheet(GUESTS_SHEET);
  const last  = sheet.getLastRow();
  if (last < 2) return { success: false, error: 'No guests found' };

  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false, error: 'Guest not found' };
}

function _updateGuestField(id, col, value) {
  const sheet = _getSheet(GUESTS_SHEET);
  const last  = sheet.getLastRow();
  if (last < 2) return { success: false, error: 'No guests found' };

  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === id.toString()) {
      sheet.getRange(i + 2, col).setValue(value);
      return { success: true };
    }
  }
  return { success: false, error: 'Guest not found' };
}

function _getSettings() {
  const sheet = _getSheet(SETTINGS_SHEET);
  const last  = sheet.getLastRow();
  if (last < 2) return {};

  const data     = sheet.getRange(2, 1, last - 1, 2).getValues();
  const settings = {};
  data.forEach(row => { if (row[0]) settings[row[0]] = row[1]; });
  return settings;
}

function _saveSettings(params) {
  const sheet    = _getSheet(SETTINGS_SHEET);
  const last     = sheet.getLastRow();
  const skip     = ['action'];
  const existing = {};

  if (last >= 2) {
    const data = sheet.getRange(2, 1, last - 1, 2).getValues();
    data.forEach((row, i) => { if (row[0]) existing[row[0]] = i + 2; });
  }

  Object.keys(params).forEach(key => {
    if (skip.includes(key)) return;
    const value = params[key];
    if (existing[key]) {
      sheet.getRange(existing[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });

  return { success: true };
}
