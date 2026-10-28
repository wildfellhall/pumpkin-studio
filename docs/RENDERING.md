# Rendering notes

Hollow is a desktop-first, browser-local carving studio. It uses React, TypeScript, Three.js/WebGL2, polygon-clipping, and Vite. No server, account, remote texture host, or API key is needed. Fonts are bundled locally.

## Visual references

Reference photos were inspected for structure and lighting; no third-party photograph is redistributed in this project.

- [Daylight pumpkin, Instructables](https://www.instructables.com/Prepping-a-Pumpkin-for-Carving/): irregular ribs, narrow creases, diffuse color mottling, waxy specular highlights, and an olive/tan ridged stem.
- [Jack-o’-lanterns, Abingdon Square Conservancy](https://www.abingdonsquare.org/17th-annual-pumpkin-patch-2024): deep cavities, pale cut flesh, localized warm illumination, and visible wall thickness.
- [Pumpkin seeds and stringy pulp, Does It Go Bad](https://www.doesitgobad.com/wp-content/uploads/Pumpkin-seeds-and-stringy-inside.jpg): orange tissue membranes, tangled fibers, wet highlights, and flat cream seeds with raised edges.

The interface uses charcoal and muted plum surfaces, orange controls, locally bundled Creepster display type, and condensed utility labels. The canvas occupies the main workspace; tool controls remain directly below it. Headings and instructions describe actions rather than decorative seasonal copy.

## Geometry and materials

Each pumpkin is a periodic parametric surface with independently adjustable radius, height, rib count, and crease depth. Broad asymmetry, rounded shoulders, and a depressed stem attachment keep it from reading as a perfect sphere. An outer skin, inverted inner shell, and connecting rind walls give the model thickness. The lid is a separate matching shell segment.

Freehand cuts and cutters are polygons in surface UV space. Overlapping polygons are unioned. Surface triangles are clipped against the union, triangulated, and mapped back into 3D. Inner and outer surfaces receive the same cuts; boundary strips connect them. This produces actual openings visible from all angles, rather than black decals or front-facing overlays. UV seam cuts wrap across the periodic domain.

Skin uses seeded procedural color, roughness and fine bump textures, restrained clearcoat, image-based lighting, ACES tone mapping, and directional shadows. Paint and marker strokes are rasterized in UV space, preserving placement during rotation and shape changes. Paint uses directional flat-brush footprints with bristle gaps, uneven pigment, roughness variation, bump detail, and displacement for raised ridges. Marker ink is thinner and translucent without raised paint relief. Erasing restores the underlying rind or scraped flesh. Texture canvases and brush stamps are reused to limit allocation during drawing.

Wet pulp consists of folded, tapered tissue ribbons, branching fiber meshes, and flattened pointed seeds with modeled rims. Fibrous textures, clearcoat, varied roughness, and limited transmission approximate the tissue and mucilage. Scoop gestures stretch clumps upward, animate translucent drips, then deposit the extracted material on the board. Geometry is merged by material to reduce draw calls. This is an interactive visual simulation, not a computational fluid-dynamics solver.

The serrated saw sweeps a continuous through-slot along an open gesture; its width is adjustable. The drill produces smaller circular through-holes. The V-gouge and broad scraper expose flesh using color, bump, and displacement layers while keeping the inner shell intact. These surface tools are a shallow-carving approximation; through-tools change actual shell topology. All four tools have distinct modeled metal heads and support undo/redo and project persistence.

Metal utensils have reflective physical materials, modeled thickness, wood handles and rivets. They follow the cursor while editing. Flames use crossed emissive shader planes with a blue base, warm mantle, bright core, time-varying deformation and irregular brightness. A shadow-casting point light illuminates the hollow shell and shines through cut geometry. Restrained bloom supplies the halo. LED sources provide steady amber or violet light.

## Interaction and persistence

Guided mode follows picking, preparation, carving and lighting. Freestyle permits any order. Both modes offer orbit controls, undo/redo (40 edits), five varieties, eleven tools, six cutter shapes, three additive templates, selectable light sources and illumination controls. Cutting the lid and scooping can be performed with canvas gestures or accessible buttons. Older project files without surface-carving data remain supported.

The active project autosaves to localStorage. The local gallery stores up to twelve snapshots with editable project data. A `.hollow.json` download provides a portable editable backup; imports are bounded and validated. Opening a saved project or starting fresh can be undone. Storage failure leaves project-file download available. There is no cloud persistence or collaboration.

## Video and images

Video export captures the actual WebGL canvas using `captureStream` and `MediaRecorder`. It records one full turn at 720p or 1080p, in selected daylight or night, with a 30 fps target. Format is selected with `MediaRecorder.isTypeSupported`: MP4 when an available encoder accepts it, otherwise WebM. It does not silently label WebM as MP4. Actual frame rate depends on the GPU and browser; keep the tab foregrounded during capture. Export cancellation stops tracks and restores the previous camera, dimensions, lighting, and rotation. A PNG uses the current workshop camera and lighting.

Rendering requires WebGL2. Unsupported graphics and recording are reported in the interface. The interface adapts to narrow screens, but desktop pointer controls and GPU hardware are recommended for the richest experience.

## Running locally

```sh
npm ci
npm run dev -- --port 5173
```

Open `http://localhost:5173`. Use `npm run build` for a production bundle and `npm run preview` to serve it. `npm test` verifies actual shell openings, polygon union/seam handling, and project validation. With the local dev server running, `npm run test:e2e` exercises the workshop in Playwright and writes screenshots and downloadable artifacts to the ignored `output/` directory.

Keyboard controls: H switches to orbit; F toggles fullscreen; Ctrl/Cmd Z undoes; Ctrl/Cmd Shift Z redoes. Right-drag orbits while a tool is selected. Scroll zooms.

The repository README is intentionally a zero-byte file, as requested.

## Verified build

The desktop end-to-end test passed on Chromium with Metal acceleration on October 27, 2026, with no browser errors. It exercises all five varieties, guided ordering, actual lid/scoop/cut/paint gestures, cutters, saw slots, drill holes, V-gouge and scraper strokes, erase and undo/redo, candle and LED settings, rotation, project downloads/import, local gallery, reload persistence, export cancellation, Freestyle, modal keyboard dismissal, and a 390-pixel mobile layout without horizontal overflow.

Downloaded videos were independently decoded with FFmpeg and inspected at multiple points in the turn. The tested six-second exports were H.264 MP4: 1280 × 720 in night lighting and 1920 × 1080 in daylight. Other browsers may choose WebM instead. Production build and six geometry/project-validation tests pass, including ray tests for narrow and wide saw cuts and validation of saved surface carving. The production dependency audit reports no known vulnerabilities at verification time.
