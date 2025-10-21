(function(window){
  'use strict';

  const Color = {
    vinho: "#7b1e2b",
    rosa: "#ff5fa2",
    roxo: "#7e57c2",
    gate: "#00d0ff",
    azul: "#2f6fff",
    laranja: "#ff8a00",
    cinza: "#333"
  };

  const SPRITE = {
    talk:   "sprites/npc_talk.png",
    point:  "sprites/npc_point.png",
    item:   "sprites/npc_item.png",
    coin:   "sprites/pickup_coin.png",
    portal: "sprites/gate_portal.png"
  };

  function pickFitoeda(id,x,y,w,h,color=Color.vinho,text="+1 fitoeda!"){
    return { id, type:"pickFitoeda", x,y,w,h, value:1, text, color, once:true, sprite: SPRITE.coin };
  }

  function pickPeca(id,x,y,w,h,color=Color.vinho,text="+1 peça eletrônica!"){
    return { id, type:"pickPeca", x,y,w,h, value:1, text, color, once:true, sprite: SPRITE.coin };
  }

  function npcPoint(id,x,y,w,h,color=Color.rosa,text="+1 ponto"){
    return { id, type:"npc_point", x,y,w,h, value:1, text, color, sprite: SPRITE.point };
  }

  function resourcePickup(id,x,y,w,h,resourceId,quantity=1,options={}){
    return {
      id,
      type: 'resourcePickup',
      x,y,w,h,
      resourceId,
      quantity: quantity || 1,
      text: options.text || null,
      resourceName: options.resourceName || null,
      resourceDescription: options.resourceDescription || null,
      color: options.color || Color.azul,
      once: true,
      sprite: options.sprite || SPRITE.item
    };
  }

  function craftBench(id,x,y,w,h,benchId,sprite=SPRITE.item,meta={}){
    const benchName = meta.npcName || meta.title || 'Bancada';
    return {
      id,
      type: 'craftBench',
      x,y,w,h,
      benchId,
      sprite,
      npcName: benchName,
      title: meta.title || benchName,
      subtitle: meta.subtitle || null,
      interactLabel: meta.interactLabel || 'Criar'
    };
  }

  function dialogTalk(id,x,y,w,h,dialogues=[],sprite=SPRITE.talk, meta={}){
    const lines = Array.isArray(dialogues) && dialogues.length ? [...dialogues] : ['Olá!'];
    const npcName = meta.npcName || meta.speaker || meta.title || null;
    return {
      id,
      type:'dialog',
      x,y,w,h,
      sprite,
      dialog: { type:'sequence', lines, meta: { ...meta } },
      npcName: npcName || null,
      title: meta.title || npcName || null,
      subtitle: meta.subtitle || null,
      interactLabel: meta.interactLabel || 'Conversar'
    };
  }

  function dialogPreset(id,x,y,w,h,preset,sprite=SPRITE.talk, meta={}){
    const npcName = meta.npcName || meta.speaker || meta.title || null;
    return {
      id,
      type:'dialog',
      x,y,w,h,
      sprite,
      preset,
      npcName: npcName || null,
      title: meta.title || npcName || null,
      subtitle: meta.subtitle || null,
      interactLabel: meta.interactLabel || 'Conversar'
    };
  }

  function gate(id,x,y,w,h,to,text="Entrar?",confirm=true){
    return { id, type:"gate", x,y,w,h, to, text, color:Color.gate, confirm, sprite: SPRITE.portal };
  }

  const maps = {
    mapa1: {
      name: "Mapa 1",
      bgColor: Color.cinza,
      url: null,
      width: 1200,
      height: 1000,
      playerStart: { x: 120, y: 820 },
      music: "audio_pack/bgm_city.wav",
      step:  "audio_pack/step_stone.wav",
      colliders: [
        { x:0, y:0, w:1200, h:30 },
        { x:0, y:0, w:30, h:1000 },
        { x:0, y:970, w:1200, h:30 },
        { x:1170, y:0, w:30, h:1000 }
      ],
      spots: [
        pickFitoeda("m1_p1", 300, 800, 40, 40),
        pickFitoeda("m1_p2", 300, 500, 40, 40),
        pickFitoeda("m1_p3", 300, 600, 40, 40),
        pickFitoeda("m1_p4", 300, 700, 40, 40),
        pickPeca("p1_p1", 520, 760, 40, 40),
        resourcePickup("m1_res_plastico", 420, 720, 42, 42, "plastico", 2, {
          text: "Você coletou peças plásticas reutilizáveis.",
          resourceName: "Plástico recuperado",
          resourceDescription: "Carcaças, painéis e engrenagens leves."
        }),
        resourcePickup("m1_res_vinil", 260, 640, 42, 42, "vinil_pvc", 2, {
          text: "Fragmentos de vinil prontos para moldagem.",
          resourceName: "Vinil bruto",
          resourceDescription: "Matéria-prima para prensar LPs e singles."
        }),
        resourcePickup("m1_res_silicio", 360, 540, 42, 42, "silicio_pcb", 1, {
          text: "Componentes eletrônicos reaproveitados!",
          resourceName: "Placas de silício",
          resourceDescription: "Circuitos e placas prontas para novos projetos."
        }),
        npcPoint("m1_np1", 780, 780, 60, 70, Color.rosa, "+1 ponto"),
        npcPoint("m1_np2", 960, 820, 60, 70, Color.rosa, "+1 ponto"),
        dialogTalk("m1_nt1", 1120, 820, 60, 70, [
          "Oi, viajante!",
          "Sorte na jornada!"
        ], SPRITE.talk, { npcName: "Moradora" }),
        dialogPreset("m1_pai", 180, 820, 60, 70, "missaoPai", SPRITE.talk, { npcName: "Pai", title: "Pai", interactLabel: "Conversar" }),
        dialogPreset("m1_loja", 100, 500, 60, 70, "lojaDiscos", SPRITE.item, { npcName: "Atendente", title: "Loja de Discos", interactLabel: "Comprar" }),
        craftBench("m1_bancada_audio", 520, 860, 70, 70, "bancada_audio", SPRITE.item, {
          npcName: "Bancada de Áudio",
          title: "Bancada de Áudio/Vitrola",
          interactLabel: "Criar"
        }),
        craftBench("m1_bancada_fitas", 640, 860, 70, 70, "bancada_fitas", SPRITE.item, {
          npcName: "Bancada de Fitas",
          title: "Bancada de Fitas",
          interactLabel: "Criar"
        }),
        craftBench("m1_bancada_eletronicos", 760, 860, 70, 70, "bancada_eletronicos", SPRITE.item, {
          npcName: "Bancada de Eletrônicos",
          title: "Bancada de Eletrônicos",
          interactLabel: "Criar"
        }),
        gate("m1_g1", 1145, 450, 40, 140, "mapa2", "Ir para o Mapa 2?", true)
      ]
    },

    mapa2: {
      name: "Mapa 2 (Azul)",
      bgColor: Color.azul,
      url: "maps/map3.png",
      width: 1000, height: 1000,
      playerStart: { x: 80, y: 690 },
      music: "audio_pack/bgm_beach.wav",
      step:  "audio_pack/step_sand.wav",
      colliders: [
        { x:0, y:0, w:1000, h:30 },
        { x:0, y:0, w:30, h:1000 },
        { x:0, y:970, w:1000, h:30 },
        { x:970, y:0, w:30, h:1000 },
        { x:70, y:185, w:370, h:435 },
        { x:140, y:0, w:370, h:135 },
        { x:192, y:790, w:170, h:180 }
      ],
      spots: [
        pickFitoeda("m2_p1", 90, 720, 38, 38),
        pickFitoeda("m2_p2", 420, 560, 38, 38),
        pickFitoeda("m2_p3", 580, 600, 38, 38),
        npcPoint("m2_np1", 720, 520, 60, 70, Color.rosa, "+1 ponto"),
        npcPoint("m2_np2", 900, 560, 60, 70, Color.rosa, "+1 ponto"),
        npcPoint("m2_np3", 670, 100, 60, 70, Color.rosa, "+1 ponto"),
        dialogTalk("m2_nt1", 800, 200, 60, 70, ["Bons ventos por aqui!"], SPRITE.talk, { npcName: "Pescador" }),
        gate("m2_g_back", 10, 580, 40, 140, "mapa1", "Voltar ao Mapa 1?", true),
        gate("m2_g_up",   580, 840,  140, 40, "mapa3", "Subir ao Mapa 3?", true)
      ]
    },

    mapa3: {
      name: "Mapa 3 (Laranja)",
      bgColor: Color.laranja,
      url: null,
      width: 1600,
      height: 1000,
      playerStart: { x: 200, y: 600 },
      music: "audio_pack/bgm_orange.wav",
      step:  "audio_pack/step_stone.wav",
      colliders: [
        { x:0, y:0, w:1600, h:30 },
        { x:0, y:0, w:30, h:1000 },
        { x:0, y:970, w:1600, h:30 },
        { x:1570, y:0, w:30, h:1000 }
      ],
      spots: [
        pickFitoeda("m3_p1", 320, 640, 40, 40),
        pickFitoeda("m3_p2", 520, 680, 40, 40),
        npcPoint("m3_np1", 760, 640, 60, 70),
        npcPoint("m3_np2", 920, 680, 60, 70),
        npcPoint("m3_np3", 1080, 720, 60, 70),
        npcPoint("m3_np4", 1240, 760, 60, 70),
        dialogTalk("m3_nt1", 1380, 780, 60, 70, ["Hey!"], SPRITE.talk, { npcName: "Artista" }),
        dialogTalk("m3_nt2", 1440, 820, 60, 70, ["Olha o sol!"], SPRITE.talk, { npcName: "Turista" }),
        gate("m3_g_down", 780, 930, 140, 40, "mapa2", "Descer ao Mapa 2?", true)
      ]
    }
  };

  window.GAME_MAPS = maps;
  window.GAME_START_MAP = window.GAME_START_MAP || 'mapa1';
  window.MapColor = window.MapColor || Color;
  window.MapSprites = window.MapSprites || SPRITE;

})(window);
