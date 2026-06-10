/* The lore of Aethermoor: the Sundering, the seven Shards, and the
   procedural names of every broken place the Wayfarer will find. */
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
    epitaph: 'You taste salt and rain. The seas remember their old patient music, and resume it.'
  },
  {
    key: 'stone', name: 'Shard of Stone', color: '#cdab6e',
    epitaph: 'The ground steadies beneath you, as if the world has stopped holding its breath.'
  },
  {
    key: 'storm', name: 'Shard of Storms', color: '#a98fff',
    epitaph: 'Thunder rolls across a clear sky — not a threat, but an old god clearing its throat.'
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
  { title: 'The Unlit Sea', text: 'Before the first dawn there was no dawn at all, only the Unlit Sea, and the Architects swimming in it like thoughts in a sleeping mind. They were not gods. They insisted on this, later, to everyone they made.' },
  { title: 'The Kindling', text: 'No record agrees on how the First Light was kindled. The oldest carving says only: ONE OF US STAYED STILL LONG ENOUGH TO BURN. The Architects did not speak of it. Grief, perhaps. Or shame.' },
  { title: 'The Lumen Spire', text: 'They raised the Lumen Spire at the center of all places — for the world had a center then — and set the First Light at its crown. Day was when the Light looked at you. Night was when it closed its eye to rest.' },
  { title: 'The Shaping', text: 'By the Light the Architects shaped Aethermoor: they combed the seas flat, folded the mountains like cloth, and planted the Eldwood seed by seed. It took an age. They said it was worth it. They said that often, toward the end.' },
  { title: 'The First Peoples', text: 'We were made last and smallest, and asked why. The Architects answered: THE LARGE THINGS HOLD THE WORLD UP. THE SMALL THINGS MAKE IT WORTH HOLDING. We carved this on every doorpost. Some doorposts survive.' },
  { title: 'The Waystones', text: 'The Waystones were the Architects’ gift to travelers: stones that remember every soul who touches them. Attune yourself to one and the whole web of them will know your name, and carry you between themselves like a whispered message.' },
  { title: 'The Long Peace', text: 'For nine hundred generations nothing happened. This is the proudest sentence in all the old histories. Nothing happened. Nothing happened. Children grew old teaching children. The Light rose and rested. Nothing happened.' },
  { title: 'The Counting', text: 'An Architect called Vael-Who-Measures began to count the days remaining in the First Light. The number was vast. It was, however, a number. The histories say Vael never spoke again after finishing the count.' },
  { title: 'The Quiet Faction', text: 'Some Architects argued the Light should be spent freely until it died, and the world allowed its natural dark. Others swore to ration it across eternity. The histories call this disagreement THE QUIET, because for a century it was.' },
  { title: 'The Sundering — I', text: 'It was not war. Every monolith is emphatic on this, as if answering an accusation. It was not war. An Architect named Orun-of-the-Steady-Hands climbed the Spire alone, to move the Light to safety. We do not know from what.' },
  { title: 'The Sundering — II', text: 'The Light would not be held. That is all Orun said, after. THE LIGHT WOULD NOT BE HELD. It came apart in those steady hands into seven shards, and the Spire came apart around it, and the center of the world came apart around the Spire.' },
  { title: 'The Sundering — III', text: 'The lands tore loose and drifted, and where the center had been, distance itself grew strange. Walk far enough in Aethermoor and you will never reach an edge. The world is not endless. It is broken, which from inside looks the same.' },
  { title: 'The Scattering', text: 'The seven shards fell across the drifting lands like sparks off a struck anvil. Each burned itself a sanctum where it landed and waits there still, patient as only light can be. Light has crossed darker distances than these.' },
  { title: 'The Architects’ End', text: 'They did not die. They diminished — pouring what remained of themselves into the lands to keep them from drifting apart entirely. The mountains are their shoulders. The rivers are their veins. This is not a metaphor. It is anatomy.' },
  { title: 'Orun’s Vigil', text: 'Orun-of-the-Steady-Hands refused diminishment. The histories say Orun walks Aethermoor still, visiting each sanctum in turn, never touching the shards, only looking. If you meet a tall stranger who will not show you their hands — be kind.' },
  { title: 'The Grey Years', text: 'After the Sundering came years with no proper day — only a bruised twilight, and the cold working inward. The First Peoples burned their histories to keep their children warm, and that is why you find fragments now, and not books.' },
  { title: 'The Last Hearth', text: 'Of all the villages, one endured: the Last Hearth, built where a sliver of the First Light fell too small to be called a shard. The sliver does not warm. It only refuses, absolutely, to go out. Its keepers raise wayfarers, and send them walking.' },
  { title: 'The Wayfarer Oath', text: 'I will walk out and not look back until I have a reason to return that fits in my two hands. — The whole of the oath. The keepers of the Last Hearth distrust long promises. Long promises are how the Spire fell.' },
  { title: 'The Resonance', text: 'The shards call to one another across the broken lands. A wayfarer attuned to the Waystones can feel it: a pull, faint as a remembered song, always toward the nearest waiting shard. Trust it. Light does not lie about where it is.' },
  { title: 'The Doubt', text: 'A heresy, carved in a younger hand at the base of an older stone: WHAT IF THE LIGHT BROKE ITSELF ON PURPOSE? WHAT IF IT WANTED TO SEE THE WORLD FROM SEVEN PLACES INSTEAD OF ONE? No keeper has ever ordered it erased.' },
  { title: 'The Reunion', text: 'When the seven are carried together — the monoliths agree on this, every one of them, in the same words — when the seven are carried together, they will remember they were one, and the dark will end the way a long winter ends: not defeated. Forgiven.' },
];

