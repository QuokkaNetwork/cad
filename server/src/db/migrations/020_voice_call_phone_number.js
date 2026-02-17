exports.up = (db) => {
  // Add caller_phone_number to voice_call_sessions so CAD can display it
  // and dispatchers can call back if needed.
  db.exec(`ALTER TABLE voice_call_sessions ADD COLUMN caller_phone_number TEXT DEFAULT ''`);

  console.log('Migration 020 applied: added caller_phone_number to voice_call_sessions');
};
