(function(window){
  'use strict';

  const Quests = window.Quests = window.Quests || {
    list: [],
    register(quest){ if(quest) Quests.list.push(quest); },
    clear(){ Quests.list.length = 0; }
  };

})(window);
