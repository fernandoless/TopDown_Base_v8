(function(window){
  'use strict';

  const toastEl = document.getElementById('toast');
  const bubbleEl = document.getElementById('bubble');
  const btnInteract = document.getElementById('btnInteract');
  const btnToggleInventory = document.getElementById('btnToggleInventory');
  const btnCloseInventory = document.getElementById('btnCloseInventory');
  const inventoryPanel = document.getElementById('inventoryPanel');
  const inventoryListEl = document.getElementById('inventoryList');
  const fitoedasNowEl = document.getElementById('fitoedasNow');
  const coinsCountEl = document.getElementById('coinsCount');
  const salesCountEl = document.getElementById('salesCount');
  const pecasCountEl = document.getElementById('pecasCount');
  const mapProgressEl = document.getElementById('mapProgress');
  const clCoinsEl = document.getElementById('clCoins');
  const clSalesEl = document.getElementById('clSales');
  const clPecasEl = document.getElementById('clPecas');

  let bubbleNameEl = bubbleEl ? bubbleEl.querySelector('.bubble-name') : null;
  let toastTimer = null;
  let topdownRef = null;

  const playerState = window.PlayerState = window.PlayerState || {};
  playerState.coins = typeof playerState.coins === 'number' ? playerState.coins : 0;
  playerState.flags = playerState.flags || {};
  playerState.inventory = playerState.inventory || {};

  function toast(message, duration=1500){
    if(!toastEl) return;
    toastEl.textContent = message || '';
    toastEl.hidden = false;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(()=>{
      toastEl.classList.remove('show');
      toastEl.hidden = true;
    }, Math.max(500, duration || 0));
  }

  window.showToast = toast;

  function updateWallet(){
    if(fitoedasNowEl){
      fitoedasNowEl.textContent = String(playerState.coins ?? 0);
    }
  }

  function addFitoedas(amount=0, opts={}){
    const delta = Number(amount) || 0;
    if(!delta) return;
    playerState.coins = Math.max(0, Math.round((playerState.coins || 0) + delta));
    updateWallet();
    if(opts.message){ toast(opts.message, opts.duration || 1600); }
  }

  function spendFitoedas(amount=0){
    const cost = Number(amount) || 0;
    if(cost <= 0) return true;
    if((playerState.coins || 0) < cost) return false;
    playerState.coins = Math.max(0, Math.round((playerState.coins || 0) - cost));
    updateWallet();
    return true;
  }

  function getWallet(){
    return playerState;
  }

  const inventoryState = playerState.inventory;
  inventoryState.items = inventoryState.items || {};
  const inventoryItems = inventoryState.items;

  function normalizeQuantity(value){
    return Math.max(0, Math.round(Number(value) || 0));
  }

  function getCatalogInfo(id){
    return window.GameData && typeof window.GameData.getItem === 'function'
      ? window.GameData.getItem(id)
      : null;
  }

  function Inventory_getEntry(id){
    if(!id) return null;
    if(!inventoryItems[id]){
      inventoryItems[id] = { id, qty: 0 };
    }
    return inventoryItems[id];
  }

  function Inventory_getQuantity(id){
    return id && inventoryItems[id] ? inventoryItems[id].qty || 0 : 0;
  }

  function Inventory_getItemInfo(id){
    if(!id) return { id:null, name:'', qty:0 };
    const entry = inventoryItems[id];
    const catalogInfo = getCatalogInfo(id);
    let description;
    if(entry && entry.description !== undefined){
      description = entry.description;
    }else if(catalogInfo){
      const fromCatalog = catalogInfo.description ?? catalogInfo.desc;
      description = fromCatalog !== undefined ? fromCatalog : '';
    }else{
      description = '';
    }
    return {
      id,
      name: (entry && entry.name) || (catalogInfo && (catalogInfo.name || catalogInfo.titulo)) || id,
      qty: entry ? entry.qty || 0 : 0,
      type: (entry && entry.type) || (catalogInfo && catalogInfo.type) || null,
      description
    };
  }

  function Inventory_addItem(id, quantity=1, meta={}){
    if(!id) return null;
    const qty = Math.max(1, normalizeQuantity(quantity) || 1);
    const entry = Inventory_getEntry(id);
    const catalogInfo = getCatalogInfo(id) || {};
    entry.qty = (entry.qty || 0) + qty;
    entry.name = meta.name || entry.name || catalogInfo.name || catalogInfo.titulo || id;
    entry.type = meta.type || entry.type || catalogInfo.type || null;
    if(meta.description !== undefined){
      entry.description = meta.description;
    }else if(entry.description === undefined){
      entry.description = catalogInfo.description || catalogInfo.desc || '';
    }
    Inventory_updateUI();
    return entry;
  }

  function Inventory_removeItem(id, quantity=1){
    if(!id) return false;
    const entry = inventoryItems[id];
    if(!entry) return false;
    const qty = Math.max(1, normalizeQuantity(quantity) || 1);
    entry.qty = Math.max(0, (entry.qty || 0) - qty);
    if(entry.qty <= 0){
      delete inventoryItems[id];
    }
    Inventory_updateUI();
    return true;
  }

  function Inventory_hasItems(requirements=[]){
    if(!Array.isArray(requirements) || !requirements.length) return true;
    return requirements.every(req => {
      const need = Math.max(1, normalizeQuantity(req?.qty) || 1);
      return Inventory_getQuantity(req?.id) >= need;
    });
  }

  function Inventory_consumeItems(requirements=[]){
    if(!Array.isArray(requirements) || !requirements.length) return true;
    if(!Inventory_hasItems(requirements)) return false;
    requirements.forEach(req => {
      const id = req?.id;
      if(!id) return;
      const need = Math.max(1, normalizeQuantity(req.qty) || 1);
      const entry = inventoryItems[id];
      if(!entry) return;
      entry.qty = Math.max(0, (entry.qty || 0) - need);
      if(entry.qty <= 0){ delete inventoryItems[id]; }
    });
    Inventory_updateUI();
    return true;
  }

  function Inventory_list(){
    return Object.values(inventoryItems).map(entry => ({ ...entry }));
  }

  function renderInventoryList(){
    if(!inventoryListEl) return;
    inventoryListEl.innerHTML = '';
    const entries = Object.values(inventoryItems)
      .filter(entry => (entry.qty || 0) > 0)
      .sort((a, b) => {
        const nameA = (a.name || a.id || '').toString().toLowerCase();
        const nameB = (b.name || b.id || '').toString().toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });

    if(!entries.length){
      const empty = document.createElement('li');
      empty.className = 'inventory-empty';
      empty.textContent = 'Inventário vazio';
      inventoryListEl.appendChild(empty);
      return;
    }

    entries.forEach(entry => {
      const info = Inventory_getItemInfo(entry.id);
      const li = document.createElement('li');
      li.className = 'inventory-item';

      const line = document.createElement('div');
      line.className = 'inventory-item-line';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'inventory-item-name';
      nameSpan.textContent = info.name || entry.id;

      const qtySpan = document.createElement('span');
      qtySpan.className = 'inventory-item-qty';
      qtySpan.textContent = `x${info.qty}`;

      line.appendChild(nameSpan);
      line.appendChild(qtySpan);
      li.appendChild(line);

      const metaText = info.description || info.type;
      if(metaText){
        const metaLine = document.createElement('div');
        metaLine.className = 'inventory-item-meta';
        metaLine.textContent = metaText;
        li.appendChild(metaLine);
      }

      inventoryListEl.appendChild(li);
    });
  }

  function Inventory_updateUI(){
    renderInventoryList();
    if(window.Crafting && typeof window.Crafting.refresh === 'function'){
      window.Crafting.refresh();
    }
  }

  function isInventoryOpen(){
    return inventoryPanel ? !inventoryPanel.hidden : false;
  }

  function openInventory(){
    if(inventoryPanel){ inventoryPanel.hidden = false; }
    Inventory_updateUI();
  }

  function closeInventory(){
    if(inventoryPanel){ inventoryPanel.hidden = true; }
  }

  function toggleInventory(force){
    const shouldOpen = typeof force === 'boolean' ? force : !isInventoryOpen();
    if(shouldOpen){ openInventory(); }
    else { closeInventory(); }
  }

  btnToggleInventory?.addEventListener('click', ()=> toggleInventory());
  btnCloseInventory?.addEventListener('click', ()=> closeInventory());

  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && isInventoryOpen() && !(window.Dialogs && window.Dialogs.isOpen)){
      closeInventory();
    }
  });

  const InventoryAPI = window.Inventory = window.Inventory || {};
  Object.assign(InventoryAPI, {
    add: Inventory_addItem,
    addItem: Inventory_addItem,
    remove: Inventory_removeItem,
    removeItem: Inventory_removeItem,
    getQuantity: Inventory_getQuantity,
    hasItems: Inventory_hasItems,
    consume: Inventory_consumeItems,
    list: Inventory_list,
    info: Inventory_getItemInfo,
    open: openInventory,
    close: closeInventory,
    toggle: toggleInventory,
    isOpen: isInventoryOpen,
    update: Inventory_updateUI
  });

  const Crafting = window.Crafting = window.Crafting || {};
  Crafting.canCraft = function(recipe){
    if(!recipe) return false;
    return Inventory_hasItems(recipe.requirements || []);
  };
  Crafting.describeRequirements = function(recipe){
    return (recipe?.requirements || []).map(req => {
      const info = Inventory_getItemInfo(req.id);
      return `${Math.max(1, req.qty || 1)}x ${info.name}`;
    }).join(', ');
  };
  Crafting.craftRecipe = function(recipe){
    if(!recipe) return false;
    if(!Crafting.canCraft(recipe)){
      toast('Faltam recursos para esse projeto.', 1600);
      return false;
    }
    Inventory_consumeItems(recipe.requirements || []);
    const qty = Math.max(1, recipe.outputQty || 1);
    Inventory_addItem(recipe.id, qty, { name: recipe.name, description: recipe.description, type: recipe.type || 'item' });
    const label = qty > 1 ? `${qty}x ${recipe.name || recipe.id}` : (recipe.name || recipe.id);
    toast(`Você fabricou ${label}!`, 1600);
    return true;
  };
  Crafting.refresh = function(){
    if(window.Dialogs && typeof window.Dialogs.getActiveType === 'function' && window.Dialogs.getActiveType() === 'craft'){
      if(typeof window.Dialogs.rerender === 'function'){
        window.Dialogs.rerender();
      }
    }
  };

  function syncHover(spot){
    if(!bubbleEl) return;
    const dialogOpen = !!(window.Dialogs && window.Dialogs.isOpen);
    if(dialogOpen){ hideInteractionPrompt(); return; }
    const interactable = new Set(['dialog', 'gate', 'craftBench', 'npc_point', 'shop']);
    if(!spot || !interactable.has(spot.type)){
      hideInteractionPrompt();
      return;
    }
    const cx = Math.round(spot.x + spot.w / 2);
    const top = Math.round(spot.y);
    bubbleEl.style.left = `${cx}px`;
    bubbleEl.style.top = `${top}px`;
    if(!bubbleNameEl){
      bubbleNameEl = document.createElement('strong');
      bubbleNameEl.className = 'bubble-name';
      bubbleEl.appendChild(bubbleNameEl);
    }
    bubbleNameEl.textContent = spot.npcName || spot.title || spot.name || 'Interação';
    bubbleEl.hidden = false;
    if(btnInteract){
      btnInteract.hidden = false;
      btnInteract.textContent = spot.interactLabel || btnInteract.dataset?.defaultLabel || 'Interagir';
    }
  }

  function hideInteractionPrompt(){
    if(bubbleEl){ bubbleEl.hidden = true; }
    if(btnInteract){
      btnInteract.hidden = true;
      btnInteract.textContent = btnInteract.dataset?.defaultLabel || 'Interagir';
    }
  }

  function updateProgress(){
    if(!topdownRef) return;
    const map = topdownRef.getCurrentMap();
    const progress = topdownRef.getMapProgress(map);
    if(coinsCountEl) coinsCountEl.textContent = `${progress.coinsGot}/${progress.coinsTotal}`;
    if(salesCountEl) salesCountEl.textContent = `${progress.salesGot}/${progress.salesTotal}`;
    if(pecasCountEl) pecasCountEl.textContent = `${progress.pecasGot}/${progress.pecasTotal}`;
    if(clCoinsEl) clCoinsEl.textContent = `${progress.coinsGot}/${progress.coinsTotal}`;
    if(clSalesEl) clSalesEl.textContent = `${progress.salesGot}/${progress.salesTotal}`;
    if(clPecasEl) clPecasEl.textContent = `${progress.pecasGot}/${progress.pecasTotal}`;
    if(mapProgressEl) mapProgressEl.textContent = map?.name || map?.title || 'Mapa';
  }

  const UI = window.UI = window.UI || {};

  UI.init = function init(topdown){
    topdownRef = topdown || null;
    updateWallet();
    updateProgress();
    if(topdownRef){
      topdownRef.on('map:loaded', ()=>{
        updateProgress();
        syncHover(null);
      });
      topdownRef.on('interact:after', ()=>{
        window.requestAnimationFrame(()=> syncHover(window.hoveringSpot || null));
      });
    }
    return UI;
  };

  UI.updateProgress = updateProgress;
  UI.updateWallet = updateWallet;
  UI.toast = toast;
  UI.syncHover = syncHover;
  UI.hideInteractionPrompt = hideInteractionPrompt;
  UI.getPlayerState = ()=> playerState;

  window.NPC_addFitoedas = addFitoedas;
  window.NPC_spendFitoedas = spendFitoedas;
  window.NPC_getWallet = getWallet;

  window.NPC_syncHoverUI = ()=> syncHover(window.hoveringSpot || null);

})(window);
