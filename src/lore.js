/* The lore of Aethermoor: the Architects who crossed the dark between
   stars, the First Light they carried, the Sundering that broke it,
   the things that followed them here — and the procedural names of
   every broken place the Wayfarer will find. */
'use strict';

const LORE = {};

/* ------------------------------------------------------------------ */
/* The seven Shards of the First Light                                 */
/* ------------------------------------------------------------------ */

LORE.SHARDS = [
  {
    key: 'dawn', name: 'Shard of Dawn', color: '#ffd27a',
    epitaph: 'Warmth floods your hands. Somewhere, for the first time in an age, a morning truly begins.'
  },
  {
    key: 'tide', name: 'Shard of the Tide', color: '#6ad4ff',
    epitaph: 'You taste salt and rain. The seas remember the patient music the Architects taught them, and resume it.'
  },
  {
    key: 'stone', name: 'Shard of Stone', color: '#cdab6e',
    epitaph: 'The ground steadies beneath you, as if the world has stopped holding its breath.'
  },
  {
    key: 'storm', name: 'Shard of Storms', color: '#a98fff',
    epitaph: 'Thunder rolls across a clear sky — not a threat, but an old engine clearing its throat.'
  },
  {
    key: 'ember', name: 'Shard of Embers', color: '#ff8a5c',
    epitaph: 'Every cold hearth in every ruined hall sighs, and somewhere ash dreams of being flame.'
  },
  {
    key: 'frost', name: 'Shard of Frost', color: '#bfeaff',
    epitaph: 'The cold does not leave the world. It simply stops being cruel.'
  },
  {
    key: 'dusk', name: 'Shard of Dusk', color: '#c46bd6',
    epitaph: 'The dark gathers itself around the light like a cloak — keeper now, not conqueror.'
  },
];

/* ------------------------------------------------------------------ */
/* Lore fragments, found on the monoliths of the Architects            */
/* ------------------------------------------------------------------ */

LORE.FRAGMENTS = [
  { title: 'The Crossing', text: 'Before this world there was the crossing. The Architects came from another star — vast, patient beings swimming through the dark between suns the way thoughts swim through a sleeping mind. The crossing took longer than species usually last. They were not gods. They insisted on this, later, to everyone they made.' },
  { title: 'The Vessel', text: 'They did not land so much as arrive, the way winter arrives. Their Vessel folded itself down out of the sky over the course of a hundred years, and when it finished, it had become the Lumen Spire. Ask where the ship went and the old carvings answer: YOU ARE STANDING IN IT. THE WORLD IS THE CARGO.' },
  { title: 'The First Light', text: 'Their home star died. This is the only grief the monoliths admit to. Before it went, the Architects reached into it and drew out its seed-heart, and carried it across the void in cupped fields the way you would carry an ember through rain. They set it at the crown of the Spire. Day was when the Light looked at you. Night was when it closed its eye to rest.' },
  { title: 'The Shaping', text: 'By the Light the Architects shaped Aethermoor: they combed the seas flat, folded the mountains like cloth, and planted the Eldwood seed by seed, gene by patient gene. It took an age. They said it was worth it. They said that often, toward the end.' },
  { title: 'The First Peoples', text: 'We were made last and smallest, grown from the world they had grown, and we asked why. The Architects answered: THE LARGE THINGS HOLD THE WORLD UP. THE SMALL THINGS MAKE IT WORTH HOLDING. We carved this on every doorpost. Some doorposts survive.' },
  { title: 'The Waystones', text: 'The Waystones were the Architects’ gift to travelers: relay-stones that remember the pattern of every soul who touches them. Attune yourself to one and the whole web of them will know your shape, and carry you between themselves the way the Architects once carried the Light — carefully, and all at once.' },
  { title: 'The Long Peace', text: 'For nine hundred generations nothing happened. This is the proudest sentence in all the old histories. Nothing happened. Nothing happened. Children grew old teaching children. The Light rose and rested. Nothing happened.' },
  { title: 'The Counting', text: 'An Architect called Vael-Who-Measures began to count the days remaining in the First Light. The number was vast. It was, however, a number. The histories say Vael never spoke again after finishing the count — except once, to ask whether anything had appeared at the edge of the sky.' },
  { title: 'The Quiet', text: 'Some Architects argued the Light should burn freely until it died, and the world be allowed its natural dark. Others swore to ration it across eternity. The histories call this disagreement THE QUIET, because for a century it was. It was not, in the end, the Light’s lifespan that mattered. It was its brightness, and what its brightness could be seen by.' },
  { title: 'What Followed', text: 'The dark between stars is not empty. The Architects knew this better than anyone — they had swum it. Something swam after them. The monoliths never name it. They only say: WE CROSSED IN SILENCE AND ARRIVED IN SILENCE, AND STILL IT HEARD THE LIGHT. They built the Light brighter anyway. Perhaps that was love. Perhaps it was a porch lamp left on out of habit.' },
  { title: 'The Sundering — I', text: 'It was not war. Every monolith is emphatic on this, as if answering an accusation. It was not war — war is between equals. An Architect named Orun-of-the-Steady-Hands climbed the Spire alone, to move the Light to safety. The histories do not say from what. By then, everyone knew.' },
  { title: 'The Sundering — II', text: 'The Light would not be held. That is all Orun said, after. THE LIGHT WOULD NOT BE HELD. It came apart in those steady hands into seven shards, and the Spire came apart around it, and the center of the world came apart around the Spire.' },
  { title: 'The Sundering — III', text: 'The lands tore loose and drifted, and where the center had been, distance itself grew strange — folded, the way the Architects used to fold the void to cross it. Walk far enough in Aethermoor and you will never reach an edge. The world is not endless. It is broken in the same way the space between stars is broken, which from inside looks the same.' },
  { title: 'The Scattering', text: 'The seven shards fell across the drifting lands like sparks off a struck anvil. Each burned itself a sanctum where it landed and waits there still, patient as only starlight can be. Light has crossed darker distances than these.' },
  { title: 'The Architects’ End', text: 'They did not die. They diminished — pouring what remained of themselves into the lands to keep them from drifting apart entirely. The mountains are their shoulders. The rivers are their veins. This is not a metaphor. It is anatomy.' },
  { title: 'Orun’s Vigil', text: 'Orun-of-the-Steady-Hands refused diminishment. The histories say Orun walks Aethermoor still — the last of them, the navigator, visiting each sanctum in turn, never touching the shards, only looking. If you meet a tall stranger with too many shoulders who will not show you their hands — be kind.' },
  { title: 'The Grey Years', text: 'After the Sundering came years with no proper day — only a bruised twilight, and the cold working inward, and the first of the Unlit seeping up through the broken places. The First Peoples burned their histories to keep their children warm, and that is why you find fragments now, and not books.' },
  { title: 'The Last Hearth', text: 'Of all the villages, one endured: the Last Hearth, built where a sliver of the First Light fell too small to be called a shard. The sliver does not warm. It only refuses, absolutely, to go out. Its keepers raise wayfarers, and send them walking.' },
  { title: 'The Wayfarer Oath', text: 'I will walk out and not look back until I have a reason to return that fits in my two hands. — The whole of the oath. The keepers of the Last Hearth distrust long promises. Long promises are how the Spire fell.' },
  { title: 'The Unlit', text: 'The things that hunt the far lands are not the dark itself. They are what followed the Architects across it — travelers, like their makers’ makers, wearing shapes borrowed badly from this world. The keepers teach that they are not evil. They are hungry the way the void is hungry: without malice, without end, and without ever once having seen a light they were allowed to keep.' },
  { title: 'The Reunion', text: 'When the seven are carried together — the monoliths agree on this, every one of them, in the same words — when the seven are carried together, they will remember they were one star, and the dark will end the way a long winter ends: not defeated. Forgiven. Even, perhaps, the dark that followed them here.' },
];

