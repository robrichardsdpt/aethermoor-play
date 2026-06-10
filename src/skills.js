/* The Arts: combat skills won from the dark, one victory at a time.
   And the four forms of the Wayfarer's evolution. */
'use strict';

const SKILLS = {
  strike: {
    name: 'Strike', color: '#d8cdb2', cd: 0, base: true,
    desc: (lv) => 'A wayfarer’s blade. ' + (100 + (lv - 1) * 15) + '% might.',
  },
  ember: {
    name: 'Emberlash', color: '#ff8a5c', cd: 2,
    desc: (lv) => 'A whip of living fire. ' + (150 + (lv - 1) * 25) + '% might, and the foe burns for 2 turns.',
  },
  tide: {
    name: 'Tidebind', color: '#6ad4ff', cd: 3,
    desc: (lv) => 'The sea remembers you. Restore ' + (30 + (lv - 1) * 8) + '% of your vitality.',
  },
  stone: {
    name: 'Stoneward', color: '#cdab6e', cd: 3,
    desc: (lv) => 'Shoulders of the Architects. A shield absorbs ' + (40 + (lv - 1) * 15) + '% of your vitality in harm.',
  },
  storm: {
    name: 'Stormcall', color: '#a98fff', cd: 2,
    desc: (lv) => 'An old god clears its throat. ' + (2 + Math.min(3, lv)) + ' bolts of ' + (50 + (lv - 1) * 8) + '% might.',
  },
  frost: {
    name: 'Frostbite', color: '#bfeaff', cd: 2,
    desc: (lv) => 'The cruel cold, borrowed. ' + (90 + (lv - 1) * 15) + '% might, and the foe’s might wanes ' + (25 + (lv - 1) * 5) + '% for 2 turns.',
  },
  dusk: {
    name: 'Duskveil', color: '#c46bd6', cd: 3,
    desc: (lv) => 'Wear the dark as a cloak. Evade the next blow and answer with ' + (120 + (lv - 1) * 25) + '% might.',
  },
  dawn: {
    name: 'Dawnstrike', color: '#ffd27a', cd: 4,
    desc: (lv) => 'An honest sunrise, delivered by hand. ' + (240 + (lv - 1) * 40) + '% might.',
  },
  orun: {
    name: 'Architect’s Hand', color: '#fff6da', cd: 98, secret: true,
    desc: () => 'Once each battle: the steady hands. Mend in full, then strike for 300% might that nothing can guard against.',
  },
};

const STAT_CARDS = {
  vit: { name: 'Vitality', color: '#8fd47a', desc: () => 'The road hardens you. Greatest vitality +12% and mend in full.' },
  might: { name: 'Might', color: '#e87a6a', desc: () => 'The dark taught you where it hurts. Might +12%.' },
};

const MAX_SKILL_LV = 5;

/* ---------------- shard boons ----------------
   Every claimed shard reshapes how the Wayfarer moves through the world. */

const BOONS = {
  dawn:  { name: 'Dawnlight',  desc: 'Your lantern burns wider. The night keeps a respectful distance.' },
  tide:  { name: 'Tidewalker', desc: 'The Deep carries you: swim swiftly, without weariness.' },
  stone: { name: 'Stonestride', desc: 'The Worldspine remembers you. The impassable peaks open their passes.' },
  storm: { name: 'Stormstep',  desc: 'Your sprint becomes a crackling rush of wind and light.' },
  ember: { name: 'Emberheart', desc: 'Warmth without end — your strength returns twice as fast.' },
  frost: { name: 'Frostpath',  desc: 'Water freezes beneath your steps and bears your weight.' },
  dusk:  { name: 'Duskcloak',  desc: 'The Unlit no longer see you — unless you walk into their teeth.' },
};

function hasBoon(key) {
  return typeof game !== 'undefined' && game.state && game.state.shards.has(key);
}

/* ---------------- evolution ---------------- */

const TIERS = [
  { name: 'Wayfarer', minLevel: 1, color: '#9b8ec4',
    line: 'One lantern against all that dark.' },
  { name: 'Lightbearer', minLevel: 4, color: '#e8c66a',
    line: 'The shards begin to answer when you speak.' },
  { name: 'Shardborn', minLevel: 8, color: '#7fd4ff',
    line: 'Light moves under your skin like a second pulse.' },
  { name: 'Luminarch', minLevel: 12, color: '#fff6da',
    line: 'The Architects diminished into the world. You are what grew back.' },
];

function tierOf(level) {
  let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (level >= TIERS[i].minLevel) t = i;
  return t;
}

function xpNeed(level) {
  return Math.round(35 * Math.pow(1.38, level - 1));
}

/* Names for the things that hunt you, scaled by menace. */
const FOE_RANKS = [
  { min: 1, names: ['Umbral Shade', 'Hollow Wisp', 'Grief of the Grey Years'] },
  { min: 4, names: ['Unlit Sentinel', 'Barrow Stalker', 'Echo of the Sundering'] },
  { min: 8, names: ['Devourer of Hearths', 'The Center’s Absence', 'Nightmaw'] },
  { min: 13, names: ['Herald of the Unlit Sea', 'What the Spire Became', 'The Long Dark'] },
];

function foeName(level, rand) {
  let pool = FOE_RANKS[0].names;
  for (const r of FOE_RANKS) if (level >= r.min) pool = r.names;
  return pool[(rand() * pool.length) | 0];
}
