# ABYSS Rebuilt — Independent Physics Alpha 1

This is a **separate new implementation**, not a patch to ABYSS V11.9. It uses the 12 ship textures from the existing ABYSS project, resized for mobile. Do not replace the production ABYSS repository until you have tested this alpha.

## Included
- All 12 existing ship artwork selections, original visual texture layers
- New independent 2D structural particle network: each alpha-material sample becomes a dynamic point, with four-way spring/damper-like distance constraints
- Actual load-bearing breakable links, no rigid-body transport, no keel-hinge animation, no spring-to-original-position anchoring
- Progressive structural damage, cutting, holes, repairing severed links, floodwater load, hydrostatic buoyancy, waves/tsunami, seabed contacts, grab, inspect, basic telegraph, day/ocean-style canvas, touchscreen controls and strings overlay
- GitHub Pages and offline-capable PWA shell

## Known limitations (important)
- This is an experimental alpha. It has **not** passed interactive browser or physical iPad physics tests in the current environment.
- Not a complete replacement for all features of ABYSS V11.9. Full ship-specific watertight-door layouts, pumps, rigging, props, historical sinking calibration, lighting circuits, effects, sounds, world maps and the complete original UI are **not yet ported**.
- The ship textures are retained, but structural layers are automatically approximated from alpha pixels. These are not hand-authored per-material structural maps. The visible ship texture tiles are intentionally rigid, so small gaps can appear as the ship bends.
- The flooding model is a prototype compartment wetness model, not full pressure-driven water flow through arbitrary openings. It needs calibration.
- This is an original approximation informed by publicly documented principles, not a copy of Floating Sandbox engine code.

## Installation
1. Extract ZIP. Keep `assets/` and all files together.
2. Upload the **contents** of the extracted folder to the root of a separate GitHub Pages test repository, not the existing `Abyss-sink` production repo.
3. Enable GitHub Pages from `main` branch / root. Wait for deployment.
4. Test deep cuts on Titanic and Edmund Fitzgerald, and send video of any instability.

## Physics reference
- https://floatingsandbox.com/
- https://github.com/GabrieleGiuseppini/Floating-Sandbox
- https://github.com/GabrieleGiuseppini/Floating-Sandbox/blob/master/Guides/How%20to%20Build%20a%20Ship.md