/* ------------------------------------------------------------------ */
/* Flavor found in lesser ruins                                        */
/* ------------------------------------------------------------------ */

LORE.RUIN_LINES = [
  'Fallen pillars, soft with moss. Someone arranged stones into a small spiral here, long after the roof came down.',
  'A hearth, cold for centuries. The soot stain above it is shaped almost exactly like a bird.',
  'Steps descending into rubble. From below, very faintly, the sound of water that never finds the sea.',
  'A doorway standing alone, no walls to justify it. The air through it is one degree warmer, and smells faintly of another sky.',
  'Carvings worn to whispers. One word survives, repeated all the way around the lintel: STAY. STAY. STAY.',
  'A child’s toy of fired clay — a six-legged horse. The First Peoples never saw a horse. The Architects described one badly, from memory, from another world.',
  'Bones of a great hall. Scorch marks bloom across the floor in the shape of a perfect seven-pointed star.',
  'Someone sheltered here recently: a bed of bracken, a ring of stones. Whoever it was had very long strides, and too many shoulders.',
  'An old well, sealed with a millstone. Something below taps once, politely, and then respects your silence.',
  'A toppled statue of an Architect, face-down. The proportions are wrong in a way your eyes keep apologizing for. You cannot shift it.',
  'Shelves cut into stone, empty. On the lowest one, a sentence in charcoal: WE TOOK THE BOOKS. WE ARE SORRY. WE WERE COLD.',
  'The floor mosaic survives: a map of a world with a center, and above it, picked out in white tile, a second sun this world has never had.',
];

LORE.WAYSTONE_LINE = 'The Waystone wakes beneath your palm. Far away — in every direction at once — you feel the others notice your pattern.';
LORE.WAYSTONE_AGAIN = 'The stone hums, content. It remembers your shape.';

/* ------------------------------------------------------------------ */
/* The Vaults: chambers of the Vessel, still humming underground       */
/* ------------------------------------------------------------------ */

LORE.VAULT_ENTER = [
  'The door reads your shape and steps aside. Below, the Vessel is still humming — patiently, in the dark, to itself.',
  'Stairs the Architects never needed, cut afterward by smaller hands. The air below tastes of metal and very old purpose.',
  'The dark inside is not empty. It is furnished. Somewhere deep, something keeps the floors swept.',
  'A breath of warm air rises past you, regular as a pulse. The Vessel does not know it landed.',
];

