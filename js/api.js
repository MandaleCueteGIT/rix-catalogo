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

  function currentClientParams(){
    const params = new URLSearchParams(location.search);
    return {c: params.get('c') || '', t: params.get('t') || ''};
  }

  function jsonp(params, timeoutMs=12000){
    return new Promise((resolve,reject)=>{
      if(!cfg.API_URL) return reject(new Error('Falta configurar API_URL'));
      const callback='rixcb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const url=new URL(cfg.API_URL);
      Object.entries(params||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});
      url.searchParams.set('callback',callback);
      const timer=setTimeout(()=>cleanup(new Error('La conexión con RIX tardó demasiado')),timeoutMs);
      function cleanup(err,data){clearTimeout(timer);try{delete window[callback]}catch{};script.remove();err?reject(err):resolve(data)}
      window[callback]=(data)=>cleanup(null,data);
      script.onerror=()=>cleanup(new Error('No se pudo conectar con el servidor de RIX'));
      script.src=url.toString();
      document.head.appendChild(script);
    });
  }

  async function getCatalog(){
    if (cfg.DEMO_MODE || !cfg.API_URL) return {ok:true, products:demoProducts, demo:true};
    const client=currentClientParams();
    const data=await jsonp({action:'catalog',...client});
    if(!data || !data.ok) throw new Error((data&&data.message)||'No se pudo cargar el catálogo');
    return data;
  }

  function postViaIframe(fields){
    const iframe=document.getElementById('rixOrderFrame');
    if(!iframe) throw new Error('No se encontró el canal de envío');
    const form=document.createElement('form');
    form.method='POST';
    form.action=cfg.API_URL;
    form.target=iframe.name;
    form.style.display='none';
    Object.entries(fields).forEach(([name,value])=>{
      const input=document.createElement('input');
      input.type='hidden';input.name=name;input.value=String(value??'');form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    setTimeout(()=>form.remove(),1500);
  }

  async function pollOrder(requestId, attempts=20){
    for(let i=0;i<attempts;i++){
      await new Promise(r=>setTimeout(r,i===0?900:700));
      try{
        const result=await jsonp({action:'orderStatus',requestId},7000);
        if(result && result.status==='SUCCESS') return result;
        if(result && result.status==='ERROR') throw new Error(result.message||'No se pudo registrar el pedido');
      }catch(err){
        if(i===attempts-1) throw err;
      }
    }
    throw new Error('El pedido fue enviado, pero no pudimos confirmar el registro. Contactá a RIX antes de reenviarlo.');
  }

  async function sendOrder(payload){
    if (cfg.DEMO_MODE || !cfg.API_URL) {
      return {ok:true, demo:true, orderId:'DEMO-'+Date.now(), message:'Pedido de prueba generado. Aún no está conectado a Google Sheets.'};
    }
    const client=currentClientParams();
    const requestId=(crypto&&crypto.randomUUID)?crypto.randomUUID():'REQ-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    const body={...payload,clientId:client.c,token:client.t};
    postViaIframe({action:'createOrder',requestId,payload:JSON.stringify(body)});
    const result=await pollOrder(requestId);
    return {...result,ok:true,requestId};
  }

  return {getCatalog, sendOrder, currentClientParams};
})();
