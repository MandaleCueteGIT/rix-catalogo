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

  function categories(){return ['TODOS',...new Set(state.products.map(p=>p.categoria).filter(Boolean))]}
  function renderTabs(){
    categoryTabs.innerHTML = categories().map(c=>`<button data-cat="${escapeHtml(c)}" class="${c===state.category?'active':''}">${c==='TODOS'?'Todos':title(c)}</button>`).join('');
    categoryTabs.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat;applyFilters();renderTabs()}));
  }
  function title(v=''){return v.toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}

  function applyFilters(){
    const q=state.search.trim().toLowerCase();
    state.filtered=state.products.filter(p=>{
      const cat=state.category==='TODOS'||p.categoria===state.category;
      const hay=[p.sku,p.producto,p.marca,p.categoria,p.subcategoria,p.variante,p.descripcion].join(' ').toLowerCase();
      return cat && (!q || hay.includes(q));
    });
    renderProducts();
  }

  function renderProducts(){
    catalogTitle.textContent = state.category==='TODOS'?'Todos los productos':title(state.category);
    productCount.textContent = `${state.filtered.length} productos`;
    emptyState.classList.toggle('hidden',state.filtered.length!==0);
    productGrid.innerHTML=state.filtered.map(p=>`
      <article class="product-card">
        <div class="product-top"><span class="sku">SKU ${escapeHtml(p.sku)}</span>${p.destacado?'<span class="badge">DESTACADO</span>':''}</div>
        <h3>${escapeHtml(p.producto)}</h3>
        <div class="product-meta">${escapeHtml(p.marca||'')} · ${escapeHtml(p.variante||'')}</div>
        <div class="price">${money.format(Number(p.precio||0))}</div>
        <div class="qty-row">
          <button class="qty-step" data-minus="${escapeHtml(p.sku)}">−</button>
          <button class="add-button" data-add="${escapeHtml(p.sku)}">Agregar al pedido</button>
          <button class="qty-step" data-plus="${escapeHtml(p.sku)}">+</button>
        </div>
      </article>`).join('');
    productGrid.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.add,1)));
    productGrid.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.plus,1)));
    productGrid.querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.minus,-1)));
  }

  function productBySku(sku){return state.products.find(p=>String(p.sku)===String(sku))}
  function add(sku,delta){
    const p=productBySku(sku);
    if(!p) return;
    const minimum=Math.max(1,Number(p.pedidoMinimo||1));
    const current=Number(state.cart[sku]||0);
    let next=current+delta;
    if(delta>0 && current===0) next=minimum;
    if(next>0 && next<minimum) next=0;
    next=Math.max(0,next);
    if(next===0) delete state.cart[sku]; else state.cart[sku]=next;
    saveCart(); renderCart(); toast(next?`SKU ${sku}: ${next} u.`:`SKU ${sku} eliminado`);
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
        <div class="cart-item-line"><div><strong>${escapeHtml(p.producto)}</strong><br><small>SKU ${escapeHtml(p.sku)} · ${escapeHtml(p.variante||'')}</small></div><strong>${money.format(Number(p.precio||0)*qty)}</strong></div>
        <div class="cart-actions"><button data-cart-minus="${escapeHtml(p.sku)}">−</button><strong>${qty} u.</strong><button data-cart-plus="${escapeHtml(p.sku)}">+</button><button data-remove="${escapeHtml(p.sku)}">Quitar</button></div>
      </div>`).join(''):'<div class="empty-state">Todavía no agregaste productos.</div>';
    $('#cartItems').querySelectorAll('[data-cart-minus]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.cartMinus,-1)));
    $('#cartItems').querySelectorAll('[data-cart-plus]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.cartPlus,1)));
    $('#cartItems').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{delete state.cart[b.dataset.remove];saveCart();renderCart()}));
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
      state.cart={};saveCart();renderCart();closeCart();
      alert(`Pedido recibido: ${result.orderId}\n\n${result.message||'RIX confirmará disponibilidad y condiciones.'}`);
    }catch(e){toast(e.message||'Error al enviar el pedido')}
    finally{btn.disabled=false;btn.textContent='Enviar pedido'}
  }

  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

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
  $('#closeCart').addEventListener('click',closeCart);
  backdrop.addEventListener('click',closeCart);
  $('#sendOrder').addEventListener('click',sendOrder);
  ['#customerBusiness','#customerName','#customerWhatsapp'].forEach(id=>$(id).addEventListener('change',saveCustomer));
  boot();
})();
