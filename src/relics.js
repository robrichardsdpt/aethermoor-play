/* Relics: things the Architects dropped on the way down. Each one is a
   passive that bends a rule of the game. Found in caches, salvaged from
   fallen stars, torn from elite Unlit. */
'use strict';

const RELICS = {
  'wind-band': {
    name: 'Band of the Restless Wind', color: '#cfe08a',
    desc: 'Worn at the ankle. You walk 12% faster, always. The wind is going your way now.',
  },
  'ember-core': {
    name: 'Emberheart Coal', color: '#ff8a5c',
    desc: 'Still warm after an age. Stamina returns 35% faster.',
  },
  'gold-sliver': {
    name: 'Sliver of the First Light', color: '#ffd27a',
    desc: 'Too small to be a shard, too stubborn to be nothing. All light earned +15%.',
  },
  'keen-eye': {
    name: 'Navigator’s Lens', color: '#9fd0e8',
    desc: 'Ground for eyes that watched lightyears. The critical timing ring is far more forgiving.',
  },
  'still-hand': {
    name: 'Gauntlet of the Steady Hand', color: '#cdab6e',
    desc: 'Sized for fingers like yours, almost. The parry timing ring is far more forgiving.',
  },
  'war-core': {
    name: 'Voidglass Edge', color: '#d66b8e',
    desc: 'A blade-shard of the Vessel’s hull. Might +10%, immediately and forever.',
  },
  'heart-stone': {
    name: 'Architect’s Marrow', color: '#8fd47a',
    desc: 'Mountain-bone. Greatest vitality +15%, immediately and forever.',
  },
  'dark-charm': {
    name: 'Hushed Bell', color: '#8a7fd4',
    desc: 'It rings silence. The Unlit notice you from only half as far.',
  },
  'lantern-heart': {
    name: 'Lantern Heart', color: '#fff6da',
    desc: 'A firefly the size of a fist, asleep. Your light reaches 60% farther into the night.',
  },
  'combo-knot': {
    name: 'Knot of Continuance', color: '#e8c66a',
    desc: 'Tied by patient hands. Once per battle, your combo survives an unparried blow.',
  },
  'rift-eye': {
    name: 'Eye of the Folded Dark', color: '#c46bd6',
    desc: 'It blinks at secrets. Unopened caches reveal themselves on your minimap.',
  },
  'wisp-call': {
    name: 'Wispcaller’s Whistle', color: '#bfeaff',
    desc: 'Soundless to you. Light wisps come to you instead of fleeing.',
  },
};

function hasRelic(key) {
  return typeof game !== 'undefined' && game.hero && game.hero.relics &&
    game.hero.relics.has(key);
}

function unownedRelics() {
  return Object.keys(RELICS).filter((k) => !game.hero.relics.has(k));
}

/** Award a relic: apply any instant effects and announce it. */
function grantRelic(key) {
  const h = game.hero;
  if (h.relics.has(key)) return;
  h.relics.add(key);
  if (key === 'war-core') h.atk = Math.round(h.atk * 1.10 * 10) / 10;
  if (key === 'heart-stone') { h.maxHp = Math.round(h.maxHp * 1.15); h.hp = h.maxHp; }
  const r = RELICS[key];
  UI.banner('✶ RELIC — ' + r.name.toUpperCase(), r.desc, 6200);
  game.audio.fanfare();
  saveGame();
}
