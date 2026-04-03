# TweenGen

![TweenGen Banner](assets/banner_screenshot.png)

> A powerful, browser-based animation editor that lets you create keyframe animations visually — then export them as production-ready standalone HTML/CSS/JavaScript code powered by GSAP. Now with audio BGM support, bitmap-to-vector image conversion, shape deformation with path morphing, and canvas background images.

---

## Demo

> **Live Demo:** [TweenGen](https://tweengen.vercel.app/)

---

## Table of Contents

- [What It Does](#what-it-does)
- [Key Features](#key-features)
- [Technologies Used](#technologies-used)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [How to Run Locally](#how-to-run-locally)
- [How to Use](#how-to-use)
- [How the Export Works](#how-the-export-works)
- [Technical Deep Dives](#technical-deep-dives)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

---

## What It Does

TweenGen is a **visual keyframe animation editor** built entirely in the browser. It allows users to:

1. **Create objects** on a canvas — rectangles, circles, ellipses, rounded rectangles, triangles, diamonds, pentagons, hexagons, stars, arrows, hearts, crosses, text, freehand drawings, and uploaded images.
2. **Set keyframes** at specific points on a timeline to define position, scale, rotation, opacity, fill color, and z-order.
3. **Deform shapes** — drag vertices, add Bézier curves, and morph between shapes over time with auto-generated keyframes.
4. **Add background music** — upload an audio file, see its waveform in the timeline, trim it to match your animation duration, and hear it synced to playback.
5. **Preview animations** in real time using a GSAP-powered live preview that matches the final output exactly, including audio sync.
6. **Export animations** as standalone files (`index.html`, `style.css`, `animation.js`, and optionally an audio file) that can run in any modern browser with zero dependencies beyond a CDN-hosted GSAP library.

Think of it as a lightweight alternative to tools like Adobe Animate or After Effects, but designed specifically for web developers who need clean, exportable code — with a production-level audio workflow.

---

## Key Features

| Feature | Description |
|---|---|
| **12 Shape Types** | Add rectangles, circles, ellipses, rounded rects, triangles, diamonds, pentagons, hexagons, stars, arrows, hearts, and crosses via a shape picker flyout. |
| **Text Objects** | Add text elements via a rich input dialog with live preview, font size slider (8–120px), and a color picker with 20 preset swatches plus custom hex input. Double-click any text object on the canvas to re-open the editor and change content, size, or color. |
| **Image Upload** | Upload PNG, JPG, or other image files directly onto the canvas. Images are auto-scaled and fully animatable. |
| **Image Format Conversion** | Convert uploaded bitmap images to true SVG vector paths for export. Choose from 5 trace presets (Detailed, Posterized, Sharp, Smooth, Minimal) with a side-by-side comparison preview. Exported code uses `<path>` elements instead of base64 blobs — stays sharp at any zoom level. |
| **Freehand Drawing** | Draw multi-stroke paths directly on the canvas with configurable color, stroke width, and curve smoothing. Press Enter to commit, Escape to cancel. |
| **Paint Bucket Fill** | MS Paint-style flood fill tool. Click inside any enclosed region of a drawing to fill it with color. Fills are embedded in the parent path and move with it during animation. |
| **Shape Deformation** | Open any solid shape in a vertex/curve editor. Drag blue vertex nodes to reshape the geometry, double-click green edge midpoints to convert straight edges into Bézier curves, and drag orange control handles to adjust curve arcs. Right-click a control point to convert a curve back to a straight line. Supports undo, reset, and real-time preview. |
| **Path Morphing** | Deforming a shape auto-creates morph keyframes — the original path at time 0 and the deformed path at the current scrubber time. During playback, the shape smoothly interpolates between paths segment by segment (e.g., triangle morphs into a cone). Move the scrubber and deform again to extend the morphing sequence with additional keyframes. |
| **Shape Outline** | MS Paint-style outline system for solid shapes. Choose from 5 thickness options (None, 1px, 3px, 5px, 8px) with visual line previews, plus a color picker for the outline. Renders as CSS `outline` for div shapes, SVG `stroke` for polygon shapes, and `-webkit-text-stroke` for text. |
| **Vector Detail Editor** | Open any solid shape or traced image at 2×–6× zoom in a dedicated editor. Draw freehand strokes or place shapes (rect, circle, triangle, diamond, star, arrow, pentagon, hexagon) with fill/outline modes. Additions are converted to SVG markup and baked into the vector data on save. |
| **Canvas Background Image** | Upload any image as the canvas backdrop. The image scales to cover the full 1400×800 canvas area. Applies to the editor, live preview, and exported code (embedded as CSS `background-image`). Replace or remove the background at any time from the Properties Panel. |
| **Audio / BGM Support** | Upload MP3, WAV, OGG, AAC, M4A, or WebM audio files. A waveform visualization renders in the timeline section with volume, mute, and remove controls. Drag trim handles to select which portion of the audio plays during the animation. Toggle between **Sync view** (trimmed region stretched to match the timeline for precise editing) and **Full Audio view** (entire waveform with draggable trim handles). Audio syncs with the editor's play/pause/stop controls, the live preview, and the exported code. The original audio file is exported as a separate file with zero quality loss. |
| **Audio Trim Region** | Draggable start/end handles on the waveform let you select exactly which slice of the audio matches your animation. A "Fit to Duration" button auto-sizes the region to match your animation length. The region can be slid along the full audio to pick the perfect segment. Switch to **Sync view** to see the trimmed region zoomed to fill the full timeline width — ideal for precise alignment. |
| **Color Animation** | Animate fill color between keyframes. Change a shape's color at different points on the timeline and the color smoothly interpolates during playback. Works in the editor, live preview, and exported code for all solid shapes, SVG shapes, and text. |
| **Duplicate Objects** | Duplicate any selected shape, text, or image with one click. Creates a copy with the same properties offset by 30px. For images, reuses the same source data. Preserves outlines, deformations, vector edits, and paint bucket fills. |
| **Keyframe Timeline** | Place keyframes along a timeline scrubber. Each keyframe captures an object's full transform state including position, scale, rotation, opacity, fill color, z-index, and deformed path. |
| **Multi-Select Keyframing** | Select multiple objects and click "Add Keyframe" to record all of them at once — critical for character animation where relative positions must stay in sync. |
| **Keyframe All** | One-click button to keyframe every object on the canvas at the current time. |
| **Easing Functions** | Per-keyframe easing — linear, ease-in/out/in-out (Quad, Cubic), bounce, and elastic. Right-click any keyframe diamond to change. |
| **Z-Index Animation** | Animate layer order between keyframes. Objects swap z-order mid-transition with a configurable swap point (0%–100% of the segment). |
| **Anchor Point Editing** | Drag a visual crosshair to set a custom rotation/scale pivot point for any object. Keyframes automatically adjust to prevent jumps. Double-click to reset to center. |
| **Live Preview** | A GSAP-driven preview panel that renders the animation identically to the exported code, including audio playback, path morphing, background images, and outlines. Always loops for easy review. Audio only plays when the Live Preview tab is visible. |
| **Code Export** | Generates complete, standalone HTML + CSS + JS files. When audio is present, exports 4 files (including the original audio). Copy individual files or download all at once. No build step required. |
| **Looping Playback** | Toggle loop mode for continuous animation playback during editing. Can be toggled during playback. Loop state carries into exported code. |
| **Track Management** | Lock tracks to prevent accidental edits. Hide tracks to declutter the timeline and simultaneously hide objects from the canvas. Drag-and-drop to reorder tracks. Rename tracks by double-clicking. |
| **Canvas Object Visibility Sync** | When a track is hidden via the visibility toggle, the corresponding object disappears from the canvas (not just the timeline). Re-showing the track restores the object. |
| **Layer Controls** | Bring objects forward or send them backward in the z-order. Sync track order from canvas or manually reorder. |
| **Object Grouping** | Select multiple objects and group them (Cmd/Ctrl+G). Ungroup with Cmd/Ctrl+Shift+G. Groups animate as a single unit. |
| **Fill & Stroke Color** | Edit fill color for shapes and text, or stroke color for paths, directly in the Properties Panel. |
| **Canvas Background** | Set a custom background color and/or upload a background image. Both apply to the editor, live preview, and exported code. |
| **Properties Panel** | Edit position, scale, rotation, and opacity numerically. Shows anchor point info, fill/stroke colors, outline controls, shape deformation tools, image export format toggle, and paint bucket controls contextually. |
| **Keyboard Shortcuts** | Delete with `Delete`/`Backspace`. Exit drawing mode with `Escape`. Commit drawing with `Enter`. Group with `Cmd/Ctrl+G`. Ungroup with `Cmd/Ctrl+Shift+G`. |

---

## Technologies Used

### Core Framework & Libraries

| Technology | Role |
|---|---|
| **React 18** | UI framework. Component-based architecture for the editor, canvas, timeline, and panels. |
| **Recoil** | Global state management. Manages shared state (canvas objects, keyframes, playback, drawing, tool modes, audio) across deeply nested components without prop drilling. |
| **Fabric.js 7** | Interactive HTML5 canvas library. Handles object rendering, selection, dragging, scaling, rotation, polygon/path shapes, image objects, and freehand drawing on the editor canvas. |
| **GSAP 3** | Animation engine used in the Live Preview and in all exported code. Provides smooth, high-performance animations with easing support. Syncs audio playback via timeline callbacks. |
| **Material UI (MUI) 7** | Component library providing the UI shell — panels, buttons, sliders, tabs, menus, dialogs, drawers, and tooltips. |
| **imagetracerjs** | Client-side bitmap-to-vector conversion. Traces uploaded PNG/JPG images into mathematical SVG `<path>` elements using color quantization and contour detection. |
| **Web Audio API** | Browser-native API used to decode audio files and extract waveform amplitude peaks for the timeline visualization. Runs entirely client-side. |

### Tooling & Build

| Technology | Role |
|---|---|
| **Vite 7** | Development server and build tool. Chosen for fast hot-module replacement during development. |
| **React Router 7** | Client-side routing (currently single-route, extensible for future pages). |

### Why These Choices?

- **Recoil over Redux/Zustand:** The animation editor has many interdependent state slices (selected object ↔ keyframes ↔ timeline position ↔ canvas render ↔ tool modes ↔ track visibility ↔ audio state). Recoil's atom/selector model maps cleanly onto this without heavy boilerplate. Audio state is kept in separate atoms to isolate it from the core animation state.
- **Fabric.js over raw Canvas API:** Fabric.js abstracts away hit-testing, selection handles, transforms, polygon rendering, and event handling — all critical for an interactive editor — while still giving access to the underlying canvas for custom operations like flood fill.
- **GSAP in exports:** GSAP is the industry standard for web animations. Using it in exports means the generated code is performant, well-supported, and familiar to any web developer. GSAP's `onUpdate` callback makes audio sync straightforward.
- **imagetracerjs for vectorization:** Runs entirely in the browser with zero server dependencies. Produces real SVG path data (not wrapped bitmaps), which is trivially provable by inspecting the exported source code or zooming in.
- **Web Audio API for waveforms:** Native browser API — no npm dependency needed. Decodes audio on a copy of the ArrayBuffer so the original file bytes are never modified.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Header: TweenGen                                                [<> EXPORT CODE]    │
├─────────┬────────────────────────────────────────────────────┬───────────────────────┤
│         │           EDITOR  |  LIVE PREVIEW                  │                       │
│ Toolbar │────────────────────────────────────────────────────│  Properties Panel     │
│         │                                                    │                       │
│ • Shapes│   ┌────────────────────────────────────────┐       │  • X / Y              │
│ • Text  │   │                                        │       │  • Scale X / Y        │
│ • Image │   │          Fabric.js Canvas              │       │  • Rotation           │
│ • Audio │   │          + Anchor Point Overlay        │       │  • Opacity            │
│ • Draw  │   │          + Background Image            │       │  • Fill Color         │
│ • Fill  │   │                                        │       │  • Stroke Color       │
│ • Anchor│   └────────────────────────────────────────┘       │  • Outline (W + C)    │
│ • Dupe  │                                                    │  • Canvas BG / Image  │
│ • Group │   ┌────────────────────────────────────────┐       │  • Drawing Opts       │
│ • Delete│   │  Timeline Panel                        │       │  • Paint Bucket       │
│ • Z-Ord │   │  • Playback Controls (+ audio sync)    │       │  • Anchor Point       │
│         │   │  • Scrubber                            │       │  • Deform Shape       │
│         │   │  • Per-Object Tracks                   │       │  • Vector Detail Ed.  │
│         │   │  • Keyframe Diamonds                   │       │  • Image Format       │
│         │   │  • Lock / Hide / Reorder               │       │    (Bitmap / Vector)  │
│         │   │                                        │       │                       │
│         │   │  ┌────────────────────────────────────┐│       │                       │
│         │   │  │ Audio Waveform Track               ││       │                       │
│         │   │  │ |l||ll|||l|ll||l|||ll|l||ll|||l|l| ││       │                       │
│         │   │  │ Drag handles to trim / Vol / Mute  ││       │                       │
│         │   │  └────────────────────────────────────┘│       │                       │
│         │   └────────────────────────────────────────┘       │                       │
├─────────┴────────────────────────────────────────────────────┴───────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                             Recoil State Layer                                 │  │
│  │  canvasObjects  │ keyframes     │ currentTime  │ selectedObj   │ trackOrder    │  │
│  │  fabricCanvas   │ duration      │ isPlaying    │ drawingMode   │ lockedTracks  │  │
│  │  fillToolActive │ fillToolColor │ canvasBgColor│ loopPlayback  │ hiddenTracks  │  │
│  │  audioFile      │ audioWaveform │ audioVolume  │ audioMuted    │ audioRegion   │  │
│  │  canvasBgImage  │               │              │               │               │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Utility Modules                                   │  │
│  │  fabricHelpers.js │ interpolation.js │ codeGenerator.js  │ shapeDefinitions.js │  │
│  │  easing.js        │ floodFill.js     │ audioUtils.js     │ imageTracer.js      │  │
│  │  pathUtils.js     │                  │                   │                     │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (drag, click, draw, fill, upload audio, deform shape)
        │
        ▼
  Fabric.js Canvas Event / Tool Handler / File Reader / PathDeformModal
        │
        ▼
  Extract Properties (fabricHelpers.js) / Decode Audio (audioUtils.js) /
  Parse Path (pathUtils.js)
        │  x, y, scaleX, scaleY, rotation, opacity, fill, zIndex, deformedPath
        │  waveform peaks, audio duration, arrayBuffer
        ▼
  Recoil State Update
        │  canvasObjects, keyframes, selectedObject, trackOrder
        │  audioFile, audioWaveform, audioRegion, canvasBgImage
        ▼
  ┌───────────────────────────┐     ┌───────────────────────────┐
  │  Editor Canvas            │     │  Live Preview             │
  │  (interpolation.js)       │     │  (GSAP timeline)          │
  │                           │     │                           │
  │  • Lerp between KFs       │     │  • Mirrors editor exactly │
  │  • Color interpolation    │     │  • Audio sync via         │
  │  • Z-index reordering     │     │    GSAP callbacks         │
  │  • Path morph interp.     │     │  • Region-mapped playback │
  │  • Hidden track sync      │     │  • Path morphing via      │
  │  • Background image       │     │    onUpdate interpolation │
  └─────────────┬─────────────┘     └───────────────────────────┘
                │
                ▼ (on Export)
  Code Generator (codeGenerator.js)
                │
                ▼
  ┌─────────────────────────────────────────────────────────┐
  │  index.html + style.css + animation.js                  │
  │  + audio.mp3 (when audio is present)                    │
  │  Background image embedded as CSS background-image      │
  │  Path morphing via inline interpolatePaths() function   │
  └─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
TweenGen/
│
├── src/
│   ├── main.jsx                    # App entry point, Recoil + Router + MUI theme
│   ├── App.jsx                     # Route definitions
│   ├── App.css                     # Global styles
│   ├── index.css                   # CSS reset and base styles
│   │
│   ├── store/                      # Global state management (Recoil)
│   │   ├── atoms.jsx               # Core state atoms (objects, keyframes, playback, drawing,
│   │   │                           #   anchor editing, locked/hidden tracks, fill tool, bg color,
│   │   │                           #   bg image)
│   │   ├── audioAtoms.js           # Audio-specific atoms (audioFile, waveform, volume, mute, region)
│   │   ├── audioHooks.js           # Audio-specific hooks (useAudioFile, useAudioWaveform, etc.)
│   │   ├── selectors.jsx           # Derived state (selected object details, keyframe counts)
│   │   └── hooks.jsx               # Custom hooks wrapping useRecoilState for each core atom
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.jsx      # Top-level layout: header, toolbar, tabs, properties panel.
│   │   │   │                       #   Passes isPreviewVisible to LivePreview to prevent
│   │   │   │                       #   audio auto-play when the tab is hidden.
│   │   │   └── Header.jsx          # App bar with title and Export Code button
│   │   │
│   │   ├── Canvas/
│   │   │   ├── Canvas.jsx          # Fabric.js canvas — object creation, selection, drawing,
│   │   │   │                       #   interpolation (including fill color and path morphing),
│   │   │   │                       #   fill sync, z-index ordering, group support, hidden track
│   │   │   │                       #   canvas sync, background image rendering, text edit dialog
│   │   │   └── AnchorPointOverlay.jsx # Visual crosshair overlay for anchor/pivot editing
│   │   │
│   │   ├── Timeline/
│   │   │   ├── Timeline.jsx        # Timeline container with track ordering, visibility management,
│   │   │   │                       #   drag-and-drop reorder, hidden tracks dropdown, AudioTrack
│   │   │   ├── AudioTrack.jsx      # Audio waveform visualization with trim handles, volume/mute,
│   │   │   │                       #   region dragging, playhead tracking, "Fit to Duration" button
│   │   │   ├── PlaybackControls.jsx# Play/pause/stop with audio sync, loop toggle, keyframe nav,
│   │   │   │                       #   add keyframe, multi-select keyframing, keyframe all,
│   │   │   │                       #   audio region-mapped playback with drift correction,
│   │   │   │                       #   deformed path capture for morph keyframes
│   │   │   ├── TimelineScrubber.jsx# Time slider
│   │   │   └── TimelineTrack.jsx   # Per-object track with keyframe diamonds, context menu
│   │   │                           #   (easing, z-swap point, delete), lock, hide, rename
│   │   │
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.jsx         # Left sidebar: shape picker, text (via dialog), image upload,
│   │   │   │                       #   audio upload, drawing, paint bucket, anchor edit, duplicate,
│   │   │   │                       #   group/ungroup, delete, z-order
│   │   │   ├── ShapePicker.jsx     # Popover flyout listing all 12 shape types with SVG previews
│   │   │   ├── TextInputDialog.jsx # Rich text input dialog with live preview, font size slider,
│   │   │   │                       #   color picker with 20 swatches + custom hex. Used for both
│   │   │   │                       #   adding new text and editing existing text objects.
│   │   │   └── DrawingSettings.jsx # Color, stroke width, smoothing controls for drawing tool
│   │   │
│   │   ├── PropertiesPanel/
│   │   │   ├── PropertiesPanel.jsx # Right sidebar: numeric property editors, fill/stroke color,
│   │   │   │                       #   outline controls (MS Paint-style width + color), canvas
│   │   │   │                       #   background color + image upload, paint bucket settings,
│   │   │   │                       #   anchor info, shape deformation button, vector detail editor
│   │   │   │                       #   button, image export format toggle (bitmap/vector) with
│   │   │   │                       #   trace presets and side-by-side comparison preview
│   │   │   ├── PathDeformModal.jsx # Vertex/curve editor for deforming shapes. Drag vertices,
│   │   │   │                       #   double-click edges to add Bézier curves, right-click to
│   │   │   │                       #   straighten. Supports undo, reset, and saves deformed
│   │   │   │                       #   path for morph keyframe auto-creation.
│   │   │   └── VectorEditModal.jsx # Zoom-in SVG editor (2×–6×) for shapes and traced images.
│   │   │                           #   Draw freehand or place shapes on top of the zoomed vector.
│   │   │                           #   Additions are baked into SVG markup on save.
│   │   │
│   │   └── CodeExport/
│   │       ├── CodeExportDialog.jsx# Modal showing generated code with copy/download per file.
│   │       │                       #   Shows audio info banner and 4-file download when audio present.
│   │       └── LivePreview.jsx     # GSAP-powered animation preview — supports all shape types,
│   │                               #   paths with embedded fills, images (bitmap + vector), groups,
│   │                               #   z-index animation, color animation, path morphing, outlines,
│   │                               #   background images, audio sync with region mapping.
│   │                               #   Only plays audio when the Live Preview tab is visible.
│   │
│   └── utils/                      # Pure utility functions (no React dependencies)
│       ├── fabricHelpers.js        # Create Fabric objects, extract properties (including fill color),
│       │                           #   find by ID, compound path creation, group/ungroup, anchor
│       │                           #   point logic, custom rotation control rendering
│       ├── interpolation.js        # Keyframe interpolation with easing, rotation normalization,
│       │                           #   z-index step interpolation with global swap points,
│       │                           #   fill color interpolation (RGB lerp), deformed path
│       │                           #   interpolation for shape morphing, z-order canvas reordering
│       ├── easing.js               # Easing function implementations + GSAP name mapping
│       ├── floodFill.js            # Scanline flood fill algorithm for paint bucket tool
│       ├── shapeDefinitions.js     # Single source of truth for all 12 shape types — defines
│       │                           #   SVG paths, default colors, Fabric.js creation functions,
│       │                           #   and render mode (CSS vs SVG)
│       ├── pathUtils.js            # SVG path parsing, segment manipulation, shape-to-path
│       │                           #   conversion, line-to-curve promotion, path string
│       │                           #   interpolation for morphing between keyframes, and
│       │                           #   embeddable interpolation code for exports
│       ├── codeGenerator.js        # Generates HTML, CSS, JS strings from animation state —
│       │                           #   supports all shapes, paths with fills, deformed shapes
│       │                           #   with path morphing, images (bitmap + vector SVG), groups,
│       │                           #   z-index animation, anchor points, canvas background
│       │                           #   color + image, outlines, color animation, audio with
│       │                           #   region trim. Downloads 3 or 4 files depending on audio.
│       ├── imageTracer.js          # Bitmap-to-SVG vectorization wrapper around imagetracerjs.
│       │                           #   5 trace presets (Detailed, Posterized, Sharp, Smooth,
│       │                           #   Minimal). Extracts SVG inner content and creates sized
│       │                           #   SVG strings for embedding in exports.
│       └── audioUtils.js           # Waveform peak extraction using Web Audio API.
│                                   #   Decodes audio on a copy of the ArrayBuffer (original
│                                   #   bytes never touched). Helper for audio file export as
│                                   #   lossless Blob download.
│
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## How to Run Locally

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd "TweenGen"

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev

# 4. Open in browser
# Navigate to http://localhost:5173
```

### Additional Dependency

The image-to-vector conversion feature requires `imagetracerjs`:

```bash
npm install imagetracerjs
```

This is already included in `package.json` if you ran `npm install` after the latest commit.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with hot reload |
| `npm run build` | Produces a production build in the `dist/` folder |

---

## How to Use

### 1. Adding Objects

Use the **left toolbar** to add objects to the canvas:

- **Shape Picker** — click the shapes icon to open a flyout with 12 shape options. Each shows an SVG preview.
- **Text** — opens a rich input dialog where you set text content, font size (8–120px), and color (20 swatches + custom hex picker) with a live preview before adding. Double-click any text object on the canvas to re-open the editor.
- **Image Upload** — opens a file picker to upload any image. Images are auto-scaled and fully animatable.
- **Audio Upload (speaker icon)** — opens a file picker for MP3, WAV, OGG, AAC, M4A, or WebM files. The audio appears as a waveform track at the bottom of the timeline.
- **Drawing Tool (brush icon)** — enters freehand drawing mode. Draw multiple strokes, then press Enter to commit. Press Escape to cancel.
- **Paint Bucket** — MS Paint-style flood fill. Click inside any enclosed region to fill it with color. Press Escape to exit.
- **Duplicate (copy icon)** — creates a copy of the currently selected shape, text, or image, offset 30px from the original. Preserves outlines, deformations, and fills.

### 2. Setting Keyframes

1. Select an object on the canvas.
2. Move the **timeline scrubber** to the desired time.
3. Position/transform the object where you want it at that moment.
4. Click **Add Keyframe** in the playback controls.

Repeat at different times to create motion. The editor automatically interpolates between keyframes.

**Multi-select keyframing:** Select multiple objects, then click "Add Keyframe" to record all of them at once.

**Keyframe All:** Click "Keyframe All" to record every object at the current time.

### 3. Color Animation

Change a shape's fill color in the Properties Panel at different keyframe times. During playback, the color smoothly interpolates between values in RGB space. Works for all solid shapes, SVG shapes, and text in the editor, live preview, and exported code.

### 4. Shape Deformation & Path Morphing

1. Select a solid shape (triangle, star, rectangle, etc.) on the canvas.
2. In the Properties Panel, click **"Deform Shape"**.
3. The shape's outline appears with draggable vertex nodes in the path editor:
   - **Blue circles** — drag to move vertices
   - **Green squares** — double-click to convert a straight edge into a Bézier curve
   - **Orange diamonds** — drag to adjust the curve arc; right-click to convert back to a straight line
4. Click **Save** — the deformed path replaces the original on the canvas.

**Morph keyframes are auto-created:** The first deformation creates a keyframe at time 0 with the original path and a keyframe at the current scrubber time with the deformed path. Press Play to see the shape morph smoothly between them.

**Multi-step morphing:** Move the scrubber to a new time and deform again. Each deformation adds another keyframe, extending the morphing sequence.

### 5. Shape Outlines

Select any solid shape. In the Properties Panel under **"Outline"**, choose a thickness (None, 1px, 3px, 5px, 8px) from the visual selector, then pick an outline color. Outlines appear in the editor, live preview, and exported code.

### 6. Audio / Background Music

Upload an audio file using the **speaker icon** in the toolbar. The audio track appears at the bottom of the timeline with:

- **Waveform visualization** — amplitude bars with a blue-to-purple gradient, red playhead, and dimmed out-of-region areas
- **Trim region handles** — drag the left/right handles to select the audio segment that maps to your animation. Drag the center to slide the region.
- **Sync / Full view toggle** — switch between **Sync view** (trimmed region stretched to fill the timeline width for precise visual alignment) and **Full Audio view** (entire waveform with trim handles and region dragging)
- **"Fit to Duration" button** — auto-sizes the region to match animation length
- **Volume slider, mute toggle, and remove button**

Audio plays in sync with the editor's Play button, Live Preview, and exported code. The time mapping is: `audioTime = region.start + (animationTime / duration) × (region.end - region.start)`.

### 7. Canvas Background Image

When no object is selected, the Properties Panel shows **Canvas Background** settings:

1. Click **"Upload Background Image"** to select an image file.
2. The image scales to cover the full canvas area.
3. A thumbnail preview shows the current background with dimensions and filename.
4. Use **Replace** to swap the image, or the **delete icon** to remove it.

The background image appears in the editor, live preview, and exported code (embedded as CSS `background-image` with `cover` sizing).

### 8. Image Export Format (Bitmap vs Vector)

Select an image object. In the Properties Panel, choose **Bitmap** (base64 `<img>` tag) or **Vector** (traced SVG `<path>` elements). Vector mode offers 5 presets with a side-by-side comparison preview.

### 9. Track Visibility

Hide a track via the eye icon to remove it from both the timeline and the canvas. The object becomes invisible and non-interactive until the track is shown again.

### 10. Exporting

Click **Export Code** to see generated HTML/CSS/JS. When audio is present, downloads 4 files (including the original audio). The exported code includes a click-to-start overlay for browser autoplay policy compliance, and audio sync with GSAP's `onUpdate` callback using the trim region mapping.

---

## How the Export Works

### Color Animation in Exports

When consecutive keyframes have different fill colors, the generator emits a separate `tl.to()` call animating `backgroundColor` (CSS shapes), `color` (text), or `attr.fill` (SVG shapes). GSAP handles RGB interpolation natively.

### Path Morphing in Exports

When a deformed shape has different path strings between keyframes, the generator embeds a standalone `interpolatePaths()` function in the exported JS. Each morphing segment uses a `{ t: 0 }` progress object animated via `tl.to()` with an `onUpdate` callback that interpolates the SVG path string and updates the `<path>` element's `d` attribute each frame. Segment type promotion (L→Q, L→C, Q→C) ensures smooth interpolation even when path commands differ between keyframes.

### Image Export: Bitmap vs Vector

Bitmap mode uses `<img>` with base64 `src`. Vector mode uses `<div>` with `innerHTML` containing `<svg>` with `<path>` elements — real mathematical vector data.

### Background Image in Exports

When a canvas background image is set, it is embedded directly in the exported CSS as a `background-image` on `#animation-container` using the data URL, with `background-size: cover` and `background-position: center`.

### Audio Export Strategy

The audio file is exported as a separate binary file using the original `ArrayBuffer` — no transcoding, no quality loss. The generated JS includes `AUDIO_REGION_START`/`END` constants, an `animToAudioTime()` mapping function, GSAP `onUpdate` drift correction, and `onRepeat`/`onComplete` callbacks.

### Shape Rendering Strategy

CSS-rendered shapes (rectangle, circle, rounded rect, ellipse, text) use styled `<div>` elements. SVG-rendered shapes (triangle, diamond, pentagon, hexagon, star, arrow, heart, cross) use `<div>` wrappers with inline `<svg>` + `<path>`. Deformed shapes use a 0×0 wrapper `<div>` at the object's (x, y) with an SVG that translates by `-pathOffset` — the same positioning approach as freehand paths, avoiding center-point mismatch.

### Coordinate System Translation

```
CSS left = Fabric left - (anchorX × element width)
CSS top  = Fabric top  - (anchorY × element height)
```

### Easing Mapping

| Internal Name | GSAP Equivalent |
|---|---|
| `linear` | `none` |
| `easeInQuad` | `power1.in` |
| `easeOutQuad` | `power1.out` |
| `easeInOutQuad` | `power1.inOut` |
| `easeInCubic` | `power2.in` |
| `easeOutCubic` | `power2.out` |
| `easeInOutCubic` | `power2.inOut` |
| `easeInQuart` | `power3.in` |
| `easeOutQuart` | `power3.out` |
| `easeInOutQuart` | `power3.inOut` |
| `bounce` | `bounce.out` |
| `elastic` | `elastic.out` |

---

## Technical Deep Dives

### State Management with Recoil

Core atoms live in `atoms.jsx`, audio-specific atoms in `audioAtoms.js`:

**Core:** `canvasObjectsState`, `keyframesState`, `currentTimeState`, `fabricCanvasState`, `trackOrderState`, `lockedTracksState`, `hiddenTracksState`, `fillToolActiveState`, `fillToolColorState`, `canvasBgColorState`, `canvasBgImageState`, `anchorEditModeState`

**Audio:** `audioFileState` (dataURL, fileName, mimeType, arrayBuffer, duration), `audioWaveformState` (300 peaks), `audioVolumeState`, `audioMutedState`, `audioRegionState` ({ start, end } or null)

### Interpolation Engine

Linear interpolation with easing for position, scale, rotation, opacity. Shortest-path normalization for rotation. Step interpolation for z-index at a configurable swap point. **RGB channel interpolation** for fill color — each channel is lerped independently, then recombined into hex. **SVG path interpolation** for shape morphing — each segment's coordinates are lerped between keyframes, with automatic type promotion (L→Q→C) when segment commands differ.

### Path Morphing Pipeline

1. **Deformation:** User edits vertices/curves in `PathDeformModal`, producing a new SVG path string.
2. **Keyframe creation:** `PropertiesPanel` auto-creates keyframes with `deformedPath` property — original path at time 0, deformed path at current time.
3. **Playback:** `interpolation.js` calls `interpolatePathStrings()` from `pathUtils.js`, which parses both paths, promotes mismatched segment types, and lerps all coordinates.
4. **Canvas update:** `Canvas.jsx` applies the interpolated path string to the `fabric.Path` object each frame.
5. **Live Preview:** `LivePreview.jsx` uses a `{ t: 0 }` GSAP tween with `onUpdate` to interpolate paths.
6. **Export:** `codeGenerator.js` embeds a standalone `interpolatePaths()` function and generates per-segment morph tweens.

### Audio Waveform Extraction

Web Audio API decodes a copy of the ArrayBuffer (`.slice(0)`) into PCM samples. First channel is divided into 300 blocks, each averaged and normalized to 0–1 for the timeline canvas visualization.

### Audio Trim Region & Time Mapping

```
audioTime = region.start + (animationTime / animationDuration) × (region.end - region.start)
```

Drift correction resyncs audio if it drifts more than 150ms from expected position. The waveform track offers two views: **Full Audio** (entire waveform with draggable trim handles and region sliding) and **Sync** (trimmed region stretched to fill the full timeline width, providing zoomed-in visual alignment with the animation).

### Bitmap-to-Vector Conversion

`imageTracer.js` wraps `imagetracerjs` with 5 presets. Async `traceImageToSVG()` returns full SVG markup. Parsing utilities extract inner content and dimensions for embedding.

### Drawing Tool, Flood Fill, and Shape Definitions

Quadratic Bézier smoothing for freehand drawings, scanline flood fill for the paint bucket tool, and `shapeDefinitions.js` as the single source of truth for all 12 shape types (SVG paths, default colors, Fabric.js creation functions, and render mode).

---

## Known Limitations

- **No global undo/redo** in the main editor. The PathDeformModal and VectorEditModal have local undo within their dialogs, but the main canvas and timeline have no undo system.
- **No project persistence** — refreshing or closing the browser loses all work. There is no save/load mechanism yet.
- **Text editing is dialog-based** — double-clicking a text object opens a dialog overlay rather than editing directly inline on the canvas.
- **Grouped objects** animate as a single unit (no independent child animations).
- **Paint bucket fills** are raster-based (PNG) — may pixelate at large scales.
- **Image export (bitmap mode)** embeds full base64 data URLs in JS, making exports large for high-res images.
- **Audio is a separate file** in exports — must be placed in the same directory as HTML/CSS/JS.
- **Background images** are embedded as base64 data URLs in the exported CSS, which can make the CSS file large for high-resolution images.
- **Vector tracing** works best on images with clear color boundaries. Photographic images produce large SVGs and look heavily stylized.
- **Path morphing** requires both paths to have the same number of segments. If segment counts differ, the shape snaps at the halfway point instead of smoothly interpolating.
- **Vector detail edits on deformed shapes** — further deformations after vector editing won't visually update the added drawings, only the base shape path.

---

## Future Improvements

- Global undo / redo system for the main editor
- Independent child animations within groups
- Save / Load project files (JSON export/import) with auto-save
- Multiple canvases / scenes
- Onion skinning for frame-by-frame animation
- Keyframe curve editor (visual bezier easing)
- Multi-track audio support
- Video export (render to MP4)
- True inline text editing directly on the canvas (currently uses a dialog overlay)
- Timeline snap-to-grid and magnetic keyframe alignment
- Responsive canvas scaling for different viewport sizes

---

## License

This project is licensed under the **MIT License**.

---

## Author

**Ganapathi Raman**
- GitHub: [@GRaman8](https://github.com/GRaman8)
- LinkedIn: [Ganapathi Deivanayagam](https://linkedin.com/in/ganapathi-raman)

---

*Built as a portfolio project demonstrating React architecture, state management, canvas manipulation, animation engines, flood fill algorithms, audio processing, bitmap-to-vector conversion, shape deformation with path morphing, and code generation.*