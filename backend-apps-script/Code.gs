const SPREADSHEET_ID = '1VYtcBUJMciJ808qssDAewSkuWCL1Wd9BSPP38p5FSRs';

const SHEET_NAMES = {
  PRODUCTS: 'PRODUCTOS',
  CLIENTS: 'CLIENTES',
  ORDERS: 'PEDIDOS',
  ORDER_LINES: 'DETALLE_PEDIDOS',
  CONFIG: 'CONFIG',
  API_REQUESTS: 'API_REQUESTS'
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    let result;

    if (action === 'health') result = { ok: true, service: 'RIX API', version: '0.2.0' };
    else if (action === 'catalog') result = getCatalog_(e.parameter || {});
    else if (action === 'orderStatus') result = getOrderStatus_(String((e.parameter || {}).requestId || ''));
    else result = { ok: false, message: 'Acción no válida' };

    return output_(result, (e.parameter || {}).callback);
  } catch (err) {
    return output_({ ok: false, message: err.message || String(err) }, e && e.parameter ? e.parameter.callback : '');
  }
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const requestId = String(params.requestId || Utilities.getUuid());

  try {
    const action = String(params.action || 'createOrder');
    if (action !== 'createOrder') throw new Error('Acción POST no válida');

    const existing = findApiRequest_(requestId);
    if (existing && existing.STATUS === 'SUCCESS') {
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }

    upsertApiRequest_(requestId, 'PROCESSING', '', 'Procesando pedido', '', '', '', '');

    let payload = {};
    if (params.payload) payload = JSON.parse(params.payload);
    else if (e && e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);

    const result = createOrder_(requestId, payload);
    upsertApiRequest_(requestId, 'SUCCESS', result.orderId, result.message, '', result.comercio, result.whatsapp, result.total);

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    upsertApiRequest_(requestId, 'ERROR', '', 'No se pudo registrar el pedido', err.message || String(err), '', '', '');
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
  }
}

function getCatalog_(params) {
  const config = getConfig_();
  const auth = resolveClient_(String(params.c || ''), String(params.t || ''), config);
  if (!auth.ok) return auth;

  const priceType = auth.client ? auth.client.tipoPrecio : normalizePriceType_(config.TIPO_PRECIO_DEFAULT || 'DISTRIBUIDOR');
  const priceHeader = priceHeader_(priceType);
  const sheet = ss_().getSheetByName(SHEET_NAMES.PRODUCTS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, products: [], client: publicClient_(auth.client), priceType };

  const headers = headerMap_(values[0]);
  const products = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const sku = cell_(row, headers, 'SKU');
    if (!sku || !isYes_(cell_(row, headers, 'ACTIVO'))) continue;

    const price = Number(cell_(row, headers, priceHeader));
    if (!Number.isFinite(price) || price <= 0) continue;

    products.push({
      sku: String(sku),
      producto: String(cell_(row, headers, 'PRODUCTO') || ''),
      marca: String(cell_(row, headers, 'MARCA') || ''),
      categoria: String(cell_(row, headers, 'CATEGORIA') || ''),
      subcategoria: String(cell_(row, headers, 'SUBCATEGORIA') || ''),
      variante: String(cell_(row, headers, 'VARIANTE') || ''),
      descripcion: String(cell_(row, headers, 'DESCRIPCION_CORTA') || ''),
      precio: price,
      pedidoMinimo: Number(cell_(row, headers, 'PEDIDO_MINIMO') || 1),
      pack: String(cell_(row, headers, 'PACK') || ''),
      destacado: isYes_(cell_(row, headers, 'DESTACADO')),
      novedad: isYes_(cell_(row, headers, 'NOVEDAD')),
      disponibilidad: String(cell_(row, headers, 'DISPONIBILIDAD') || ''),
      imagen: String(cell_(row, headers, 'IMAGEN_URL') || ''),
      activo: true,
      orden: Number(cell_(row, headers, 'ORDEN') || 999999)
    });
  }

  products.sort((a, b) => (a.orden - b.orden) || a.producto.localeCompare(b.producto, 'es'));

  return {
    ok: true,
    products,
    client: publicClient_(auth.client),
    priceType,
    updatedAt: new Date().toISOString()
  };
}