/* ------------------------------------------------------------------ */
/* Flavor found in lesser ruins                                        */
/* ------------------------------------------------------------------ */

LORE.RUIN_LINES = [
  'Fallen pillars, soft with moss. Someone arranged stones into a small spiral here, long after the roof came down.',
  'A hearth, cold for centuries. The soot stain above it is shaped almost exactly like a bird.',
  'Steps descending into rubble. From below, very faintly, the sound of water that never finds the sea.',
  'A doorway standing alone, no walls to justify it. You walk around it. Then, feeling watched, back through it.',
  'Carvings worn to whispers. One word survives, repeated all the way around the lintel: STAY. STAY. STAY.',
  'A child’s toy of fired clay — a six-legged horse. It has waited here longer than most kingdoms lasted.',
  'Bones of a great hall. Scorch marks bloom across the floor in the shape of a perfect seven-pointed star.',
  'Someone sheltered here recently: a bed of bracken, a ring of stones. Whoever it was had very long strides.',
  'An old well, sealed with a millstone. Something below taps once, politely, and then respects your silence.',
  'A toppled statue of an Architect, face-down. You cannot shift it. Perhaps that is how it wants to be remembered.',
  'Shelves cut into stone, empty. On the lowest one, a sentence in charcoal: WE TOOK THE BOOKS. WE ARE SORRY. WE WERE COLD.',
  'The floor mosaic survives: a map of a world with a center. You stand on the missing piece.',
];

LORE.WAYSTONE_LINE = 'The Waystone wakes beneath your palm. Far away — in every direction at once — you feel the others notice you.';
LORE.WAYSTONE_AGAIN = 'The stone hums, content. It remembers you.';

/* ------------------------------------------------------------------ */
/* Orun-of-the-Steady-Hands, who walks Aethermoor still                */
/* ------------------------------------------------------------------ */

LORE.ORUN_LINES = [
  '“You walk well, small one.” The stranger does not turn around. When you blink, there is only flattened grass.',
  '“I do not touch them anymore. I only look.” The sleeves where hands should be do not move at all.',
  '“The Light would not be held. Nothing worth holding ever consents to it.” The air closes behind him like a book.',
  '“The monoliths exaggerate. It was not war. It was worse — it was care, applied wrongly.”',
  '“I count your steps, Wayfarer. Someone should. The keepers used to, before the books were burned for warmth.”',
  '“Be kinder to the dark than it was to us. It is only the shape grief took when it got tired.”',
  '“Seven places instead of one. Perhaps the heretics were right. Perhaps it wanted to see.” He sounds almost proud.',
  '“When you carry all seven, come to the Hearth. I will show you what I have been carrying.”',
];

LORE.ORUN_FINAL =
  'At the Last Hearth, the tall stranger finally turns, and draws his hands ' +
  'from his sleeves. They are not burned. They are full — two fistfuls of ' +
  'light, cupped and carried for an age, the piece of the First Light that ' +
  'came apart in his grip and that he never once put down. ' +
  '“It was never seven shards,” says Orun-of-the-Steady-Hands. “It was eight. ' +
  'I kept the smallest. I kept it the only way I knew — by never opening my hands again.” ' +
  'He opens them now. The light does not spill. It steps from his palms into yours ' +
  'like something that has been waiting politely for a very long time. ' +
  '“There,” he says, and flexes his fingers, and laughs at the feel of it. ' +
  '“Steady hands. Take the Art that goes with them. I have somewhere to be — ' +
  'I have not touched anything in nine hundred generations, and there is a world of it.”';

LORE.WIN_TEXT =
  'You carry the seven together, and they remember they were one. ' +
  'There is no thunderclap. There is a sunrise — an honest one, the first in an age — ' +
  'rolling across the broken lands and stitching them loosely back into a world. ' +
  'On a far hill stands a tall figure with steady hands, watching the light come back. ' +
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
