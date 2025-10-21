(function(window){
  'use strict';

  const world = document.getElementById('world');
  const viewport = document.getElementById('viewport');
  const playerEl = document.getElementById('player');
  const actorEl = document.getElementById('actor');
  const debugLayer = document.getElementById('debugLayer');
  const fadeEl = document.getElementById('fade');
  const bubbleEl = document.getElementById('bubble');
  const btnInteract = document.getElementById('btnInteract');
  const mapProgressEl = document.getElementById('mapProgress');

  const bgm = document.getElementById('bgm');
  const sfxStep = document.getElementById('sfxStep');
  const sfxPickup = document.getElementById('sfxPickup');
  const sfxGate = document.getElementById('sfxGate');
  const sfxNpc = document.getElementById('sfxNpc');

  sfxPickup && (sfxPickup.src ||= 'audio_pack/pickup.wav');
  sfxGate && (sfxGate.src ||= 'audio_pack/portal.wav');
  sfxNpc && (sfxNpc.src ||= 'audio_pack/npc.wav');

  const SPRITE_URL = 'sprites/personagem.png';
  const FRAME_W = 48;
  const FRAME_H = 48;
  const PLAYER_SCALE = 1;

  if(actorEl){
    actorEl.style.setProperty('--sprite-url', `url(${SPRITE_URL})`);
    actorEl.style.setProperty('--fw', FRAME_W + 'px');
    actorEl.style.setProperty('--fh', FRAME_H + 'px');
    actorEl.style.setProperty('--scale', PLAYER_SCALE);
  }

  const listeners = new Map();
  function on(event, handler){
    if(!event || typeof handler !== 'function') return;
    if(!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
  }
  function off(event, handler){
    const set = listeners.get(event);
    if(!set) return;
    if(handler){
      set.delete(handler);
    }else{
      set.clear();
    }
  }
  function emit(event, payload){
    const set = listeners.get(event);
    if(!set || !set.size) return;
    [...set].forEach(fn => {
      try { fn(payload); } catch (err) { console.error(err); }
    });
  }

  const state = {
    maps: {},
    currentMapId: null,
    player: { x: 200, y: 200, w: 28, h: 28, speed: 0.2, dir: 'down', moving: false },
    layers: { world, viewport, debug: debugLayer, entities: null },
    colliders: [],
    showSpots: true,
    frameIndex: 0,
    frameTick: 0,
    lastTime: 0,
    running: false,
    loopHandle: 0,
    tickPaused: false
  };

  function ensureEntitiesLayer(){
    if(state.layers.entities) return state.layers.entities;
    const layer = document.createElement('div');
    layer.id = 'entitiesLayer';
    layer.className = 'entities-layer';
    world?.appendChild(layer);
    state.layers.entities = layer;
    return layer;
  }

  function setCSSVar(name, value){
    document.documentElement.style.setProperty(name, value);
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function rectsOverlap(a, b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function fadeInOut(callback){
    if(!fadeEl){ callback?.(); return; }
    fadeEl.classList.add('show');
    setTimeout(()=>{
      callback?.();
      fadeEl.classList.remove('show');
    }, 280);
  }

  function playMapAudio(map){
    if(!map) return;
    if(bgm){
      if(map.music){
        bgm.src = map.music;
        bgm.volume = 0.6;
        bgm.play().catch(()=>{});
      }else{
        bgm.pause();
        bgm.removeAttribute('src');
      }
    }
    if(sfxStep){
      sfxStep.src = map.step || 'audio_pack/step_stone.wav';
    }
  }

  let stepCooldown = 0;
  function playStep(){
    if(!sfxStep || !sfxStep.src) return;
    const now = performance.now();
    if(now < stepCooldown) return;
    try {
      sfxStep.currentTime = 0;
      sfxStep.volume = 0.48;
      sfxStep.play().catch(()=>{});
    } catch (err) {
      /* ignore */
    }
    stepCooldown = now + 230;
  }

  function setBackground(map){
    if(!map) return;
    setCSSVar('--map-w', (map.width || 0) + 'px');
    setCSSVar('--map-h', (map.height || 0) + 'px');
    setCSSVar('--map-url', map.url ? `url(${map.url})` : 'none');
    setCSSVar('--map-bg', map.bgColor || '#111');
  }

  function drawEntities(map){
    const layer = ensureEntitiesLayer();
    if(!layer || !map) return;
    layer.innerHTML = '';
    (map.spots || []).forEach(spot => {
      if((spot.once || spot.type === 'pickFitoeda' || spot.type === 'pickPeca' || spot.type === 'resourcePickup') && spot.collected){
        return;
      }
      if(!spot.sprite) return;
      const el = document.createElement('div');
      el.className = 'entity';
      el.id = `ent-${spot.id}`;
      el.style.backgroundImage = `url(${spot.sprite})`;
      const spriteW = spot.spriteW ?? spot.spriteSize ?? 48;
      const spriteH = spot.spriteH ?? spot.spriteSize ?? 48;
      const offsetX = spot.spriteOffsetX ?? 0;
      const offsetY = spot.spriteOffsetY ?? 0;
      const left = Math.round(spot.x + spot.w / 2 - spriteW / 2 + offsetX);
      const top = Math.round(spot.y + spot.h - spriteH + offsetY);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${spriteW}px`;
      el.style.height = `${spriteH}px`;
      el.style.zIndex = String(3000 + top);
      layer.appendChild(el);
    });
  }

  function drawDebugLayer(map){
    if(!debugLayer || !map) return;
    debugLayer.innerHTML = '';
    (map.spots || []).forEach(spot => {
      const box = document.createElement('div');
      box.className = 'spot-box';
      box.dataset.id = spot.id;
      box.style.left = `${spot.x}px`;
      box.style.top = `${spot.y}px`;
      box.style.width = `${spot.w}px`;
      box.style.height = `${spot.h}px`;
      box.style.display = state.showSpots ? 'block' : 'none';
      if(spot.color){
        box.style.outlineColor = spot.color;
        box.style.backgroundColor = `${spot.color}2a`;
      }
      debugLayer.appendChild(box);
    });

    (map.colliders || []).forEach(col => {
      const box = document.createElement('div');
      box.className = 'collider-box';
      box.style.left = `${col.x}px`;
      box.style.top = `${col.y}px`;
      box.style.width = `${col.w}px`;
      box.style.height = `${col.h}px`;
      debugLayer.appendChild(box);
    });
  }

  function refreshMapLayers(){
    const map = state.maps[state.currentMapId];
    if(!map) return;
    drawEntities(map);
    drawDebugLayer(map);
  }

  function getMapProgress(map){
    if(!map) return { coinsTotal:0, coinsGot:0, salesTotal:0, salesGot:0, pecasTotal:0, pecasGot:0 };
    let coinsTotal = 0, coinsGot = 0;
    let pecasTotal = 0, pecasGot = 0;
    let salesTotal = 0, salesGot = 0;
    (map.spots || []).forEach(spot => {
      if(spot.type === 'pickFitoeda'){
        coinsTotal += 1;
        if(spot.collected) coinsGot += 1;
      }
      if(spot.type === 'pickPeca'){
        pecasTotal += 1;
        if(spot.collected) pecasGot += 1;
      }
      if(spot.type === 'npc_point'){
        salesTotal += 1;
        if(spot._awarded) salesGot += 1;
      }
    });
    return { coinsTotal, coinsGot, salesTotal, salesGot, pecasTotal, pecasGot };
  }

  function updateMapLabel(map){
    if(mapProgressEl){
      mapProgressEl.textContent = map?.name || map?.title || 'Mapa';
    }
  }

  function centerCamera(){
    const map = state.maps[state.currentMapId];
    if(!map || !viewport || !world) return;
    const { player } = state;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const targetX = clamp(player.x + player.w / 2 - vw / 2, 0, Math.max(0, map.width - vw));
    const targetY = clamp(player.y + player.h / 2 - vh / 2, 0, Math.max(0, map.height - vh));
    world.style.transform = `translate(${-targetX}px, ${-targetY}px)`;
  }

  function render(){
    const { player } = state;
    if(playerEl){
      playerEl.style.left = `${player.x}px`;
      playerEl.style.top = `${player.y}px`;
    }
    if(actorEl){
      const offsetX = -(FRAME_W / 2 - player.w / 2);
      const offsetY = -(FRAME_H - player.h);
      actorEl.style.left = `${player.x + offsetX}px`;
      actorEl.style.top = `${player.y + offsetY}px`;

      let row = 0;
      if(player.dir === 'down') row = 0;
      if(player.dir === 'right' || player.dir === 'left') row = 1;
      if(player.dir === 'up') row = 2;
      actorEl.style.transform = player.dir === 'left' ? 'scaleX(1)' : 'scaleX(-1)';

      state.frameTick += 1;
      if(player.moving){
        if(state.frameTick % 10 === 0){
          state.frameIndex = (state.frameIndex + 1) % 3;
        }
      }else{
        state.frameIndex = 1;
      }
      actorEl.style.backgroundPosition = `${-state.frameIndex * FRAME_W}px ${-row * FRAME_H}px`;
    }
  }

  function getState(){
    return {
      maps: state.maps,
      currentMapId: state.currentMapId,
      player: state.player,
      colliders: state.colliders,
      showSpots: state.showSpots,
      layers: { ...state.layers }
    };
  }

  function getCurrentMap(){
    return state.maps[state.currentMapId] || null;
  }

  function getSpotsInRange(rect){
    const map = getCurrentMap();
    if(!map) return [];
    return (map.spots || []).filter(spot => rectsOverlap(rect, spot));
  }

  function addEntity(element){
    const layer = ensureEntitiesLayer();
    if(!layer || !element) return null;
    layer.appendChild(element);
    return element;
  }

  function removeEntity(target){
    if(!target) return;
    if(typeof target === 'string'){
      document.getElementById(target)?.remove();
      return;
    }
    if(target instanceof HTMLElement){
      target.remove();
    }
  }

  function setShowSpots(value){
    state.showSpots = !!value;
    if(!debugLayer) return;
    debugLayer.querySelectorAll('.spot-box').forEach(box => {
      box.style.display = state.showSpots ? 'block' : 'none';
    });
  }

  function doInteract(spot){
    if(!spot) return;
    emit('interact:before', { spot });
    const NPC = window.NPC;
    const handler = NPC?.get?.(spot.type) || NPC?.default;
    if(typeof handler === 'function'){
      try {
        handler(spot);
      } catch (err) {
        console.error(err);
      }
    }
    emit('interact:after', { spot });
  }

  function removeCollectedSpots(){
    const map = getCurrentMap();
    if(!map) return;
    let changed = false;
    (map.spots || []).forEach(spot => {
      if((spot.once || spot.type === 'pickFitoeda' || spot.type === 'pickPeca' || spot.type === 'resourcePickup') && spot.collected && !spot._removed){
        const el = document.getElementById(`ent-${spot.id}`);
        if(el){ el.remove(); }
        spot._removed = true;
        changed = true;
      }
    });
    if(changed) drawDebugLayer(map);
  }

  function loadMap(id, options={}){
    const map = state.maps[id];
    if(!map) return;
    const spawn = options.spawn || map.playerStart;
    const apply = ()=>{
      state.currentMapId = id;
      state.colliders = map.colliders || [];
      const spawnX = typeof spawn?.x === 'number' ? spawn.x : map.playerStart?.x || 0;
      const spawnY = typeof spawn?.y === 'number' ? spawn.y : map.playerStart?.y || 0;
      state.player.x = spawnX;
      state.player.y = spawnY;
      state.player.moving = false;
      state.frameIndex = 0;
      state.frameTick = 0;
      setBackground(map);
      updateMapLabel(map);
      drawEntities(map);
      drawDebugLayer(map);
      playMapAudio(map);
      removeCollectedSpots();
      emit('map:loaded', { id, map });
      centerCamera();
      render();
    };

    if(options.immediate){
      apply();
    }else{
      fadeInOut(apply);
    }
  }

  function startLoop(){
    if(state.running) return;
    state.running = true;
    state.lastTime = performance.now();
    const step = (time)=>{
      if(!state.running) return;
      const dt = Math.min(32, time - state.lastTime);
      state.lastTime = time;
      emit('tick', { dt, time });
      centerCamera();
      render();
      state.loopHandle = window.requestAnimationFrame(step);
    };
    state.loopHandle = window.requestAnimationFrame(step);
  }

  function stopLoop(){
    state.running = false;
    if(state.loopHandle){
      window.cancelAnimationFrame(state.loopHandle);
      state.loopHandle = 0;
    }
  }

  function init(config={}){
    state.maps = config.maps || state.maps || {};
    const startId = config.startMapId || state.currentMapId || Object.keys(state.maps)[0];
    if(!startId){
      console.warn('Topdown.init chamado sem mapas cadastrados.');
      return;
    }
    ensureEntitiesLayer();
    loadMap(startId, { immediate: true });
    startLoop();
  }

  const Topdown = window.Topdown = {
    init,
    loadMap,
    getState,
    getCurrentMap,
    getMapProgress,
    getSpotsInRange,
    addEntity,
    removeEntity,
    drawDebugLayer,
    refreshMap: refreshMapLayers,
    doInteract,
    playMapAudio,
    playStep,
    setShowSpots,
    centerCamera,
    render,
    on,
    off,
    emit,
    stop: stopLoop,
    start: startLoop,
    get layers(){ return { ...state.layers }; },
    get player(){ return state.player; }
  };

  if(bubbleEl){
    bubbleEl.innerHTML = '';
    const nameEl = document.createElement('strong');
    nameEl.className = 'bubble-name';
    bubbleEl.appendChild(nameEl);
    bubbleEl.dataset.nameRef = nameEl.dataset.id = 'bubbleName';
  }

  if(btnInteract){
    btnInteract.hidden = true;
    btnInteract.dataset.defaultLabel = btnInteract.textContent || 'Interagir';
  }

  window.addEventListener('beforeunload', ()=> stopLoop());

})(window);
