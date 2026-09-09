function testConexion() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!configSheet) throw new Error('No se encontró la hoja CONFIG');

  const values = configSheet.getRange(1, 1, Math.min(configSheet.getLastRow(), 20), 3).getValues();
  Logger.log('Conexión OK con: ' + ss.getName());
  Logger.log('Filas CONFIG leídas: ' + values.length);

  return {
    ok: true,
    spreadsheet: ss.getName(),
    configRows: values.length
  };
}
