(function(window){
  'use strict';

  const btnInteract = document.getElementById('btnInteract');
  const btnToggleJoy = document.getElementById('btnToggleJoy');
  const btnToggleSpots = document.getElementById('btnToggleSpots');
  const debugLayer = document.getElementById('debugLayer');
  const joy = document.getElementById('joystick');
  const joyKnob = document.getElementById('joyStick');

  const keys = { ArrowUp:false,ArrowDown:false,ArrowLeft:false,ArrowRight:false, w:false,a:false,s:false,d:false };
  const justPressed = new Set();
  let enabled = true;
  let topdownRef = null;
  let unsubscribeTick = null;
  let joyEnabled = true;
  let showSpots = true;
  const joyState = { active:false, dx:0, dy:0 };
  let joyCenter = { x:0, y:0 };

  const hoverableTypes = new Set(['dialog', 'gate', 'craftBench', 'npc_point', 'shop']);

  function setHover(spot){
    window.hoveringSpot = spot || null;
    window.UI?.syncHover?.(window.hoveringSpot);
  }

  function keyJustPressed(code){
    if(!justPressed.has(code)) return false;
    justPressed.delete(code);
    return true;
  }

  window.addEventListener('keydown', event => {
    const key = (event.key || '').length === 1 ? event.key.toLowerCase() : event.key;
    if(event.repeat) return;

    if(key === 'i'){
      if(window.Inventory && typeof window.Inventory.toggle === 'function'){
        window.Inventory.toggle();
        event.preventDefault();
      }
      return;
    }

    if(key === 'Escape' || event.key === 'Escape'){
      if(window.Inventory && typeof window.Inventory.isOpen === 'function' && window.Inventory.isOpen()){
        window.Inventory.close?.();
        event.preventDefault();
        return;
      }
    }

    if(key in keys){ keys[key] = true; }
    if(key === 'Enter' || event.key === 'Enter') justPressed.add('Enter');
  }, { passive: true });

  window.addEventListener('keyup', event => {
    const key = (event.key || '').length === 1 ? event.key.toLowerCase() : event.key;
    if(key in keys) keys[key] = false;
  }, { passive: true });

  btnInteract?.addEventListener('click', ()=>{
    if(window.hoveringSpot){
      window.Topdown?.doInteract(window.hoveringSpot);
    }
  });

  function joyStart(event){
    joyState.active = true;
    const rect = joy.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    updateJoy(event);
  }

  function joyEnd(){
    joyState.active = false;
    joyState.dx = joyState.dy = 0;
    if(joyKnob){
      joyKnob.style.left = '50%';
      joyKnob.style.top = '50%';
    }
  }

  function updateJoy(event){
    if(!joyState.active) return;
    const touch = (event.touches && event.touches[0]) || event;
    const dx = touch.clientX - joyCenter.x;
    const dy = touch.clientY - joyCenter.y;
    const max = 70;
    const len = Math.hypot(dx, dy);
    const nx = len ? dx / len : 0;
    const ny = len ? dy / len : 0;
    const cl = Math.min(max, len);
    if(joyKnob){
      joyKnob.style.left = `calc(50% + ${nx * cl}px)`;
      joyKnob.style.top = `calc(50% + ${ny * cl}px)`;
    }
    joyState.dx = nx;
    joyState.dy = ny;
  }

  joy?.addEventListener('pointerdown', joyStart);
  window.addEventListener('pointermove', updateJoy);
  window.addEventListener('pointerup', joyEnd);

  btnToggleJoy?.addEventListener('click', ()=>{
    joyEnabled = !joyEnabled;
    if(joy){ joy.style.display = joyEnabled ? 'block' : 'none'; }
    if(!joyEnabled){ joyEnd(); }
  });

  btnToggleSpots?.addEventListener('click', ()=>{
    showSpots = !showSpots;
    window.Topdown?.setShowSpots(showSpots);
    if(debugLayer){
      debugLayer.querySelectorAll('.spot-box').forEach(box => {
        box.style.display = showSpots ? 'block' : 'none';
      });
    }
  });

  function desiredDelta(){
    let dx = 0;
    let dy = 0;
    if(keys.ArrowUp || keys.w) dy -= 1;
    if(keys.ArrowDown || keys.s) dy += 1;
    if(keys.ArrowLeft || keys.a) dx -= 1;
    if(keys.ArrowRight || keys.d) dx += 1;
    if(joyEnabled && joyState.active){
      dx += joyState.dx;
      dy += joyState.dy;
    }
    if(dx || dy){
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  }

  function rectsOverlap(a, b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function tryMove(dt){
    const state = topdownRef?.getState?.();
    if(!state) return;
    const { player } = state;
    const map = topdownRef.getCurrentMap();
    if(!map) return;

    const { dx, dy } = desiredDelta();
    const speed = player.speed * dt;
    player.moving = !!(dx || dy);
    if(player.moving){
      if(Math.abs(dx) > Math.abs(dy)){
        player.dir = dx > 0 ? 'right' : 'left';
      }else{
        player.dir = dy > 0 ? 'down' : 'up';
      }
    }

    let nx = player.x + dx * speed;
    let ny = player.y + dy * speed;

    const colliders = state.colliders || [];
    const hitbox = { x: nx, y: ny, w: player.w, h: player.h };
    for(const col of colliders){
      if(!rectsOverlap(hitbox, col)) continue;
      const xOnly = { x: nx, y: player.y, w: player.w, h: player.h };
      const yOnly = { x: player.x, y: ny, w: player.w, h: player.h };
      if(rectsOverlap(xOnly, col)) nx = player.x;
      if(rectsOverlap(yOnly, col)) ny = player.y;
    }

    player.x = clamp(nx, 0, Math.max(0, map.width - player.w));
    player.y = clamp(ny, 0, Math.max(0, map.height - player.h));

    if(player.moving){
      topdownRef?.playStep?.();
    }
  }

  function handlePickupSpot(spot){
    if(!spot || spot.collected) return false;
    spot.collected = true;
    document.getElementById(`ent-${spot.id}`)?.remove();
    try {
      const audio = document.getElementById('sfxPickup');
      if(audio?.src){ audio.currentTime = 0; audio.play().catch(()=>{}); }
    } catch (err) {
      /* ignore */
    }

    if(spot.type === 'pickFitoeda'){
      const value = spot.value || 1;
      window.NPC_addFitoedas?.(value, { message: spot.text || `+${value} fitoeda${value>1?'s':''}!` });
    }else if(spot.type === 'pickPeca'){
      window.Inventory?.addItem?.('peca_eletronica', spot.value || 1, {
        name: 'Peça eletrônica',
        description: 'Componentes reaproveitados para projetos futuros.',
        type: 'recurso'
      });
      window.showToast?.(spot.text || '+1 peça eletrônica!', 1400);
      spot._awarded = true;
    }else if(spot.type === 'resourcePickup'){
      const resourceId = spot.resourceId;
      const quantity = spot.quantity || 1;
      if(resourceId){
        const info = window.GameData?.getItem?.(resourceId) || {};
        window.Inventory?.addItem?.(resourceId, quantity, {
          name: spot.resourceName || info.name || resourceId,
          description: spot.resourceDescription || info.description || info.desc || '',
          type: 'recurso'
        });
      }
      if(spot.text){ window.showToast?.(spot.text, 1300); }
    }

    window.UI?.updateProgress?.();
    return true;
  }

  function updateSpots(){
    const map = topdownRef?.getCurrentMap?.();
    const state = topdownRef?.getState?.();
    if(!map || !state) return;
    const { player } = state;
    const me = { x: player.x, y: player.y, w: player.w, h: player.h };
    let hover = null;

    (map.spots || []).forEach(spot => {
      if(!rectsOverlap(me, spot)) return;
      if(spot.type === 'pickFitoeda' || spot.type === 'pickPeca' || spot.type === 'resourcePickup'){
        const collected = handlePickupSpot(spot);
        if(collected){ topdownRef?.refreshMap?.(); }
        return;
      }
      if(!hover && hoverableTypes.has(spot.type)){
        hover = spot;
      }
    });

    setHover(hover);

    if(hover && keyJustPressed('Enter') && !(window.Dialogs && window.Dialogs.isOpen)){
      topdownRef?.doInteract?.(hover);
    }
  }

  function handleTick({ dt }){
    if(!enabled) return;
    if(window.Dialogs && window.Dialogs.isOpen) return;
    tryMove(dt);
    updateSpots();
  }

  function attach(topdown){
    if(!topdown) return;
    topdownRef = topdown;
    window.hoveringSpot = null;
    setHover(null);
    if(unsubscribeTick){ unsubscribeTick(); }
    const tickHandler = payload => handleTick(payload || { dt:16 });
    topdownRef.on('tick', tickHandler);
    unsubscribeTick = ()=> topdownRef.off('tick', tickHandler);
    topdownRef.on('map:loaded', ()=>{
      setHover(null);
    });
    topdownRef.init({ maps: window.GAME_MAPS || {}, startMapId: window.GAME_START_MAP || Object.keys(window.GAME_MAPS || {})[0] });
    window.UI?.init?.(topdownRef);
  }

  function detach(){
    if(unsubscribeTick){ unsubscribeTick(); unsubscribeTick = null; }
    topdownRef = null;
  }

  function setEnabled(value){
    enabled = !!value;
  }

  const Input = window.Input = window.Input || {};
  Input.attach = attach;
  Input.detach = detach;
  Input.setEnabled = setEnabled;

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){
      Object.keys(keys).forEach(key => { keys[key] = false; });
      joyEnd();
    }
  });

  window.addEventListener('load', ()=>{
    if(window.Topdown){
      Input.attach(window.Topdown);
    }
  });

})(window);
