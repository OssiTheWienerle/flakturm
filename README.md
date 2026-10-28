# Flakturm Augarten

An interactive 3D reconstruction of the Gefechtsturm (gun tower) in Vienna's
Augarten — Pair VII, code name "Peter" — built July 1944 to January 1945.

The site is a single-page, self-contained Three.js experience. There is no build
step: Three.js r180, the fonts and all assets are vendored locally, and every
concrete, graffiti, roof, foliage and sky texture is generated procedurally in
the browser at runtime.

## Run it

```bash
cd flakturm
python3 -m http.server 4173
```

Open <http://localhost:4173/>. A local server is required because the page uses
ES modules.

## What is in the scene

- 16-sided shaft, 32-sided upper drum, eight cantilevered light-flak balconies,
  concrete `Kragträger` brackets, steel cable bands and clamp boxes.
- Four circular roof pits around the central hoist slot, a broken parapet with
  its post-war safety railing, rebar and rubble.
- Board-formed concrete with pour lines, tie holes, cracks, spalls, runoff and
  brick scars; the `NEVER` / `AGAIN!` graffiti, entrance annex and porch.
- Augarten setting: lawn, circular gravel walk, allées, chain-link fence and
  gate, benches, lamps, autumn trees, ivy, distant Viennese blocks and a
  simplified Leitturm on the horizon.
- Four camera views, three lighting presets, six hotspots and a sourced history
  drawer. Keyboard focus is trapped in the drawer; reduced-motion preferences
  are respected.

## Historical basis

The tower data follows the pair-specific table in the German Wikipedia article
"Wiener Flaktürme" and the English "Flak tower" article, with the listed-monument
record of the Bundesdenkmalamt:

- Bauart III, 55 m high, 43 m diameter, 13 storeys, 149,100 t.
- Outer wall 2.5 m; roof/ceiling slab 3.5 m.
- Architect Friedrich Tamms, represented in Vienna by Anton Ruschitzka.
- Built by Philipp Holzmann and Gottlieb Tesch, using forced labour, prisoners
  of war and foreign workers.
- Eight balconies intended for 2 cm light flak but never armed in Vienna; the
  main armament was four 12.8 cm Flakzwilling 40 mounts on the roof.
- Monument protection in 2000; the 2002 data-centre plan failed; the tower was
  closed for months in spring 2006 after internal rubble shifted and pushed an
  outer wall outward.
- Empty, state-owned, managed by the Burghauptmannschaft, no public access.

## Limits of the reconstruction

This is an interpretation, not a measured survey. The roof pits and central
hoist are reconstructed from aerial photographs; the guns themselves are not
modelled. The park, city and distant Leitturm are simplified scenery. Concrete
and graffiti are procedural artwork rather than photographic texture.

## Sources

- [Wiener Flaktürme — German Wikipedia](https://de.wikipedia.org/wiki/Wiener_Flakt%C3%BCrme)
- [Flak tower — English Wikipedia](https://en.wikipedia.org/wiki/Flak_tower)
- Bundesdenkmalamt listed-monument record
