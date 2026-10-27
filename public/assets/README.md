# Pixel artwork source

Active atlas: `rocket-hideout-frlg.png`, original 1736 × 576 PNG downloaded without resizing.

- Source page: https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3734/
- Asset: Rocket Hideout, Pokémon FireRed / LeafGreen (Game Boy Advance).
- Uploader credited by the page: FrenchOrange.
- Original image URL: https://www.spriters-resource.com/media/assets/4/3734.png?updated=1755472417
- Selected by the user on 2026-10-27. The source page is not a blanket open-source license; original game artwork belongs to its respective rights holders.

`src/tileArtwork.ts` samples integer-aligned 16 × 16 tiles and one 32 × 32 obstacle. The atlas is used only for appearance; placement and movement remain controlled by maze JSON and the shared engine. No full map is rendered as a background.

`hideout-tiles-source.png` is the earlier 300 × 206 user-supplied screenshot, retained for provenance. It is no longer loaded by the renderer because it already contains downscaling blur.

## Item marker

`outdoor-3870.png`: unchanged 300 × 450 image supplied by the user as `3870.png`. Its embedded credit reads “Ripped by Hoeloe”. The selected ground-item Poké Ball is the 10 × 10 rectangle at (78, 144). `createItemArtwork` samples it at runtime and removes only the exact purple sheet background (#9933cc), then renders it at 2× native size. All `item` markers use it; names and marker visibility controls are preserved. Original artwork belongs to its respective rights holders.

## Stairs and NPC markers

- `tileset-2.png`: unchanged user-supplied 477 × 800 image, embedded credit “Pokémon FireRed/LeafGreen outdoor tileset. Ripped by fabout.” Small ladder sampled from (1, 766), 16 × 16, preserving native alpha. Both stairs and lift markers use it.
- `overworld-npcs.png`: unchanged user-supplied 238 × 2967 overworld NPC sheet. Fixed first-row second cell: (26, 42), 16 × 24. Only exact orange sheet background #ff7f27 is removed. Displayed 24 × 36 pixels, centered horizontally and aligned at the bottom of the map cell.
- No new image generation or resampling of the source files. Runtime Canvas sampling preserves pixel artwork; all original artwork belongs to its respective rights holders.