function createOrder_(requestId, payload) {
  if (!payload || !Array.isArray(payload.items) || !payload.items.length) throw new Error('El pedido no contiene productos');

  const config = getConfig_();
  const maxItems = Number(config.MAX_ITEMS_POR_PEDIDO || 250);
  const maxUnits = Number(config.MAX_UNIDADES_POR_ITEM || 5000);
  if (payload.items.length > maxItems) throw new Error('El pedido supera el máximo de SKUs permitido');

  const auth = resolveClient_(String(payload.clientId || ''), String(payload.token || ''), config);
  if (!auth.ok) throw new Error(auth.message || 'Cliente no autorizado');

  const client = auth.client;
  const comercio = client ? client.comercio : cleanText_(payload.comercio, 120);
  const contacto = client ? client.contacto : cleanText_(payload.contacto, 120);
  const whatsapp = client ? client.whatsapp : cleanText_(payload.whatsapp, 50);
  const clientId = client ? client.id : '';
  const priceType = client ? client.tipoPrecio : normalizePriceType_(config.TIPO_PRECIO_DEFAULT || 'DISTRIBUIDOR');

  if (!comercio) throw new Error('Falta el comercio o nombre del cliente');
  if (!contacto) throw new Error('Falta el nombre de contacto');
  if (!whatsapp) throw new Error('Falta el WhatsApp');

  const productData = productMapForPrice_(priceType);
  const seen = {};
  const lines = [];
  let total = 0;
  let units = 0;

  payload.items.forEach((item) => {
    const sku = String(item.sku || '').trim();
    const qty = Math.floor(Number(item.cantidad || 0));
    if (!sku || !Number.isFinite(qty) || qty <= 0 || qty > maxUnits) throw new Error('Cantidad inválida en SKU ' + sku);
    if (seen[sku]) throw new Error('SKU repetido en el pedido: ' + sku);
    seen[sku] = true;

    const product = productData[sku];
    if (!product) throw new Error('SKU no disponible o sin precio: ' + sku);

    const subtotal = product.precio * qty;
    total += subtotal;
    units += qty;
    lines.push({ sku, qty, product, subtotal });
  });

  const now = new Date();
  const orderId = nextOrderId_();
  const initialStatus = String(config.ESTADO_INICIAL_PEDIDO || 'NUEVO');
  const notes = cleanText_(payload.observaciones, 1000);

  const orderSheet = ss_().getSheetByName(SHEET_NAMES.ORDERS);
  orderSheet.appendRow([
    orderId, now, clientId, comercio, contacto, whatsapp, priceType,
    lines.length, units, total, initialStatus, notes, '', now, false,
    '', '', '', '', '', now
  ]);

  const detailSheet = ss_().getSheetByName(SHEET_NAMES.ORDER_LINES);
  const detailRows = lines.map((line, i) => [
    orderId, i + 1, line.sku, line.product.producto, line.product.variante,
    line.qty, line.product.precio, line.subtotal, line.product.ubicacion,
    'PENDIENTE', 0, '', ''
  ]);
  detailSheet.getRange(detailSheet.getLastRow() + 1, 1, detailRows.length, detailRows[0].length).setValues(detailRows);

  SpreadsheetApp.flush();

  return {
    ok: true,
    requestId,
    orderId,
    comercio,
    whatsapp,
    total,
    message: String(config.MENSAJE_CONFIRMACION || 'Pedido recibido. RIX confirmará disponibilidad y condiciones.')
  };
}

function getOrderStatus_(requestId) {
  if (!requestId) return { ok: false, message: 'Falta requestId' };
  const row = findApiRequest_(requestId);
  if (!row) return { ok: true, status: 'PENDING' };
  if (row.STATUS === 'SUCCESS') {
    return { ok: true, status: 'SUCCESS', orderId: row.ORDER_ID, message: row.MESSAGE, total: Number(row.TOTAL || 0) };
  }
  if (row.STATUS === 'ERROR') return { ok: false, status: 'ERROR', message: row.ERROR || row.MESSAGE || 'Error al procesar pedido' };
  return { ok: true, status: row.STATUS || 'PENDING' };
}

function resolveClient_(id, token, config) {
  if (!id && !token) {
    if (String(config.CATALOGO_PUBLICO || 'SI').toUpperCase() === 'NO') return { ok: false, message: 'Se requiere enlace de cliente' };
    return { ok: true, client: null };
  }
  if (!id || !token) return { ok: false, message: 'Enlace de cliente incompleto' };

  const sheet = ss_().getSheetByName(SHEET_NAMES.CLIENTS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: false, message: 'Cliente no encontrado' };
  const h = headerMap_(values[0]);

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(cell_(row, h, 'ID_CLIENTE')) !== id) continue;
    if (String(cell_(row, h, 'TOKEN')) !== token) return { ok: false, message: 'Token de cliente inválido' };
    if (!isYes_(cell_(row, h, 'ACTIVO'))) return { ok: false, message: 'Cliente inactivo' };
    return {
      ok: true,
      client: {
        id,
        comercio: String(cell_(row, h, 'COMERCIO') || ''),
        contacto: String(cell_(row, h, 'CONTACTO') || ''),
        whatsapp: String(cell_(row, h, 'WHATSAPP') || ''),
        tipoPrecio: normalizePriceType_(cell_(row, h, 'TIPO_PRECIO') || config.TIPO_PRECIO_DEFAULT || 'DISTRIBUIDOR')
      }
    };
  }
  return { ok: false, message: 'Cliente no encontrado' };
}

