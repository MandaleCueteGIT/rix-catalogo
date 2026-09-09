window.RIX_API = (() => {
  const cfg = window.RIX_CONFIG;

  const demoProducts = [
    {sku:'9116',producto:'Urbano Dash',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro',precio:41371.20,activo:true,destacado:true},
    {sku:'9117',producto:'Urbano Dash',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Plateado',precio:41371.20,activo:true},
    {sku:'9119',producto:'Neon 4',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Arena + correa rosa',precio:98831.20,activo:true,destacado:true},
    {sku:'9120',producto:'Neon 4',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro + correa extra',precio:98831.20,activo:true},
    {sku:'8741',producto:'Essence',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro',precio:118022.84,activo:true},
    {sku:'8622',producto:'Numa',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro',precio:109403.84,activo:true},
    {sku:'8623',producto:'Numa',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Plateado',precio:109403.84,activo:true},
    {sku:'8629',producto:'Neutron 4.0',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro',precio:84925.88,activo:true},
    {sku:'8630',producto:'Neutron 4.0',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Plateado',precio:84925.88,activo:true},
    {sku:'8157',producto:'Axia',marca:'FOXBOX',categoria:'SMARTWATCHES',variante:'Negro',precio:45738.16,activo:true}
  ];

  async function getCatalog(){
    if (cfg.DEMO_MODE || !cfg.API_URL) return {ok:true, products:demoProducts, demo:true};
    const url = new URL(cfg.API_URL);
    url.searchParams.set('action','catalog');
    const res = await fetch(url.toString(), {method:'GET'});
    if (!res.ok) throw new Error('No se pudo cargar el catálogo');
    return res.json();
  }

  async function sendOrder(payload){
    if (cfg.DEMO_MODE || !cfg.API_URL) {
      return {ok:true, demo:true, orderId:'DEMO-'+Date.now(), message:'Pedido de prueba generado. Aún no está conectado a Google Sheets.'};
    }
    const res = await fetch(cfg.API_URL, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'createOrder', ...payload})
    });
    if (!res.ok) throw new Error('No se pudo enviar el pedido');
    return res.json();
  }

  return {getCatalog, sendOrder};
})();
