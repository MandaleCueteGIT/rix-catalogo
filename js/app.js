(() => {
  const cfg = window.RIX_CONFIG;
  const api = window.RIX_API;
  const money = new Intl.NumberFormat('es-AR',{style:'currency',currency:cfg.CURRENCY,maximumFractionDigits:0});
  const CUSTOMER_KEY='rix_catalogo_customer_v1';
  const state = {products:[],filtered:[],category:'TODOS',search:'',cart:loadCart(),client:null,priceType:''};

  const $ = (s) => document.querySelector(s);
  const productGrid = $('#productGrid');
  const categoryTabs = $('#categoryTabs');
  const productCount = $('#productCount');
  const catalogTitle = $('#catalogTitle');
  const emptyState = $('#emptyState');
  const cartDrawer = $('#cartDrawer');
  const backdrop = $('#drawerBackdrop');

  function loadCart(){try{return JSON.parse(localStorage.getItem(cfg.STORAGE_KEY)||'{}')}catch{return {}}}
  function saveCart(){localStorage.setItem(cfg.STORAGE_KEY,JSON.stringify(state.cart));renderCartBadge()}
  function loadCustomer(){try{return JSON.parse(localStorage.getItem(CUSTOMER_KEY)||'{}')}catch{return {}}}
  function saveCustomer(){
    if(state.client) return;
    localStorage.setItem(CUSTOMER_KEY,JSON.stringify({
      comercio:$('#customerBusiness').value.trim(),
      contacto:$('#customerName').value.trim(),
      whatsapp:$('#customerWhatsapp').value.trim()
    }));
  }
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}

  function title(v=''){return String(v).toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
  function categories(){return ['TODOS',...new Set(state.products.map(p=>p.categoria).filter(Boolean))]}
  function productBySku(sku){return state.products.find(p=>String(p.sku)===String(sku))}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function escapeAttr(v=''){return escapeHtml(v).replace(/`/g,'&#96;')}
  function positiveNumber(v){
    const n=Number(String(v||'').replace(',','.').replace(/[^0-9.]/g,''));
    return Number.isFinite(n)&&n>0?Math.round(n):0;
  }
  function minQty(p){return Math.max(1,Math.round(Number(p.pedidoMinimo||1)||1))}
  function stepQty(p){return Math.max(1,positiveNumber(p.pack)||minQty(p))}
  function displayQty(p){return Number(state.cart[p.sku]||0)||minQty(p)}
  function productSubtitle(p){return [p.subcategoria,p.variante].filter(Boolean).join(' · ')}
  function initials(p){return String(p.producto||'RIX').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'RIX'}

  function renderTabs(){
    categoryTabs.innerHTML = categories().map(c=>`<button data-cat="${escapeAttr(c)}" class="${c===state.category?'active':''}">${c==='TODOS'?'Ver todos':title(c)}</button>`).join('');
    categoryTabs.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat;applyFilters();renderTabs()}));
  }

  function applyFilters(){
    const q=state.search.trim().toLowerCase();
    state.filtered=state.products.filter(p=>{
      const cat=state.category==='TODOS'||p.categoria===state.category;
      const hay=[p.sku,p.producto,p.marca,p.categoria,p.subcategoria,p.variante,p.descripcion].join(' ').toLowerCase();
      return cat && (!q || hay.includes(q));
    });
    renderProducts();
  }

  function productMedia(p){
    if(p.imagen){
      return `<figure class="product-media"><img src="${escapeAttr(p.imagen)}" alt="${escapeAttr(p.producto)} ${escapeAttr(p.variante||'')}" loading="lazy" onerror="this.parentElement.innerHTML='${fallbackMediaHtml(p).replace(/'/g,"\\'")}'"></figure>`;
    }
    return `<figure class="product-media">${fallbackMediaHtml(p)}</figure>`;
  }
  function fallbackMediaHtml(p){
    return `<div class="product-fallback"><div><span>${escapeHtml(initials(p))}</span><small>${escapeHtml(p.marca||'RIX')}</small></div></div>`;
  }

  function minimumText(p){
    const min=minQty(p), step=stepQty(p);
    if(min>1 || step>1) return `<strong>Pedido mínimo: ${min} u</strong><span>${step>1?`Múltiplo: ${step}`:'Unidad individual'}</span>`;
    return `<strong>Pedido mínimo: 1 u</strong><span>Unidad individual</span>`;
  }

  function renderProducts(){
    catalogTitle.textContent = state.category==='TODOS'?'Todos los productos':title(state.category);
    productCount.textContent = `${state.filtered.length} productos`;
    emptyState.classList.toggle('hidden',state.filtered.length!==0);
    productGrid.innerHTML=state.filtered.map(p=>{
      const qty=displayQty(p);
      const inCart=Number(state.cart[p.sku]||0)>0;
      const status=p.disponibilidad||'DISPONIBLE';
      return `<article class="product-card ${inCart?'in-cart':''}">
        <div class="product-top"><span class="sku">SKU ${escapeHtml(p.sku)}</span>${p.destacado?'<span class="badge">DESTACADO</span>':`<span class="badge">${escapeHtml(status)}</span>`}</div>
        ${productMedia(p)}
        <div class="product-family">${escapeHtml(p.marca||'RIX')}</div>
        <h3>${escapeHtml(p.producto)}</h3>
        <div class="product-meta">${escapeHtml(productSubtitle(p)||p.descripcion||'Producto mayorista RIX')}</div>
        <div class="price">${money.format(Number(p.precio||0))}</div>
        <div class="minimum-box"><i>□</i><div>${minimumText(p)}</div></div>
        <div class="qty-row">
          <button class="qty-step" data-minus="${escapeAttr(p.sku)}" aria-label="Restar ${escapeAttr(p.producto)}">−</button>
          <div class="qty-display ${inCart?'':'is-min'}">${qty}</div>
          <button class="qty-step" data-plus="${escapeAttr(p.sku)}" aria-label="Sumar ${escapeAttr(p.producto)}">+</button>
        </div>
        <button class="add-button" data-add="${escapeAttr(p.sku)}">${inCart?'Agregar más':'Agregar al pedido'}</button>
      </article>`;
    }).join('');
    productGrid.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.add,1,true)));
    productGrid.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.plus,1,false)));
    productGrid.querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.minus,-1,false)));
  }

  function setCartQty(sku,next){
    if(next<=0) delete state.cart[sku]; else state.cart[sku]=next;
    saveCart();renderCart();renderProducts();
  }
  function changeQty(sku,direction,fromAddButton){
    const p=productBySku(sku);
    if(!p) return;
    const min=minQty(p), step=stepQty(p), current=Number(state.cart[sku]||0);
    let next;
    if(direction>0){
      next=current===0?min:current+step;
    }else{
      next=current-step;
      if(current===0) next=0;
      if(next>0 && next<min) next=0;
    }
    setCartQty(sku,next);
    if(next>0){
      const extra=(min>1||step>1)?` · mínimo ${min} u`:'';
      toast(`SKU ${sku}: ${next} u.${extra}`);
    }else if(current>0){
      toast(`SKU ${sku} eliminado`);
    }else if(fromAddButton){
      toast(`SKU ${sku}: mínimo ${min} u.`);
    }
  }

  function renderCartBadge(){
    const units=Object.values(state.cart).reduce((a,b)=>a+Number(b),0);
    $('#cartCount').textContent=units;
  }

  function renderCart(){
    const items=Object.entries(state.cart).map(([sku,qty])=>({p:productBySku(sku),qty:Number(qty)})).filter(x=>x.p);
    const units=items.reduce((a,x)=>a+x.qty,0);
    const total=items.reduce((a,x)=>a+(Number(x.p.precio||0)*x.qty),0);
    $('#cartUnits').textContent=units;
    $('#cartTotal').textContent=money.format(total);
    $('#cartItems').innerHTML=items.length?items.map(({p,qty})=>`
      <div class="cart-item">
        <div class="cart-item-line">
          <div><strong>${escapeHtml(p.producto)}</strong><small>SKU ${escapeHtml(p.sku)} · ${escapeHtml(p.variante||'')} · mínimo ${minQty(p)} u</small></div>
          <strong>${money.format(Number(p.precio||0)*qty)}</strong>
        </div>
        <div class="cart-actions">
          <button data-cart-minus="${escapeAttr(p.sku)}">−</button>
          <span class="cart-qty">${qty} u.</span>
          <button data-cart-plus="${escapeAttr(p.sku)}">+</button>
          <button data-remove="${escapeAttr(p.sku)}">Quitar</button>
        </div>
      </div>`).join(''):'<div class="empty-state">Todavía no agregaste productos.</div>';
    $('#cartItems').querySelectorAll('[data-cart-minus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.cartMinus,-1,false)));
    $('#cartItems').querySelectorAll('[data-cart-plus]').forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.cartPlus,1,false)));
    $('#cartItems').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{delete state.cart[b.dataset.remove];saveCart();renderCart();renderProducts();toast('Producto quitado')}));
  }

  function configureCustomerForm(){
    const saved=loadCustomer();
    if(state.client){
      $('#customerBusiness').value=state.client.comercio||'';
      $('#customerName').value=state.client.contacto||'';
      $('#customerWhatsapp').value=state.client.whatsapp||'';
      ['#customerBusiness','#customerName','#customerWhatsapp'].forEach(id=>{$(id).readOnly=true});
      return;
    }
    $('#customerBusiness').value=saved.comercio||'';
    $('#customerName').value=saved.contacto||'';
    $('#customerWhatsapp').value=saved.whatsapp||'';
  }

  function openCart(){cartDrawer.classList.add('open');cartDrawer.setAttribute('aria-hidden','false');backdrop.classList.remove('hidden');renderCart()}
  function closeCart(){cartDrawer.classList.remove('open');cartDrawer.setAttribute('aria-hidden','true');backdrop.classList.add('hidden')}
  function showOrderModal(result){
    $('#modalOrderId').textContent=result.orderId||'Pedido recibido';
    $('#modalOrderMessage').textContent=result.message||'Un asesor de RIX confirmará disponibilidad y condiciones.';
    $('#orderModal').classList.remove('hidden');
  }
  function closeOrderModal(){ $('#orderModal').classList.add('hidden'); }

  async function sendOrder(){
    const items=Object.entries(state.cart).map(([sku,cantidad])=>({sku,cantidad:Number(cantidad)})).filter(i=>i.cantidad>0);
    if(!items.length){toast('Agregá productos antes de enviar.');return}

    const comercio=$('#customerBusiness').value.trim();
    const contacto=$('#customerName').value.trim();
    const whatsapp=$('#customerWhatsapp').value.trim();
    const observaciones=$('#customerNotes').value.trim();
    if(!comercio){toast('Ingresá el comercio o nombre del cliente.');$('#customerBusiness').focus();return}
    if(!contacto){toast('Ingresá el nombre de contacto.');$('#customerName').focus();return}
    if(!whatsapp){toast('Ingresá un WhatsApp de contacto.');$('#customerWhatsapp').focus();return}
    saveCustomer();

    const btn=$('#sendOrder');btn.disabled=true;btn.textContent='Enviando…';
    try{
      const result=await api.sendOrder({items,comercio,contacto,whatsapp,observaciones});
      if(!result.ok) throw new Error(result.message||'No se pudo enviar');
      if(result.demo){toast('Modo demo: todavía no se guardó en Sheets.');return}
      state.cart={};saveCart();renderCart();renderProducts();closeCart();showOrderModal(result);
    }catch(e){toast(e.message||'Error al enviar el pedido')}
    finally{btn.disabled=false;btn.textContent='Enviar pedido →'}
  }

  async function boot(){
    renderCartBadge();
    try{
      const data=await api.getCatalog();
      state.client=data.client||null;
      state.priceType=data.priceType||'';
      state.products=(data.products||[]).filter(p=>p.activo!==false);
      state.filtered=[...state.products];
      configureCustomerForm();renderTabs();applyFilters();renderCart();
      if(data.demo) toast('Catálogo en modo demo');
    }catch(e){productGrid.innerHTML=`<div class="empty-state">${escapeHtml(e.message||'No se pudo cargar el catálogo.')}</div>`;console.error(e)}
  }

  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value;applyFilters()});
  $('#cartButton').addEventListener('click',openCart);
  const navPedidos=$('#navPedidos'); if(navPedidos) navPedidos.addEventListener('click',openCart);
  $('#closeCart').addEventListener('click',closeCart);
  backdrop.addEventListener('click',closeCart);
  $('#sendOrder').addEventListener('click',sendOrder);
  $('#closeOrderModal').addEventListener('click',closeOrderModal);
  $('#orderModal').addEventListener('click',e=>{if(e.target.id==='orderModal')closeOrderModal()});
  ['#customerBusiness','#customerName','#customerWhatsapp'].forEach(id=>$(id).addEventListener('change',saveCustomer));
  boot();
})();
