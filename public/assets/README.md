# Pixel artwork source

Active atlas: `rocket-hideout-frlg.png`, original 1736 × 576 PNG downloaded without resizing.

- Source page: https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3734/
- Asset: Rocket Hideout, Pokémon FireRed / LeafGreen (Game Boy Advance).
- Uploader credited by the page: FrenchOrange.
- Original image URL: https://www.spriters-resource.com/media/assets/4/3734.png?updated=1755472417
- Selected by the user on 2026-10-27. The source page is not a blanket open-source license; original game artwork belongs to its respective rights holders.

`src/tileArtwork.ts` samples integer-aligned 16 × 16 tiles and one 32 × 32 obstacle. The atlas is used only for appearance; placement and movement remain controlled by maze JSON and the shared engine. No full map is rendered as a background.

`hideout-tiles-source.png` is the earlier 300 × 206 user-supplied screenshot, retained for provenance. It is no longer loaded by the renderer because it already contains downscaling blur.
