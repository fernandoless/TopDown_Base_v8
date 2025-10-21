(function(window){
  'use strict';

  const sfxNpc = document.getElementById('sfxNpc');
  const sfxGate = document.getElementById('sfxGate');

  const presetLibrary = {};

  function cloneDialog(dialog){
    if(!dialog) return null;
    if(typeof structuredClone === 'function'){
      try { return structuredClone(dialog); } catch (err) { /* fallback */ }
    }
    try {
      return JSON.parse(JSON.stringify(dialog));
    } catch (err) {
      console.error('Falha ao clonar diálogo', err);
      return null;
    }
  }

  function registerPreset(id, dialog){
    if(!id || !dialog) return;
    presetLibrary[id] = cloneDialog(dialog);
  }

  function getPreset(id){
    return id && presetLibrary[id] ? cloneDialog(presetLibrary[id]) : null;
  }

  function createSequenceDialog(lines=[], meta={}){
    const normalized = Array.isArray(lines) && lines.length ? [...lines] : ['Olá!'];
    return { type: 'sequence', lines: normalized, meta: { ...meta } };
  }

  function createChoiceDialog(prompt, options=[], meta={}){
    const normalized = Array.isArray(options) ? options.map(opt => ({ ...opt })) : [];
    return { type: 'choice', prompt: prompt || 'Escolha uma opção:', options: normalized, meta: { ...meta } };
  }

  function createShopDialog(intro, items=[], meta={}){
    const normalized = Array.isArray(items) ? items.map(item => ({ ...item })) : [];
    return { type: 'shop', intro: intro || 'Dá uma olhada no que temos.', items: normalized, meta: { ...meta } };
  }

  function createCraftDialog(intro, recipes=[], meta={}){
    const normalized = Array.isArray(recipes)
      ? recipes.map(recipe => ({
          ...recipe,
          requirements: (recipe.requirements || []).map(req => ({ ...req }))
        }))
      : [];
    return { type: 'craft', intro: intro || 'Escolha um projeto para fabricar.', recipes: normalized, meta: { ...meta }, benchId: meta?.benchId || null };
  }

  let overlayEl = null;
  let cardEl = null;
  let portraitEl = null;
  let titleEl = null;
  let subtitleEl = null;
  let textEl = null;
  let optionsEl = null;
  let listEl = null;
  let footerEl = null;
  let keydownHandler = null;
  let activeSession = null;

  function ensureUI(){
    if(overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'dialog-overlay';
    overlayEl.setAttribute('role', 'presentation');

    cardEl = document.createElement('div');
    cardEl.className = 'dialog-card';
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-modal', 'true');

    const headerEl = document.createElement('header');
    headerEl.className = 'dialog-header';

    portraitEl = document.createElement('img');
    portraitEl.className = 'dialog-portrait';
    portraitEl.alt = '';
    portraitEl.hidden = true;

    const titlesWrap = document.createElement('div');
    titlesWrap.className = 'dialog-titles';

    titleEl = document.createElement('h2');
    titleEl.className = 'dialog-title';
    titleEl.textContent = 'Diálogo';

    subtitleEl = document.createElement('p');
    subtitleEl.className = 'dialog-subtitle';
    subtitleEl.hidden = true;

    titlesWrap.appendChild(titleEl);
    titlesWrap.appendChild(subtitleEl);

    headerEl.appendChild(portraitEl);
    headerEl.appendChild(titlesWrap);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'dialog-body';

    textEl = document.createElement('p');
    textEl.className = 'dialog-text';

    optionsEl = document.createElement('div');
    optionsEl.className = 'dialog-options';
    optionsEl.hidden = true;

    listEl = document.createElement('div');
    listEl.className = 'dialog-list';
    listEl.hidden = true;

    bodyEl.appendChild(textEl);
    bodyEl.appendChild(optionsEl);
    bodyEl.appendChild(listEl);

    footerEl = document.createElement('footer');
    footerEl.className = 'dialog-footer';

    cardEl.appendChild(headerEl);
    cardEl.appendChild(bodyEl);
    cardEl.appendChild(footerEl);

    overlayEl.appendChild(cardEl);
    document.body.appendChild(overlayEl);
  }

  function resetSections(){
    textEl.textContent = '';
    optionsEl.innerHTML = '';
    optionsEl.hidden = true;
    listEl.innerHTML = '';
    listEl.hidden = true;
    footerEl.innerHTML = '';
  }

  function setHeader(meta){
    const header = meta || {};
    titleEl.textContent = header.title || header.speaker || 'Diálogo';
    if(header.subtitle || header.speaker){
      subtitleEl.hidden = false;
      subtitleEl.textContent = header.subtitle || header.speaker || '';
    }else{
      subtitleEl.hidden = true;
      subtitleEl.textContent = '';
    }
    if(header.portrait){
      portraitEl.hidden = false;
      portraitEl.src = header.portrait;
    }else{
      portraitEl.hidden = true;
      portraitEl.removeAttribute('src');
    }
  }

  function setFooterButtons(buttons=[]){
    footerEl.innerHTML = '';
    const items = Array.isArray(buttons) ? buttons : [];
    items.forEach(config => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialog-button' + (config.variant === 'secondary' ? ' secondary' : '');
      btn.textContent = config.label || 'Ok';
      btn.addEventListener('click', ()=>{
        if(typeof config.onClick === 'function'){
          config.onClick();
        }
      });
      footerEl.appendChild(btn);
    });
    return footerEl.querySelector('button') || null;
  }

  function focusFirstInteractive(){
    const focusable = cardEl.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if(focusable.length > 0 && focusable[0] instanceof HTMLElement){
      focusable[0].focus();
    }
  }

  function showOverlay(){
    if(!overlayEl) return;
    overlayEl.classList.add('show');
    document.body.classList.add('dialog-open');
    if(!keydownHandler){
      keydownHandler = (event)=>{
        if(event.key === 'Escape'){
          const back = activeSession?.nav?.back;
          if(back){ event.preventDefault(); back(); }
        }else if(event.key === 'Enter'){
          const forward = activeSession?.nav?.forward;
          if(forward){ event.preventDefault(); forward(); }
        }
      };
      document.addEventListener('keydown', keydownHandler);
    }
  }

  function hideOverlay(){
    if(!overlayEl) return;
    overlayEl.classList.remove('show');
    document.body.classList.remove('dialog-open');
    if(keydownHandler){
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
  }

  function closeDialog(reason){
    if(!activeSession) return;
    const session = activeSession;
    activeSession = null;
    window.Dialogs.isOpen = false;
    hideOverlay();
    if(typeof session.dialog.onClose === 'function'){
      try { session.dialog.onClose({ reason, spot: session.meta.spot || null }); } catch (err) { console.error(err); }
    }
    if(typeof session.meta.onClose === 'function'){
      try { session.meta.onClose({ reason, dialog: session.dialog, spot: session.meta.spot || null }); } catch (err) { console.error(err); }
    }
  }

  function handleOptionSelection(option, context){
    if(!option) return;
    if(typeof option.onSelect === 'function'){
      try { option.onSelect({ option, spot: context.spot || null }); } catch (err) { console.error(err); }
    }
    if(option.next){
      const nextDialog = resolveDialog(option.next);
      if(nextDialog){
        openDialog(nextDialog, context.meta);
        return;
      }
    }
    if(option.close !== false){
      closeDialog('choice');
    }
  }

  function resolveDialog(candidate){
    if(!candidate) return null;
    if(typeof candidate === 'string') return getPreset(candidate);
    return cloneDialog(candidate);
  }

  const renderers = {
    sequence(dialog, context){
      const lines = dialog.lines && dialog.lines.length ? dialog.lines : ['...'];
      let index = 0;

      function update(){
        textEl.textContent = lines[index] || '';
        const goBack = ()=>{
          if(index > 0){ index = Math.max(0, index - 1); update(); }
        };
        const goForward = ()=>{
          if(index < lines.length - 1){
            index = Math.min(lines.length - 1, index + 1);
            update();
          }else{
            closeDialog('sequence');
          }
        };

        setFooterButtons([
          index > 0 ? { label: '<<', variant: 'secondary', onClick: goBack } : null,
          { label: index < lines.length - 1 ? '>>' : 'Fechar', onClick: goForward }
        ].filter(Boolean));
        if(activeSession){
          activeSession.nav = {
            back: index > 0 ? goBack : null,
            forward: goForward
          };
        }
        focusFirstInteractive();
      }

      update();
    },

    choice(dialog, context){
      textEl.textContent = dialog.prompt || 'Escolha uma opção:';
      optionsEl.hidden = false;
      optionsEl.innerHTML = '';

      (dialog.options || []).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dialog-option';

        const label = document.createElement('span');
        label.className = 'dialog-option-title';
        label.textContent = option.label || 'Opção';
        button.appendChild(label);

        if(option.description){
          const desc = document.createElement('span');
          desc.className = 'dialog-option-desc';
          desc.textContent = option.description;
          button.appendChild(desc);
        }

        button.addEventListener('click', ()=> handleOptionSelection(option, context));
        optionsEl.appendChild(button);
      });

      const cancelBtn = setFooterButtons([{ label: 'Fechar', variant: 'secondary', onClick: ()=> closeDialog('choice-cancel') }]);
      (optionsEl.querySelector('button') || cancelBtn)?.focus();
      if(activeSession){
        activeSession.nav = {
          back: ()=> closeDialog('choice-cancel'),
          forward: null
        };
      }
    },

    shop(dialog){
      textEl.textContent = dialog.intro || 'Veja os itens disponíveis.';
      listEl.hidden = false;
      listEl.innerHTML = '';

      (dialog.items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'dialog-item';

        const info = document.createElement('div');
        info.className = 'dialog-item-info';

        const name = document.createElement('span');
        name.className = 'dialog-item-name';
        name.textContent = item.name || 'Item misterioso';
        info.appendChild(name);

        if(item.description || item.price){
          const metaLine = document.createElement('span');
          metaLine.className = 'dialog-item-meta';
          metaLine.textContent = item.description
            ? (item.price ? `${item.description} • ${item.price}` : item.description)
            : item.price;
          info.appendChild(metaLine);
        }

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'dialog-item-btn';
        actionBtn.textContent = item.actionLabel || 'Selecionar';
        actionBtn.addEventListener('click', ()=>{
          if(typeof item.onSelect === 'function'){
            try { item.onSelect({ item }); } catch (err) { console.error(err); }
          }else if(window.showToast){
            window.showToast('Item selecionado!', 1000);
          }
        });

        row.appendChild(info);
        row.appendChild(actionBtn);
        listEl.appendChild(row);
      });

      const focusTarget = setFooterButtons([
        { label: 'Fechar', variant: 'secondary', onClick: ()=> closeDialog('shop-close') }
      ]);
      (listEl.querySelector('button') || focusTarget)?.focus();
      if(activeSession){
        activeSession.nav = {
          back: ()=> closeDialog('shop-close'),
          forward: null
        };
      }
    },

    craft(dialog){
      textEl.textContent = dialog.intro || 'Selecione um projeto disponível.';
      listEl.hidden = false;
      listEl.innerHTML = '';

      const recipes = dialog.recipes || [];
      if(!recipes.length){
        const empty = document.createElement('div');
        empty.className = 'dialog-item-meta';
        empty.textContent = 'Nenhum projeto cadastrado nesta bancada ainda.';
        listEl.appendChild(empty);
      }

      recipes.forEach(recipe => {
        const row = document.createElement('div');
        row.className = 'dialog-item';

        const info = document.createElement('div');
        info.className = 'dialog-item-info';

        const name = document.createElement('span');
        name.className = 'dialog-item-name';
        name.textContent = recipe.name || recipe.id || 'Projeto';
        info.appendChild(name);

        if(recipe.description){
          const desc = document.createElement('span');
          desc.className = 'dialog-item-meta';
          desc.textContent = recipe.description;
          info.appendChild(desc);
        }

        const reqLine = document.createElement('span');
        reqLine.className = 'dialog-item-req';
        if(window.Crafting && typeof window.Crafting.describeRequirements === 'function'){
          reqLine.textContent = window.Crafting.describeRequirements(recipe) || 'Sem requisitos.';
        }else{
          const fallbackReq = (recipe.requirements || []).map(req => `${req.qty || 1}x ${req.name || req.id}`).join(', ');
          reqLine.textContent = fallbackReq || 'Sem requisitos.';
        }
        info.appendChild(reqLine);

        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'dialog-item-btn';
        actionBtn.textContent = recipe.actionLabel || 'Criar';

        const canCraft = window.Crafting && typeof window.Crafting.canCraft === 'function'
          ? window.Crafting.canCraft(recipe)
          : true;

        if(!canCraft){
          row.classList.add('requirement-missing');
          actionBtn.disabled = true;
        }

        actionBtn.addEventListener('click', ()=>{
          if(window.Crafting && typeof window.Crafting.craftRecipe === 'function'){
            const success = window.Crafting.craftRecipe(recipe);
            if(success && window.Dialogs && typeof window.Dialogs.rerender === 'function'){
              window.Dialogs.rerender();
            }
          }
        });

        row.appendChild(info);
        row.appendChild(actionBtn);
        listEl.appendChild(row);
      });

      const focusTarget = setFooterButtons([
        { label: 'Fechar', variant: 'secondary', onClick: ()=> closeDialog('craft-close') }
      ]);
      (listEl.querySelector('button:not(:disabled)') || focusTarget)?.focus();
      if(activeSession){
        activeSession.nav = {
          back: ()=> closeDialog('craft-close'),
          forward: null
        };
      }
    }
  };

  function openDialog(dialogSpec, meta={}){
    const dialog = resolveDialog(dialogSpec);
    if(!dialog) return;

    if(window.Inventory && typeof window.Inventory.close === 'function'){
      window.Inventory.close();
    }

    ensureUI();
    resetSections();

    const combinedMeta = { ...(dialog.meta || {}), ...meta };
    setHeader(combinedMeta);

    activeSession = { dialog, meta: combinedMeta };
    activeSession.nav = { back: null, forward: null };

    const renderer = renderers[dialog.type] || renderers.sequence;
    renderer(dialog, { meta: combinedMeta, spot: combinedMeta.spot || null });

    showOverlay();
    focusFirstInteractive();
    window.Dialogs.isOpen = true;

    if(sfxNpc){
      try { sfxNpc.currentTime = 0; sfxNpc.play().catch(()=>{}); } catch (err) { /* ignore */ }
    }
  }

  function rerenderActive(){
    if(!activeSession) return;
    ensureUI();
    resetSections();
    setHeader(activeSession.meta);
    const renderer = renderers[activeSession.dialog.type] || renderers.sequence;
    renderer(activeSession.dialog, { meta: activeSession.meta, spot: activeSession.meta.spot || null });
    focusFirstInteractive();
  }

  function getActiveType(){
    return activeSession && activeSession.dialog ? activeSession.dialog.type : null;
  }

  function openDialogForSpot(spot){
    if(!spot) return;
    const baseDialog = spot.dialog ? resolveDialog(spot.dialog) : null;
    const presetDialog = !baseDialog && spot.preset ? getPreset(spot.preset) : null;
    const fallbackDialog = !baseDialog && !presetDialog
      ? createSequenceDialog([spot.text || 'Olá!'])
      : null;

    const dialog = baseDialog || presetDialog || fallbackDialog;
    const meta = {
      title: spot.title || spot.name || 'Diálogo',
      speaker: spot.npcName || spot.subtitle || null,
      subtitle: spot.subtitle || null,
      portrait: spot.portrait || null,
      spot
    };

    openDialog(dialog, meta);
  }

  (function(){
    const missaoPai = createSequenceDialog([
      'Filho, lembra de vender os discos que encontrei no porão.',
      'Se precisar de ajuda, fale com os lojistas da praça.'
    ], { speaker: 'Pai' });

    missaoPai.onClose = ()=>{
      const wallet = window.PlayerState;
      if(!wallet) return;
      wallet.flags = wallet.flags || {};
      if(wallet.flags.paiInitialGift) return;
      wallet.flags.paiInitialGift = true;
      if(typeof window.NPC_addFitoedas === 'function'){
        window.NPC_addFitoedas(3, { message: 'Pai lhe deu 3 fitoedas para começar.' });
      }
    };

    registerPreset('missaoPai', missaoPai);
  })();

  const fallbackShopItems = {
    disco_vinil: { name: 'Disco de Vinil', cost: 3, description: 'Som encorpado e colecionável.' },
    fita_cassete: { name: 'Fita Cassete', cost: 2, description: 'Faixas lado A e lado B.' },
    microcassete: { name: 'Microcassete', cost: 1, description: 'Compacta e prática.' }
  };

  function buildLojaDiscosPreset(data){
    const intro = 'Bem-vindo à nossa loja de mídias clássicas! Veja o que separei para você.';
    const selection = ['disco_vinil', 'fita_cassete', 'microcassete'].map(id => {
      const fallback = fallbackShopItems[id] || { name: id, cost: 1, description: '' };
      const info = data && typeof data.getItem === 'function' ? data.getItem(id) : null;
      const cost = typeof info?.price === 'number' ? info.price : fallback.cost;
      const priceLabel = cost
        ? (data && typeof data.formatPrice === 'function' ? data.formatPrice(cost) : `${cost} fitoeda${cost>1?'s':''}`)
        : 'Sem custo';
      const description = info?.description || info?.desc || fallback.description;
      const name = info?.name || fallback.name;

      return {
        id,
        name,
        price: priceLabel,
        cost,
        description,
        actionLabel: 'Comprar',
        onSelect({ item }){
          const finalCost = item?.cost ?? cost ?? 0;
          const spend = typeof window.NPC_spendFitoedas === 'function' ? window.NPC_spendFitoedas(finalCost) : true;
          if(spend){
            if(window.Inventory && typeof window.Inventory.addItem === 'function'){
              window.Inventory.addItem(id, 1, { name, description, type: info?.type || 'midia' });
            }
            if(window.showToast){ window.showToast(`Você comprou ${name}!`, 1400); }
            if(window.Dialogs && typeof window.Dialogs.rerender === 'function'){ window.Dialogs.rerender(); }
          }else if(window.showToast){
            window.showToast(`Faltam fitoedas para comprar ${name}.`, 1600);
          }
        }
      };
    });

    registerPreset('lojaDiscos', createShopDialog(intro, selection, { title: 'Loja de Discos', subtitle: 'Mídias clássicas' }));
  }

  buildLojaDiscosPreset(window.GameData && window.GameData.ready ? window.GameData : null);
  window.addEventListener('gamedata:ready', event => buildLojaDiscosPreset(event.detail));

  window.Dialogs = {
    close: ()=> closeDialog('external'),
    createSequenceDialog,
    createChoiceDialog,
    createShopDialog,
    createCraftDialog,
    registerPreset,
    openDialog,
    openDialogForSpot,
    rerender: rerenderActive,
    getActiveType,
    presets: presetLibrary,
    isOpen: false
  };

  const handlerMap = {};
  const NPC = window.NPC = window.NPC || {};

  NPC.register = function register(type, handler){
    if(!type || typeof handler !== 'function') return;
    handlerMap[type] = handler;
  };

  NPC.useDefault = function useDefault(handler){
    if(typeof handler === 'function'){
      NPC.default = handler;
    }
  };

  NPC.get = function get(type){
    return handlerMap[type] || null;
  };

  NPC.default = function defaultHandler(spot){
    if(spot?.text && typeof window.showToast === 'function'){
      window.showToast(spot.text);
    }
  };

  NPC.register('dialog', openDialogForSpot);
  NPC.register('shop', spot => {
    if(!spot) return;
    const dialog = spot.dialog ? resolveDialog(spot.dialog) : (spot.preset ? getPreset(spot.preset) : null);
    const meta = {
      title: spot.title || 'Loja',
      subtitle: spot.subtitle || spot.npcName || null,
      spot
    };
    if(dialog){
      openDialog(dialog, meta);
      return;
    }
    const items = Array.isArray(spot.items) ? spot.items.map(item => ({ ...item })) : [];
    openDialog(createShopDialog(spot.text || 'Veja os itens disponíveis.', items, meta), meta);
  });

  NPC.register('gate', spot => {
    if(!spot) return;
    const go = ()=>{
      try { sfxGate?.play?.(); } catch (err) { /* ignore */ }
      if(spot.to && window.Topdown){
        window.Topdown.loadMap(spot.to);
      }
      if(window.Dialogs){ window.Dialogs.close(); }
    };
    if(spot.confirm){
      const question = spot.text || 'Entrar?';
      const dialog = createChoiceDialog(question, [
        { label: 'Sim', onSelect: go },
        { label: 'Não', onSelect: ()=> window.Dialogs?.close?.() }
      ], { title: spot.title || 'Portal' });
      openDialog(dialog, { title: spot.title || 'Portal', spot });
    }else{
      go();
    }
  });

  NPC.register('npc_point', spot => {
    if(!spot) return;
    if(spot._awarded){
      window.showToast?.('Nada novo aqui.', 1200);
      return;
    }
    spot._awarded = true;
    window.showToast?.(spot.text || '+1 ponto', 1200);
    window.UI?.updateProgress?.();
  });

  NPC.register('craftBench', spot => {
    if(!spot) return;
    window.GameData?.load?.();
    const benchId = spot.benchId || spot.bench || null;
    const openBench = data => {
      const benchInfo = benchId ? data.getBench(benchId) : null;
      const recipes = benchId ? data.getRecipesForBench(benchId) : [];
      if(!recipes.length){
        window.showToast?.('Ainda não há projetos cadastrados para esta bancada.', 1500);
        return;
      }
      const decorated = recipes.map(recipe => {
        const itemInfo = data.getItem(recipe.id) || {};
        return {
          id: recipe.id,
          name: itemInfo.name || recipe.name || recipe.id,
          description: recipe.description || itemInfo.description || itemInfo.desc || '',
          requirements: (recipe.requirements || []).map(req => {
            const resInfo = data.getItem(req.id) || {};
            return {
              id: req.id,
              qty: req.qty || 1,
              name: resInfo.name || req.id,
              description: resInfo.description || resInfo.desc || ''
            };
          }),
          outputQty: recipe.outputQty || 1,
          type: itemInfo.type || recipe.type || 'item'
        };
      });

      const intro = benchInfo?.nome
        ? `Selecione um projeto para montar na ${benchInfo.nome}.`
        : 'Escolha um projeto para fabricar.';

      const dialog = createCraftDialog(intro, decorated, { benchId, spot });
      const header = {
        title: benchInfo?.nome || spot.title || 'Bancada',
        subtitle: benchInfo?.desc || benchInfo?.descricao || spot.subtitle || null,
        benchId,
        spot
      };
      openDialog(dialog, header);
    };

    if(window.GameData?.ready){
      openBench(window.GameData);
    }else{
      window.GameData?.whenReady?.(openBench);
    }
  });

  NPC.register('dialogTalk', openDialogForSpot);
  NPC.register('dialogPreset', spot => {
    if(!spot?.preset){
      openDialogForSpot(spot);
      return;
    }
    const preset = getPreset(spot.preset);
    if(!preset){
      openDialogForSpot(spot);
      return;
    }
    openDialog(preset, { spot, title: spot.title || 'Diálogo', subtitle: spot.subtitle || null });
  });

})(window);
