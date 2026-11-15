# ABYSS Rebuilt Alpha 3 — Structural Rigidity + Operator Controls

## Updates
- Increased constraint stiffness, solver iterations, and strengthened continuous-material bracing to reduce unrealistic intact-ship bending.
- Higher accumulated stress threshold: extreme loading or severe cuts still allow progressive tearing.
- Continuous drag cut begins immediately on pointerdown and removes intersecting structural connections. Adjustable cut width.
- Watertight compartment overview with 12 visible flooding bays, 11 operable bulkhead doors, and per-compartment pumping.
- Corrected door flow: OPEN doors allow adjacent compartment transfer; SEALED doors block that flow.
- Fleet selector, world bar, 9 sea-state levels, time control, tsunami editor, map overview, pan/zoom, bridge and props controls.
- 12 existing textures remain in assets/. Rigging, sound, lights, and original particle-spring simulation retained.

## Limits
This is an iterative rebuild, not a complete port of the legacy game's exact per-vessel compartments, every historical bulkhead, advanced props or full original UI. Water volumes are approximate. The current mini-map is schematic, not a terrain editor. Tsunami height, direction, width and start coordinate now control a localized travelling wave pulse. It remains an approximate 2D wave model.

GitHub Pages: upload index.html, engine.js, sw.js, README.md into repository root; keep assets/ intact.
