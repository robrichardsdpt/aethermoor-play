# AETHERMOOR — The Shattered Light

An infinite, procedurally generated world-exploration game. No build step, no
dependencies, no assets — pure HTML5 canvas, vanilla JavaScript, and WebAudio.

> Before the first dawn, the Architects crossed the dark between stars,
> carrying the First Light — the captive heart of their dead home star — and
> grew a world around it. Something followed them across the void. When the
> Spire broke in the Sundering, the Light burst into seven shards and the
> world tore itself into endless wandering lands. You are the last Wayfarer
> of the Last Hearth. Find the seven Shards. Relight the dark — before what
> followed them finds it first.

## Play

**Live:** <https://robrichardsdpt.github.io/aethermoor-play/> — works on
desktop and phones (virtual joystick + touch controls appear automatically).

Locally: open `index.html` in any modern browser. That's it.
(Or serve it: `python3 -m http.server 8000` → <http://localhost:8000>.)

## Repos & deployment

- **Source of truth (private):** `robrichardsdpt/aethermoor`
- **Deploy mirror (public):** `robrichardsdpt/aethermoor-play`, served by
  GitHub Pages from `main`. (Pages can't serve private repos on the free
  plan; a deployed static site's files are publicly fetchable regardless,
  so the mirror exposes nothing that deployment itself doesn't.)

Ship changes with `npm run deploy` — it pushes `main` to both remotes;
Pages redeploys automatically in about a minute.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | move |
| Shift | sprint (uses stamina; swimming drains it too) |
| E | examine monoliths, search ruins, attune Waystones, challenge Guardians |
| 1–9 | in battle: use an Art, flee, or pick a reward card |
| M | map of the known world — click an awakened Waystone to fast-travel |
| J | journal: your evolution, Arts, shards, lore fragments, discoveries |
| P | sound on / off |
| H | help |

## The world

- **Infinite & seeded.** Terrain, biomes, ruins, and names are all derived from
  one seed. Add `?seed=anything` to the URL to explore a different world;
  press **Shift+N** on the title screen for a random one.
- **Thirteen biomes**, from the Eldwood to the Frostveil to the Worldspine.
  Deep water is swimmable but exhausting. The high peaks cannot be crossed.
- **Seven Shard Sanctums** ring your starting point at increasing distances —
  and a **Guardian** coils around every one. Defeat all seven to restore the
  First Light.
- **3D battles in the Umbra** — the folded nothing the Architects once
  sailed. A hand-rolled software-3D engine: flat-shaded low-poly with depth
  fog, soft shadows, a shattered moon, nebulae, drifting motes, shockwaves,
  slash arcs, an intro camera sweep, impact punch-ins, and slow-motion kill
  blows. Arenas are themed by the biome where the dark caught you.
- **Turn-based with reflexes.** Every attack opens a timing ring — strike
  as it closes for a **critical**; when a foe lashes out, time it to
  **parry**. Crits and parries build a **combo** that multiplies your
  damage until you get hit.
- **Packs and intents.** The Unlit hunt in groups of up to three, each
  telegraphing its next move (strike, guard, gathering darkness, void
  bolt, devour) — read the intents, pick your target (Tab or tap), shield
  before the heavy hits. Stormcall now arcs across the whole pack, and the
  new Hollow Casters bombard you from range.
- **Every victory teaches you.** After each win, choose one of three cards:
  learn a new Art (Emberlash, Tidebind, Stoneward, Stormcall, Frostbite,
  Duskveil, Dawnstrike), upgrade one you know, or harden your body.
- **You evolve.** Levels carry you through four forms — Wayfarer →
  Lightbearer → Shardborn → Luminarch — each with a grander battle avatar
  (shoulder shards, halo, orbiting crystals, wings of light) and a brighter
  overworld aura. Menace grows with distance from the Last Hearth and with
  the dark; defeat just returns you to the Hearth, lighter but alive.
- **Monoliths** carry the 21 fragments of the old histories — the full story
  of the Architects, the Sundering, and what Orun-of-the-Steady-Hands did.
- **Waystones** attune to you. Once one knows your name, the Resonance compass
  points to the nearest waiting Shard, and any awakened Waystone can carry you
  to any other via the map.
- **Shard Boons.** Every claimed shard permanently reshapes how you move:
  Stonestride opens the impassable peaks of the Worldspine, Tidewalker makes
  the Deep carry you, Frostpath freezes water underfoot, Stormstep turns
  sprint into a crackling dash, Dawnlight widens your lantern, Emberheart
  doubles your recovery, Duskcloak hides you from the Unlit.
- **Living weather.** Rain, snow over the cold lands, drifting fog, restless
  wind, and true thunderstorms with lightning and rolling thunder. On cold
  clear nights, auroras breathe across the sky.
- **A generative score.** No audio files — the game composes its own music,
  seeded per world: bright pentatonic plucks by day, slow minor keys by
  night, war drums in the Umbra. Each world has its own song.
- **Umbra Rifts.** At night the dark bleeds through. Step into a rift and
  fight a two-battle gauntlet; seal it and earn Riftlight — +4% might and
  vitality, permanently, stacking forever.
- **Guardian signatures.** Each wounded Guardian fights with its shard's
  nature: blinding radiance, stoneskin, a sky split in two, clinging embers,
  blood-slowing frost, a veil your blows pass through.
- **Orun walks the world.** The tall stranger from the monolith fragments is
  real. He visits each sanctum after its Guardian falls, and rarely finds
  wayfarers on the road — he will not show you his hands. The fragments say
  to be kind. After the Light is restored, go home to the Last Hearth.
  There is an eighth Art, and a second ending.
- **Day and night** pass in a 5-minute cycle. Fireflies rise in the woods at
  dark; your lantern keeps a small circle of the world lit. Each shard
  claimed makes the nights gentler.
- **Progress saves automatically** (localStorage, per seed).

## Code layout

| File | Contents |
| --- | --- |
| `src/rng.js` | seeded hashing & PRNG |
| `src/noise.js` | value noise + fractal Brownian motion |
| `src/lore.js` | the mythology, lore fragments, name generator |
| `src/skills.js` | the Arts, reward cards, evolution tiers, foe names |
| `src/world.js` | biomes, chunked terrain, POIs, sanctum placement |
| `src/audio.js` | procedural ambient drone, chimes, hits, fanfares |
| `src/player.js` | the Wayfarer: movement, stamina, swimming, aura |
| `src/battle3d.js` | the software-3D engine: projection, meshes, particles |
| `src/battle.js` | turn logic, foe AI, rewards, evolution, battle UI |
| `src/ui.js` | HUD, journal, banners, minimap, world map |
| `src/main.js` | game loop, discovery, shades, day/night, save/load |