function productMapForPrice_(priceType) {
  const sheet = ss_().getSheetByName(SHEET_NAMES.PRODUCTS);
  const values = sheet.getDataRange().getValues();
  const h = headerMap_(values[0] || []);
  const priceHeader = priceHeader_(priceType);
  const map = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const sku = String(cell_(row, h, 'SKU') || '').trim();
    if (!sku || !isYes_(cell_(row, h, 'ACTIVO'))) continue;
    const price = Number(cell_(row, h, priceHeader));
    if (!Number.isFinite(price) || price <= 0) continue;
    map[sku] = {
      producto: String(cell_(row, h, 'PRODUCTO') || ''),
      variante: String(cell_(row, h, 'VARIANTE') || ''),
      precio: price,
      ubicacion: String(cell_(row, h, 'UBICACION_DEPOSITO') || '')
    };
  }
  return map;
}

function nextOrderId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = ss_().getSheetByName(SHEET_NAMES.CONFIG);
    const values = sheet.getDataRange().getValues();
    let counterRow = -1;
    let prefix = 'RIX';
    let current = 0;

    for (let r = 1; r < values.length; r++) {
      const key = String(values[r][0] || '').trim();
      if (key === 'ULTIMO_NUMERO_PEDIDO') { counterRow = r + 1; current = Number(values[r][1] || 0); }
      if (key === 'PREFIJO_PEDIDO') prefix = String(values[r][1] || 'RIX');
    }
    if (counterRow < 0) throw new Error('Falta ULTIMO_NUMERO_PEDIDO en CONFIG');

    const next = current + 1;
    sheet.getRange(counterRow, 2).setValue(next);
    SpreadsheetApp.flush();
    return prefix + '-' + String(next).padStart(6, '0');
  } finally {
    lock.releaseLock();
  }
}

function getConfig_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('RIX_CONFIG');
  if (cached) return JSON.parse(cached);

  const sheet = ss_().getSheetByName(SHEET_NAMES.CONFIG);
  const values = sheet.getDataRange().getValues();
  const config = {};
  for (let r = 1; r < values.length; r++) {
    const key = String(values[r][0] || '').trim();
    if (key) config[key] = values[r][1];
  }
  cache.put('RIX_CONFIG', JSON.stringify(config), 60);
  return config;
}

function upsertApiRequest_(requestId, status, orderId, message, error, client, whatsapp, total) {
  const sheet = ss_().getSheetByName(SHEET_NAMES.API_REQUESTS);
  const found = findApiRequestWithRow_(requestId);
  const now = new Date();
  const values = [requestId, found ? found.data.CREATED_AT : now, status, orderId || '', message || '', error || '', client || '', whatsapp || '', Number(total || 0), now];
  if (found) sheet.getRange(found.row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function findApiRequest_(requestId) {
  const found = findApiRequestWithRow_(requestId);
  return found ? found.data : null;
}

function findApiRequestWithRow_(requestId) {
  if (!requestId) return null;
  const sheet = ss_().getSheetByName(SHEET_NAMES.API_REQUESTS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const h = headerMap_(values[0]);
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(cell_(values[r], h, 'REQUEST_ID')) === requestId) {
      const data = {};
      Object.keys(h).forEach((key) => data[key] = values[r][h[key]]);
      return { row: r + 1, data };
    }
  }
  return null;
}

function output_(data, callback) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const cb = String(callback || '');
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function publicClient_(client) {
  if (!client) return null;
  return { id: client.id, comercio: client.comercio, contacto: client.contacto, whatsapp: client.whatsapp, tipoPrecio: client.tipoPrecio };
}

function priceHeader_(type) {
  const t = normalizePriceType_(type);
  return t === 'AGENTE' ? 'PRECIO_AGENTE' : t === 'AMIGO' ? 'PRECIO_AMIGO' : 'PRECIO_DISTRIBUIDOR';
}

function normalizePriceType_(value) {
  const t = String(value || '').trim().toUpperCase();
  return ['AGENTE', 'DISTRIBUIDOR', 'AMIGO'].indexOf(t) >= 0 ? t : 'DISTRIBUIDOR';
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((v, i) => { const key = String(v || '').trim().toUpperCase(); if (key) map[key] = i; });
  return map;
}

function cell_(row, map, key) {
  const index = map[String(key).toUpperCase()];
  return index === undefined ? '' : row[index];
}

function isYes_(value) {
  if (value === true || value === 1) return true;
  const v = String(value || '').trim().toUpperCase();
  return ['SI', 'SÍ', 'TRUE', '1', 'YES', 'ACTIVO'].indexOf(v) >= 0;
}

function cleanText_(value, max) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max || 500);
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