LORE.VAULT_CORE =
  'The core comes free with a sound like a held breath ending. The lights bank low, ' +
  'the hum winds down a final octave, and the chamber — for the first time in an age — rests. ' +
  'Somewhere far above, the wind changes.';

LORE.VAULT_SLEEPS = 'The vault sleeps now. Its door remembers you fondly, and stays shut.';

const VAULT_EPITHET = ['Sunken', 'Sealed', 'Humming', 'Patient', 'Folded',
  'Sleeping', 'Listening', 'Anchored', 'Unlit', 'Waiting'];

function nameVault(rand) {
  return 'The ' + VAULT_EPITHET[(rand() * VAULT_EPITHET.length) | 0] + ' Vault';
}

/* ------------------------------------------------------------------ */
/* Orun-of-the-Steady-Hands, the last Architect                        */
/* ------------------------------------------------------------------ */

LORE.ORUN_LINES = [
  '“You walk well, small one.” The stranger does not turn around. The voice arrives a half-second before the air moves. When you blink, there is only flattened grass.',
  '“I do not touch them anymore. I only look.” The sleeves where hands should be do not move at all. There seem to be more shoulders than a cloak should need.',
  '“The Light would not be held. Nothing we carried across the dark ever consented to being carried. We knew that. We carried it anyway.”',
  '“Your sun is borrowed, Wayfarer. We meant to tell your people, when you were older. You are older now.”',
  '“I count your steps. I once counted lightyears. Steps are a kinder arithmetic — they end somewhere.”',
  '“Be kinder to the dark than it was to us. It followed our Light across the void because it had never been allowed to keep one. I have had an age to stop being angry about that. I am nearly done.”',
  '“Seven places instead of one. Perhaps the heretics carved truth: perhaps the Light knew what was coming, and refused to be a single target.” He sounds almost proud.',
  '“When you carry all seven, come to the Hearth. I will show you what I have been carrying since the crossing.”',
];

LORE.ORUN_FINAL =
  'At the Last Hearth, the tall stranger finally turns — a navigator’s silhouette, ' +
  'built for a heavier sky — and draws his hands from his sleeves. They are not burned. ' +
  'They are full: two fistfuls of light, cupped and carried since the crossing, ' +
  'the piece of the First Light that came apart in his grip and that he never once put down. ' +
  '“It was never seven shards,” says Orun-of-the-Steady-Hands, last of the Architects. ' +
  '“It was eight. I kept the smallest. I kept it the only way I knew — by never opening my hands again. ' +
  'Not on the climb down. Not in the Grey Years. Not once, in all the dark that followed us here.” ' +
  'He opens them now. The light does not spill. It steps from his palms into yours ' +
  'like something that has been waiting politely for a very long time. ' +
  '“There,” he says, and flexes his fingers, and laughs at the feel of it — a sound like a ship settling. ' +
  '“Steady hands. Take the Art that goes with them. I have somewhere to be — ' +
  'I have not touched anything since we crossed the dark, and there is a world of it.”';

LORE.WIN_TEXT =
  'You carry the seven together, and they remember they were one star. ' +
  'There is no thunderclap. There is a sunrise — an honest one, the first in an age — ' +
  'rolling across the broken lands and stitching them loosely back into a world. ' +
  'Far overhead, something that followed the Architects across the void feels the Light refuse it, ' +
  'gently, the way a door is closed on winter. ' +
  'On a far hill stands a tall figure built for a heavier sky, watching the light come back. ' +
  'Before you can call out, Orun bows to you, and is gone. ' +
  'The Last Hearth is warm now, not merely stubborn. But the lands are wide, ' +
  'and the oath says nothing about stopping.';

/* ------------------------------------------------------------------ */
/* Name generation                                                     */
/* ------------------------------------------------------------------ */

const NAME_PRE = ['Vael', 'Thar', 'Eld', 'Mor', 'Cael', 'Aer', 'Umber', 'Kael',
  'Nim', 'Sol', 'Ash', 'Bryn', 'Dur', 'Fen', 'Gal', 'Lor', 'Myr', 'Or',
  'Hal', 'Ser', 'Tor', 'Wyn', 'Ild', 'Rav'];
const RUIN_SUF = ['fall', 'spire', 'keep', 'gate', 'throne', 'watch', 'barrow',
  'reach', 'hold', 'haven', 'mere', 'crest'];
const STONE_EPITHET = ['Patient', 'Sleepless', 'Far-Calling', 'Half-Sunken',
  'Whispering', 'Unbowed', 'Moss-Crowned', 'Thrice-Struck', 'Quiet', 'Gray'];

function nameRuin(rand) {
  return NAME_PRE[(rand() * NAME_PRE.length) | 0] +
         RUIN_SUF[(rand() * RUIN_SUF.length) | 0];
}

function nameWaystone(rand) {
  return 'The ' + STONE_EPITHET[(rand() * STONE_EPITHET.length) | 0] + ' Waystone';
}

function romanNumeral(n) {
  const vals = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of vals) while (n >= v) { out += s; n -= v; }
  return out;
}
