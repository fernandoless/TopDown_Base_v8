(function(window){
  'use strict';

  const GameData = window.GameData = window.GameData || {
    ready: false,
    items: {},
    benches: {},
    benchRecipes: {},
    _listeners: []
  };

  function clone(value){
    if(value == null) return null;
    if(typeof structuredClone === 'function'){
      try { return structuredClone(value); } catch (err) { /* ignore */ }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      console.error('Falha ao clonar dados de jogo', err);
      return null;
    }
  }

  function indexGameData(){
    const catalog = {};
    const benches = {};
    const benchRecipes = {};
    const craft = GameData.craft || {};
    const pricing = GameData.pricing || {};

    (craft.recursos || []).forEach(res => {
      if(!res?.id) return;
      catalog[res.id] = {
        id: res.id,
        name: res.nome || res.id,
        type: res.categoria || 'recurso',
        description: res.desc || ''
      };
    });

    (craft.bancadas || []).forEach(bench => {
      if(!bench?.id) return;
      benches[bench.id] = {
        id: bench.id,
        nome: bench.nome || bench.id,
        desc: bench.desc || bench.descricao || ''
      };
    });

    (craft.midias || []).forEach(item => {
      if(!item?.id) return;
      const recipe = {
        id: item.id,
        name: item.nome || item.id,
        benchId: item.bancada || null,
        requirements: (item.essenciais || []).map(req => ({
          id: req.recurso,
          qty: Math.max(1, Math.round(req.qtd || 1))
        })),
        outputQty: 1,
        description: item.desc || ''
      };
      if(recipe.benchId){
        if(!benchRecipes[recipe.benchId]) benchRecipes[recipe.benchId] = [];
        benchRecipes[recipe.benchId].push(recipe);
      }
      catalog[item.id] = {
        id: item.id,
        name: item.nome || item.id,
        type: item.tipo || 'item',
        benchId: item.bancada || null,
        description: item.desc || '',
        price: typeof item.preco === 'number' ? item.preco : null,
        sale: typeof item.venda === 'number' ? item.venda : null
      };
    });

    (pricing.tabela_precos_midias || []).forEach(entry => {
      if(!entry?.id) return;
      const target = catalog[entry.id] || (catalog[entry.id] = { id: entry.id });
      target.name = target.name || entry.nome || entry.id;
      target.type = target.type || 'midia';
      target.price = typeof entry.preco === 'number' ? entry.preco : target.price;
      target.sale = typeof entry.venda === 'number' ? entry.venda : target.sale;
    });

    (pricing.tabela_precos_players || []).forEach(entry => {
      if(!entry?.id) return;
      const target = catalog[entry.id] || (catalog[entry.id] = { id: entry.id });
      target.name = target.name || entry.nome || entry.id;
      target.type = target.type || 'equipamento';
      target.price = typeof entry.preco === 'number' ? entry.preco : target.price;
      target.sale = typeof entry.venda === 'number' ? entry.venda : target.sale;
    });

    GameData.items = catalog;
    GameData.benches = benches;
    GameData.benchRecipes = benchRecipes;
  }

  function notifyReady(){
    GameData.ready = true;
    const listeners = Array.isArray(GameData._listeners) ? [...GameData._listeners] : [];
    GameData._listeners.length = 0;
    listeners.forEach(cb => {
      try { cb(GameData); } catch (err) { console.error(err); }
    });
    window.dispatchEvent(new CustomEvent('gamedata:ready', { detail: GameData }));
  }

  GameData.whenReady = function whenReady(cb){
    if(typeof cb !== 'function') return;
    if(GameData.ready){
      cb(GameData);
    }else{
      GameData._listeners.push(cb);
    }
  };

  GameData.getItem = function getItem(id){
    return id ? GameData.items[id] || null : null;
  };

  GameData.getBench = function getBench(id){
    return id ? GameData.benches[id] || null : null;
  };

  GameData.getRecipesForBench = function getRecipesForBench(id){
    if(!id) return [];
    const list = GameData.benchRecipes[id] || [];
    return list.map(recipe => ({
      ...recipe,
      requirements: (recipe.requirements || []).map(req => ({ ...req }))
    }));
  };

  GameData.getRecipe = function getRecipe(id){
    if(!id) return null;
    for(const recipes of Object.values(GameData.benchRecipes)){
      const found = recipes.find(recipe => recipe.id === id);
      if(found) return clone(found) || { ...found };
    }
    return null;
  };

  GameData.formatPrice = function formatPrice(value){
    const val = Math.max(0, Math.round(Number(value) || 0));
    if(!val) return 'Sem custo';
    return `${val} fitoeda${val > 1 ? 's' : ''}`;
  };

  GameData.load = function load(){
    if(GameData._loading) return GameData._loading;

    const readInlineJSON = (id)=>{
      try {
        const el = document.getElementById(id);
        if(!el) return null;
        return JSON.parse(el.textContent);
      } catch (err) {
        console.error('Falha ao parsear JSON embutido', id, err);
        return null;
      }
    };

    const isFile = location.protocol === 'file:';

    const craftPromise = isFile
      ? Promise.resolve(readInlineJSON('json_media_craft_v_1'))
      : fetch('json/media_craft_v_1.json').then(r => r.json()).catch(err => {
          console.error('Falha ao carregar craft.json', err);
          return null;
        });

    const pricingPromise = isFile
      ? Promise.resolve(readInlineJSON('json_tabela_precos_v_2'))
      : fetch('json/tabela_precos_v_2.json').then(r => r.json()).catch(err => {
          console.error('Falha ao carregar tabela_precos.json', err);
          return null;
        });

    GameData._loading = Promise.all([craftPromise, pricingPromise])
      .then(([craft, pricing]) => {
        if(craft) GameData.craft = craft;
        if(pricing) GameData.pricing = pricing;
        indexGameData();
        notifyReady();
        return GameData;
      })
      .catch(err => {
        console.error('Erro ao preparar dados globais', err);
        return GameData;
      });

    return GameData._loading;
  };

  // Pré-carrega assim que o arquivo é avaliado.
  GameData.load();

})(window);
