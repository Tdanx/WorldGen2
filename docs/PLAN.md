# WorldGen2 — Project Plan

## Context
Building a browser-based world generator and god-game simulation from scratch. The user wants to generate living worlds with terrain, biomes, climate, and civilizations — and then interfere with them as a god. The project is a fresh TypeScript + React + Vite web app.

Terrain generation and rendering uses **redblobgames/mapgen4** as the baseline (Delaunay/Voronoi dual mesh, WebGL via regl.js, painting interface, hydraulic simulation). UI is modeled on **Azgaar's Fantasy Map Generator** — dark theme, left layer sidebar, tabbed right panel, top toolbar, bottom time bar.

---

## Tech Stack
| Concern | Choice |
|---|---|
| Framework | TypeScript + React + Vite |
| Terrain Generation | mapgen4 source (dual-mesh, regl.js WebGL, simplex-noise) |
| Rendering | regl.js (WebGL) — from mapgen4 |
| State management | Zustand |
| RNG | mulberry32 (inline seeded PRNG) |
| Simulation loop | requestAnimationFrame; Web Worker via Comlink if perf needed |
| Styling | CSS Modules or TailwindCSS (dark theme, Azgaar-inspired) |

---

## UI Design — Azgaar-Inspired Dark Theme

```
┌─────────────────────────────────────────────────────────────┐
│  [🌍 New] [Save] [Load] [Export]   WorldGen2   [⚙] [?]     │  ← Top Bar
├───────────────┬─────────────────────────────┬───────────────┤
│  LAYERS       │                             │  [Info]       │
│  ☑ Terrain    │                             │  [Civs]       │
│  ☑ Biomes     │       MAP CANVAS            │  [God]        │
│  ☑ Rivers     │       (WebGL/regl)          │  [History]    │
│  ☐ Climate    │                             │               │
│  ☐ Political  │                             │  (tabbed      │
│  ☐ Religion   │                             │   right panel)│
│  ☐ Culture    │                             │               │
├───────────────┴─────────────────────────────┴───────────────┤
│  [|<] [<<] [▶] [>>] [>|]   Year 412 · Iron Age   🕐 1x ──  │  ← Time Bar
└─────────────────────────────────────────────────────────────┘

Color palette:
  Background:  #1a1a2e   Panels:    #16213e
  Accent:      #6c63ff   Text:      #e0e0e0
  Highlight:   #0f3460   Danger:    #e94560
  Water:       #1a4a6e   Land:      biome-driven
```

**Right panel tabs:**
- **Info** — selected tile details (elevation, biome, climate, owner)
- **Civs** — list of civilizations, selected civ detail (species, era, pop, faith)
- **God** — terrain brush, disaster buttons (eruption, meteor, flood, plague, etc.)
- **History** — scrollable chronicle / event log

---

## Folder Structure

```
WorldGen2/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
│
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── types/                          # All shared TS types — no logic
    │   ├── index.ts
    │   ├── world.ts                    # WorldState, WorldConfig, Tile
    │   ├── terrain.ts                  # HeightMap, BiomeType, ClimateData
    │   ├── civilization.ts             # Civilization, Kingdom, Species
    │   ├── religion.ts                 # Faith, HolyWar
    │   ├── politics.ts                 # War, Alliance, Treaty
    │   ├── technology.ts               # TechTree, Era
    │   ├── events.ts                   # WorldEvent, ChronicleEntry
    │   └── simulation.ts               # SimulationConfig, GodCommand
    │
    ├── registries/                     # Runtime dictionaries with change-tracking
    │   ├── BiomeRegistry.ts            # All known biome definitions (static)
    │   ├── SpeciesRegistry.ts          # All known species templates (static + generated)
    │   ├── ReligionRegistry.ts         # Mutable registry — religions born/evolve/die per tick
    │   └── index.ts
    │
    ├── engine/                         # Pure TS — zero React/DOM deps
    │   ├── index.ts
    │   ├── core/
    │   │   ├── WorldEngine.ts          # Orchestrates all subsystems; public API
    │   │   ├── SimulationLoop.ts       # rAF-based tick driver
    │   │   ├── EventBus.ts             # Typed pub/sub between subsystems
    │   │   └── StateHistory.ts         # Ring buffer for undo/replay
    │   ├── terrain/
    │   │   ├── MapGen4Bridge.ts        # Adapts mapgen4's map.ts output to WorldState.tiles
    │   │   ├── TerrainGenerator.ts     # Orchestrates mapgen4 generation from WorldConfig
    │   │   └── RiverCarver.ts          # Supplements mapgen4's river data if needed
    │   ├── climate/
    │   │   ├── ClimateSimulator.ts     # Temp & rainfall per tile (per tick)
    │   │   ├── WindPatterns.ts
    │   │   └── SeasonCycle.ts
    │   ├── civilization/
    │   │   ├── CivilizationEngine.ts
    │   │   ├── SpeciesFactory.ts       # Pulls from SpeciesRegistry to generate variants
    │   │   ├── CivSpawner.ts
    │   │   ├── GrowthModel.ts
    │   │   ├── TechTreeEngine.ts
    │   │   ├── PoliticsEngine.ts
    │   │   ├── DiplomacyEngine.ts
    │   │   ├── ReligionEngine.ts       # Reads/writes ReligionRegistry
    │   │   ├── CultureDiffusion.ts
    │   │   └── EventGenerator.ts
    │   ├── disasters/
    │   │   ├── DisasterEngine.ts
    │   │   ├── VolcanicEruption.ts
    │   │   ├── FloodSimulator.ts
    │   │   ├── MeteorImpact.ts
    │   │   └── DroughtSimulator.ts
    │   └── god/
    │       ├── GodCommandProcessor.ts
    │       └── DivineIntervention.ts
    │
    ├── renderer/                       # mapgen4-based WebGL rendering
    │   ├── index.ts
    │   ├── MapRenderer.ts              # Wraps mapgen4's render.ts; owns <canvas>
    │   ├── Camera.ts                   # Pan, zoom, viewport
    │   ├── layers/
    │   │   ├── LayerManager.ts
    │   │   ├── TerrainLayer.ts         # mapgen4 base render (elevation+biome+rivers)
    │   │   ├── ClimateLayer.ts         # WebGL overlay
    │   │   ├── PoliticalLayer.ts       # Kingdom borders, capitals
    │   │   ├── ReligionLayer.ts        # Faith spread overlay
    │   │   └── EventMarkerLayer.ts     # Disaster/event icons
    │   └── utils/
    │       ├── ColorPalette.ts
    │       └── TileToScreen.ts
    │
    ├── ui/
    │   ├── components/
    │   │   ├── MapCanvas.tsx           # React wrapper for MapRenderer canvas
    │   │   ├── TopBar.tsx              # New/Save/Load/Export + title
    │   │   ├── LayerSidebar.tsx        # Left panel: layer toggles
    │   │   ├── TimeBar.tsx             # Bottom: [|<][<<][▶][>>][>|] + year + speed
    │   │   ├── RightPanel.tsx          # Tabbed container (Info/Civs/God/History)
    │   │   ├── tabs/
    │   │   │   ├── InfoTab.tsx         # Selected tile detail
    │   │   │   ├── CivsTab.tsx         # Civilization list + detail
    │   │   │   ├── GodTab.tsx          # Terrain brush + disaster controls
    │   │   │   └── HistoryTab.tsx      # Event log / chronicle
    │   │   ├── MiniMap.tsx
    │   │   └── WorldGenWizard.tsx      # Initial world config modal (seed, size, etc.)
    │   └── layout/
    │       └── AppShell.tsx            # CSS grid: top/left/center/right/bottom
    │
    ├── store/
    │   ├── useWorldStore.ts            # WorldState snapshot + tick
    │   ├── useSimulationStore.ts       # Speed, paused, activeLayer
    │   ├── useSelectionStore.ts        # Selected tile/civ
    │   └── useGodStore.ts              # Active god tool, brush size
    │
    ├── hooks/
    │   ├── useEngine.ts
    │   ├── useSimulationControls.ts
    │   ├── useGodControls.ts
    │   └── useCanvasInput.ts
    │
    └── utils/
        ├── serialization.ts
        ├── rng.ts                      # mulberry32
        ├── math.ts
        └── constants.ts
```

---

## Registries

### BiomeRegistry (static dictionary)
```typescript
// registries/BiomeRegistry.ts
interface BiomeDef {
  id: BiomeType;
  name: string;
  color: string;               // hex, for map rendering
  habitability: number;        // 0–1, how suitable for civilization
  fertility: number;           // affects food production
  movementCost: number;        // affects expansion speed
  allowedElevation: [min: number, max: number];
}

const BIOME_REGISTRY: Record<BiomeType, BiomeDef> = {
  [BiomeType.Grassland]: { name: 'Grassland', color: '#91c46c', habitability: 0.9, ... },
  [BiomeType.Desert]:    { name: 'Desert',    color: '#e8d5a3', habitability: 0.2, ... },
  // ... all biomes
};
```

### SpeciesRegistry (static templates + runtime variants)
```typescript
// registries/SpeciesRegistry.ts
interface SpeciesDef {
  id: SpeciesId;
  name: string;
  traits: SpeciesTraits;
  preferredBiomes: BiomeType[];
  description: string;
}

class SpeciesRegistry {
  private entries: Map<SpeciesId, SpeciesDef>;
  register(def: SpeciesDef): void;    // add generated species at runtime
  get(id: SpeciesId): SpeciesDef;
  getAll(): SpeciesDef[];
}
// Pre-loaded with default templates; SpeciesFactory adds generated variants at world-gen time
```

### ReligionRegistry (mutable, changes over time)
```typescript
// registries/ReligionRegistry.ts
interface FaithDef {
  id: ReligionId;
  name: string;
  founderCivId: CivId;
  foundedTick: number;
  tenets: ReligiousTenet[];           // affects civ behavior
  splitFrom: ReligionId | null;       // for schisms
  extinctTick: number | null;         // set when last follower civ is gone
  color: string;
  followerCivIds: Set<CivId>;
}

class ReligionRegistry {
  private entries: Map<ReligionId, FaithDef>;
  found(def: Omit<FaithDef, 'id'>): ReligionId;   // called by ReligionEngine
  schism(parentId: ReligionId, schismTick: number): ReligionId;
  extinguish(id: ReligionId, tick: number): void;
  getActive(): FaithDef[];            // religions with at least 1 follower
  getAll(): FaithDef[];               // including extinct (for history)
  get(id: ReligionId): FaithDef;
}
```

---

## Key Data Models

### WorldState (immutable snapshot, JSON-serializable)
```typescript
interface WorldState {
  config: WorldConfig;
  tick: number;                                    // in-game year
  tiles: ReadonlyArray<Tile>;                      // flat: index = y*width + x
  civilizations: ReadonlyMap<CivId, Civilization>;
  wars: ReadonlyArray<War>;
  alliances: ReadonlyArray<Alliance>;
  chronicle: ReadonlyArray<ChronicleEntry>;
  climate: ClimateSnapshot;
  // Registries are NOT in WorldState — they are singletons owned by WorldEngine
  // (serialized separately on save/load)
}
```

### Tile
```typescript
interface Tile {
  index: TileIndex; x: number; y: number;
  elevation: number;   // 0–1
  moisture: number;    // 0–1
  temperature: number; // -1–1
  biome: BiomeType;
  isWater: boolean; isRiver: boolean;
  riverFlow: FlowDirection | null;
  ownerId: CivId | null;
  religionId: ReligionId | null;
}
```

### GodCommand (discriminated union — undoable, replayable)
```typescript
type GodCommand =
  | { type: 'RAISE_TERRAIN';      tiles: TileIndex[]; amount: number }
  | { type: 'LOWER_TERRAIN';      tiles: TileIndex[]; amount: number }
  | { type: 'SET_BIOME';          tiles: TileIndex[]; biome: BiomeType }
  | { type: 'VOLCANIC_ERUPTION';  epicenter: TileIndex; magnitude: number }
  | { type: 'METEOR_IMPACT';      epicenter: TileIndex; radius: number }
  | { type: 'FLOOD';              region: TileIndex[]; severity: number }
  | { type: 'DROUGHT';            region: TileIndex[]; duration: number }
  | { type: 'FORCE_WAR';          aggressor: CivId; defender: CivId }
  | { type: 'PLAGUE';             targetCiv: CivId; severity: number }
  | { type: 'DIVINE_BLESSING';    targetCiv: CivId; boost: BlessingType }
  | { type: 'SPAWN_CIVILIZATION'; tile: TileIndex; speciesId: SpeciesId }
```

---

## Architecture Principles

**Data flow is strictly unidirectional:**
```
WorldConfig → WorldEngine.generate() → WorldState
                                            ↓
                              MapRenderer (canvas, imperative — never via React)
                              Zustand stores → React panels
                                            ↓
                              GodCommand / SimControl
                                            ↓
                              WorldEngine.applyCommand() / tick()
```

- **Engine** owns `WorldState` and all registries. React never mutates them directly.
- **Renderer** subscribes to `engine.onTick()` imperatively. No React re-renders for canvas.
- **Registries** are singleton objects owned by `WorldEngine`. `ReligionRegistry` mutates in-place per tick; `BiomeRegistry` and `SpeciesRegistry` are effectively static after world-gen.
- **Simulation tick** = pure function: `(WorldState, TickContext) → WorldState`. Deterministic.
- **God commands** = command objects → undo, replay, future multiplayer.
- **EventBus** decouples subsystems internally.

### mapgen4 Integration Strategy
mapgen4 is not an npm package. Integration approach:
1. Copy `map.ts`, `dual-mesh/`, `worker.ts`, `painting.ts` from mapgen4 source into `src/engine/terrain/mapgen4/`
2. `MapGen4Bridge.ts` translates mapgen4's mesh output (Voronoi regions) into our flat `Tile[]` array
3. `TerrainGenerator.ts` calls mapgen4 generation then immediately converts via the bridge
4. Renderer similarly wraps mapgen4's `render.ts` inside `MapRenderer.ts` — keeping our layer system on top

---

## Implementation Phases

### Phase 1 — Scaffold + Terrain (mapgen4 Integration)
**Goal:** Project runs; generate a world and display it via mapgen4's renderer.

**Deliverable:** Click "Generate World" → mapgen4-quality terrain map renders in the browser with biomes, rivers, and 2.5D elevation shading. Pan and zoom work.

---

#### Step 1.1 — Project Scaffold

```bash
npm create vite@latest WorldGen2 -- --template react-ts
cd WorldGen2
```

Install dependencies:
```bash
npm install zustand delaunator simplex-noise gl-matrix flatqueue fast-2d-poisson-disk-sampling
npm install regl
```

> **Note:** `@redblobgames/prng` is a GitHub-only package. Options:
> - `npm install github:redblobgames/prng` — or —
> - Inline a mulberry32 PRNG in `src/utils/rng.ts` (simpler, recommended)

Configure `vite.config.ts` for ES module workers:
```typescript
export default defineConfig({
  worker: { format: 'es' },
  plugins: [react()],
})
```

Create the full folder structure as defined in the Folder Structure section above (empty files/folders).

---

#### Step 1.2 — Copy mapgen4 Source

Clone mapgen4 (Apache 2.0 license):
```bash
git clone https://github.com/redblobgames/mapgen4.git /tmp/mapgen4
```

Copy these files into `src/engine/terrain/mapgen4/`:
```
map.ts          — terrain generation algorithms (elevation, rainfall, rivers)
render.ts       — WebGL2 multi-pass renderer
worker.ts       — Web Worker: runs elevation/rainfall/river compute off main thread
painting.ts     — terrain painting constraints (user brush input)
types.d.ts      — Mesh type extending TriangleMesh
config.js       — default parameter values (spacing, mountainSpacing, etc.)
dual-mesh/      — entire folder (TriangleMesh class, Voronoi/Delaunay navigation)
```

Copy the pre-computed point distribution binary files to `public/mapgen4/`:
```
build/points-2.data
build/points-3.data
build/points-5.5.data   ← default spacing used at ~25k cells
build/points-9.data
```
These are Poisson-disk sampled point sets. Without them the mesh cannot be constructed.

**Key Vite compatibility fix in `worker.ts`:**

mapgen4 original:
```typescript
const worker = new Worker("build/_worker.js");
```

Must change to (Vite-compatible):
```typescript
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
```

**Key fix in points file fetch path** (wherever mapgen4 fetches points):

mapgen4 original:
```typescript
fetch(`build/points-${spacing}.data`)
```

Change to:
```typescript
fetch(`/mapgen4/points-${spacing}.data`)
```

---

#### Step 1.3 — Define All TypeScript Types

Create all files in `src/types/` with their interfaces:

**`src/types/terrain.ts`** — BiomeType enum (all biomes), FlowDirection enum, ClimateData
**`src/types/world.ts`** — WorldConfig, WorldState, Tile, TileIndex
**`src/types/civilization.ts`** — Civilization skeleton (just id/name/territory for Phase 1)
**`src/types/events.ts`** — ChronicleEntry, EventType skeleton
**`src/types/simulation.ts`** — GodCommand discriminated union (stub for Phase 1)
**`src/types/index.ts`** — re-exports all of the above

> **Important architectural note:** mapgen4 uses a **dual Voronoi/Delaunay mesh**, not a flat grid. Each **region** (Voronoi cell) in the mesh corresponds to one `Tile` in our system. `TileIndex = number` is a region index (0 to `mesh.numSolidRegions`). The `Tile[]` array is indexed by region ID — not by `y * width + x`.

---

#### Step 1.4 — Implement Utilities

**`src/utils/rng.ts`** — mulberry32 seeded PRNG:
```typescript
export function mulberry32(seed: number) {
  return function(): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

**`src/utils/math.ts`** — clamp, lerp, vec2 helpers, remapRange

**`src/utils/constants.ts`** — default world params (spacing=5.5, sea level=0.5, etc.), biome thresholds

---

#### Step 1.5 — Implement BiomeRegistry

**`src/registries/BiomeRegistry.ts`** — all biome definitions:

```typescript
const BIOME_REGISTRY: Record<BiomeType, BiomeDef> = {
  [BiomeType.DeepOcean]:          { color: '#1a3a6e', habitability: 0,    fertility: 0,   movementCost: 999 },
  [BiomeType.ShallowSea]:         { color: '#2a5a9e', habitability: 0,    fertility: 0,   movementCost: 5   },
  [BiomeType.Beach]:              { color: '#e8d5a3', habitability: 0.3,  fertility: 0.1, movementCost: 1.2 },
  [BiomeType.Desert]:             { color: '#d9a84b', habitability: 0.2,  fertility: 0.05,movementCost: 1.5 },
  [BiomeType.Savanna]:            { color: '#c8b560', habitability: 0.6,  fertility: 0.4, movementCost: 1.0 },
  [BiomeType.TropicalRainforest]: { color: '#2d6a2d', habitability: 0.5,  fertility: 0.8, movementCost: 2.0 },
  [BiomeType.Grassland]:          { color: '#91c46c', habitability: 0.9,  fertility: 0.7, movementCost: 1.0 },
  [BiomeType.TemperateForest]:    { color: '#4a7c4a', habitability: 0.7,  fertility: 0.6, movementCost: 1.5 },
  [BiomeType.BorealForest]:       { color: '#2e5e2e', habitability: 0.4,  fertility: 0.3, movementCost: 1.8 },
  [BiomeType.Tundra]:             { color: '#8fada8', habitability: 0.15, fertility: 0.1, movementCost: 1.8 },
  [BiomeType.Snow]:               { color: '#ddeeff', habitability: 0.05, fertility: 0,   movementCost: 2.5 },
  [BiomeType.Mountain]:           { color: '#8a8a8a', habitability: 0.1,  fertility: 0,   movementCost: 3.0 },
  [BiomeType.Volcano]:            { color: '#5a1a00', habitability: 0,    fertility: 0,   movementCost: 999 },
};
```

Biome assignment logic (Whittaker diagram) will be in `MapGen4Bridge.ts` — elevation + humidity → biome lookup.

---

#### Step 1.6 — Implement MapGen4Bridge

**`src/engine/terrain/MapGen4Bridge.ts`** — the most critical Phase 1 file.

Converts mapgen4's dual-mesh output into our `Tile[]` array:

```typescript
export function bridgeMapGen4ToTiles(mesh: Mesh, map: Map): Tile[] {
  const tiles: Tile[] = [];

  for (let r = 0; r < mesh.numSolidRegions; r++) {
    const elevation = map.elevation_r[r];   // Float32Array
    const moisture  = map.humidity_r[r];    // Float32Array (humidity = moisture proxy)
    const rainfall  = map.rainfall_r[r];    // Float32Array

    const isWater = elevation < SEA_LEVEL;
    const temperature = computeTemperature(mesh.y_of_r(r), elevation);
    const biome = assignBiome(elevation, moisture, temperature);

    // River detection: check if any adjacent side has significant flow
    const isRiver = isRiverRegion(r, mesh, map);

    tiles.push({
      index: r,
      x: mesh.x_of_r(r),
      y: mesh.y_of_r(r),
      elevation,
      moisture,
      temperature,
      biome,
      isWater,
      isRiver,
      riverFlow: null,   // derived from mesh sides in Phase 2
      ownerId: null,
      religionId: null,
    });
  }
  return tiles;
}
```

`assignBiome()` implements the Whittaker biome diagram using elevation + moisture + temperature thresholds, referencing `BiomeRegistry` for colors.

---

#### Step 1.7 — Implement TerrainGenerator

**`src/engine/terrain/TerrainGenerator.ts`** — orchestrates the full mapgen4 generation pipeline:

```typescript
export class TerrainGenerator {
  async generate(config: WorldConfig): Promise<{ tiles: Tile[]; mesh: Mesh; map: Map }> {
    // 1. Fetch pre-computed points binary from /mapgen4/points-{spacing}.data
    // 2. Build TriangleMesh via Delaunator
    // 3. Extend to Mesh (add is_boundary_t, length_s)
    // 4. Select t_peaks (mountain peak triangle indices) using seeded RNG
    // 5. Instantiate Map(mesh, t_peaks, defaultParam)
    // 6. Call map.assignElevation(elevationParam, constraints)
    // 7. Call map.assignRainfall(biomesParam)
    // 8. Call map.assignRivers(riversParam)
    // 9. Call map.assignRegionElevation()
    // 10. Bridge to Tile[] via MapGen4Bridge
    // Returns { tiles, mesh, map } — mesh and map kept for renderer
  }
}
```

For Phase 1, the heavy worker computation runs inline (synchronously). Worker offload is Phase 5 optimization.

---

#### Step 1.8 — Implement MapRenderer

**`src/renderer/MapRenderer.ts`** — wraps mapgen4's `Renderer` class:

```typescript
export class MapRenderer {
  private renderer: Renderer;   // mapgen4's WebGL renderer
  private mesh: Mesh;
  private camera: Camera;
  private layerManager: LayerManager;

  constructor(canvas: HTMLCanvasElement) {
    // mapgen4's Renderer takes the mesh — set after generation
  }

  initialize(mesh: Mesh, map: Map): void {
    this.renderer = new Renderer(mesh);
    // Upload initial buffers from map data
    this.renderer.updateView(defaultRenderParam);
    this.renderer.updateMap();
  }

  render(state: WorldState, activeLayer: LayerType): void {
    this.renderer.updateView({ ...cameraToRenderParam(this.camera) });
    this.layerManager.render(state, activeLayer);
  }

  screenToTile(x: number, y: number): TileIndex | null {
    const [wx, wy] = this.renderer.screenToWorld([x, y]);
    // Find nearest region centroid to (wx, wy) using mesh
  }
}
```

**`src/renderer/Camera.ts`** — pan/zoom state:
- `pan(dx, dy)` — translate viewport
- `zoom(factor, pivotX, pivotY)` — zoom toward cursor
- `toRenderParam()` — returns `{ zoom, x, y, tilt_deg, rotate_deg }` for mapgen4's `updateView()`

**`src/renderer/layers/LayerManager.ts`** — for Phase 1, only `TerrainLayer` is active. Layer toggles from the UI sidebar map to this.

---

#### Step 1.9 — Build React UI Shell

**`src/ui/layout/AppShell.tsx`** — CSS Grid layout:
```css
grid-template:
  "topbar  topbar  topbar"  48px
  "sidebar canvas  panel"   1fr
  "timebar timebar timebar" 48px
  / 200px  1fr     280px;
```

**`src/ui/components/TopBar.tsx`** — [New] [Save] [Load] [Export] buttons + title. For Phase 1, only [New] triggers the WorldGenWizard.

**`src/ui/components/LayerSidebar.tsx`** — Phase 1 has only Terrain and Biome toggles. Other layers are greyed out with a "Phase N" badge.

**`src/ui/components/WorldGenWizard.tsx`** — Modal with:
- Seed input (text field, with "Randomize" button)
- World size selector (Small=15k cells / Medium=25k / Large=50k → maps to spacing param)
- Sea level slider (0.3–0.7)
- [Generate World] button → calls engine, closes modal, renders map

**`src/ui/components/MapCanvas.tsx`**:
```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
useEffect(() => {
  const renderer = new MapRenderer(canvasRef.current!);
  rendererRef.current = renderer;
  engine.onTick(state => renderer.render(state, activeLayer));
}, []);
```
Canvas fills its grid cell; `renderer.resizeCanvas()` on window resize.

**`src/ui/components/TimeBar.tsx`** — Phase 1: [▶] and [⏸] only. Speed slider, year display are stubs showing "—".

---

#### Step 1.10 — Wire Zustand Store

**`src/store/useWorldStore.ts`**:
```typescript
interface WorldStore {
  worldState: WorldState | null;
  isGenerating: boolean;
  setWorldState: (s: WorldState) => void;
  setGenerating: (b: boolean) => void;
}
```

**`src/store/useSimulationStore.ts`**:
```typescript
interface SimStore {
  activeLayer: LayerType;
  setActiveLayer: (l: LayerType) => void;
}
```

Engine instance lives as a module-level singleton (not in React state — engines are not serializable).

---

#### Step 1.11 — End-to-End Wiring

Connect everything in `src/main.tsx` and `src/App.tsx`:

1. App loads → WorldGenWizard opens automatically (no world yet)
2. User sets seed + size → clicks Generate
3. `TerrainGenerator.generate(config)` runs → produces `WorldState` with `tiles[]`
4. `useWorldStore.setWorldState(state)` fires
5. `MapRenderer.initialize(mesh, map)` mounts to canvas
6. Map renders via mapgen4's WebGL pipeline
7. Pan/zoom via mouse events on canvas
8. Layer sidebar toggles update `useSimulationStore.activeLayer`

---

#### Step 1.12 — Verification Checklist

- [ ] `npm run dev` starts without errors
- [ ] WorldGenWizard opens on load
- [ ] Entering seed "12345" + Medium size → Generate → map appears within 2 seconds
- [ ] Map shows distinct biome colors (ocean blue, grassland green, desert tan, mountain grey)
- [ ] Rivers are visible as darker carved lines
- [ ] Elevation shading gives mountains a 2.5D raised appearance
- [ ] Mouse drag pans the map
- [ ] Scroll wheel zooms toward cursor
- [ ] Toggling "Biome" layer in sidebar changes map coloring
- [ ] Different seeds produce visually different worlds
- [ ] WebGL2 unavailable fallback message shown on unsupported browsers

### Phase 2 — Living Civilizations
**Goal:** Species and civs spawn, grow, and spread.
1. Implement `SpeciesRegistry.ts` (built-in species templates)
2. Implement `SpeciesFactory.ts`, `CivSpawner.ts`
3. Implement `GrowthModel.ts`, `TechTreeEngine.ts`
4. Implement `SimulationLoop.ts`, `EventBus.ts`, `EventGenerator.ts`
5. Implement `PoliticalLayer.ts`, `TimeBar.tsx`
6. Implement `RightPanel.tsx` with `InfoTab.tsx`, `CivsTab.tsx`, `HistoryTab.tsx`

**Deliverable:** Civilizations visibly expand and log events over simulated centuries.

### Phase 3 — Politics, Religion & God Tools
**Goal:** Wars, diplomacy, faith, and basic god intervention.
1. Implement `PoliticsEngine.ts`, `DiplomacyEngine.ts`
2. Implement `ReligionRegistry.ts` + `ReligionEngine.ts` + `CultureDiffusion.ts`
3. Add `ReligionLayer.ts`
4. Implement `GodCommandProcessor.ts` + terrain editing commands
5. Implement `GodTab.tsx`, `useGodStore.ts`, `useGodControls.ts`

### Phase 4 — Disasters
**Goal:** Full divine intervention toolkit.
1. All disaster modules (`VolcanicEruption`, `MeteorImpact`, `FloodSimulator`, `DroughtSimulator`)
2. `DivineIntervention.ts` (forced wars, plagues, famines, blessings)
3. `EventMarkerLayer.ts` — visual feedback on map
4. Complete `GodTab.tsx` with all tool buttons

### Phase 5 — Advanced Simulation & Polish
1. `ClimateSimulator.ts` with seasonal cycles + `ClimateLayer.ts`
2. `TectonicSimulator.ts` + `ErosionSimulator.ts` (volcanic activity, erosion over time)
3. `StateHistory.ts` (undo/time replay)
4. Full `serialization.ts` — save/load world + all registries to JSON
5. Web Worker migration via Comlink if tick computation becomes expensive

---

---

## Civilization Interaction Model

### Open Source Baselines
| Source | What We Borrow |
|---|---|
| **Freeciv** (GPL 2.0, C + Lua) | Diplomatic pact system, war trigger heuristics, opinion ledger, vassal/tribute mechanics, territory transfer on war outcome |
| **Lanchester's Laws** (academic) | Per-tick attrition formulas (Square Law for tech≥3, Linear Law for ancient era), terrain combat modifiers |
| **Correlates of War** (public domain data) | Historical conflict trigger patterns: border contiguity, power transition, grievance windows, alliance cascades |

These are reference/inspiration sources — no code is copied. All logic is implemented in TypeScript from first principles.

---

### New Types Required

**`src/types/conflict.ts`**
```typescript
type WarCause = 'border_tension' | 'holy_war' | 'resource_scarcity'
              | 'grievance' | 'power_imbalance' | 'god_command' | 'treaty_violation';

interface WarPressureRecord {
  aggressor: CivId; target: CivId;
  totalPressure: number;        // 0–100; WAR_THRESHOLD = 65
  components: {
    borderTension: number;      // 0–20
    religiousConflict: number;  // 0–20
    resourceScarcity: number;   // 0–20
    grievance: number;          // 0–20
    powerImbalance: number;     // 0–20
  };
}

interface WarState {
  id: string; aggressorId: CivId; defenderId: CivId;
  declaredTick: number; endedTick?: number;
  cause: WarCause; warScore: number;  // -100 to +100
  casualties: { aggressor: number; defender: number };
  contestedTiles: TileIndex[];
  outcome?: 'white_peace' | 'aggressor_wins' | 'defender_wins' | 'vassalage' | 'annihilation';
}

interface BattleResult {
  warId: string; tick: number;
  aggressorLosses: number; defenderLosses: number;
  terrainModifier: number; warScoreDelta: number;
  contestedTileWon?: TileIndex;
}
```

**`src/types/diplomacy.ts`**
```typescript
type DiplomaticStatus = 'peace' | 'cold_war' | 'war' | 'alliance' | 'vassal' | 'overlord';
type TreatyType = 'non_aggression_pact' | 'trade_agreement' | 'military_alliance'
                | 'defensive_pact' | 'tribute_obligation' | 'border_agreement';

interface DiplomaticPact {
  id: string; typeOf: TreatyType; civA: CivId; civB: CivId;
  formedTick: number; expiryTick?: number;
  terms: { annualTribute?: number; militaryAccess: boolean; tradeBenefit: number };
  violated: boolean; violatedBy?: CivId;
}

interface OpinionRecord {
  civA: CivId; civB: CivId;
  score: number;          // -100 to +100
  modifiers: { source: string; value: number; expiryTick: number }[];
}
// DiplomacyMatrix keyed as `${civA}:${civB}` (civA < civB lexicographically)
type DiplomacyMatrix = Map<string, { status: DiplomaticStatus; opinion: OpinionRecord; pacts: DiplomaticPact[] }>;
```

**`src/types/civilization.ts`** — extended with lifecycle and military
```typescript
type CivLifecyclePhase = 'founding' | 'growth' | 'peak' | 'decline' | 'collapse' | 'extinct';
type InstabilityFlag = 'overstretched_borders' | 'famine' | 'succession_crisis'
                     | 'military_defeat' | 'religious_schism' | 'economic_collapse' | 'plague';

interface MilitaryStrength {
  baseStrength: number;     // population * techMultiplier * eraMod
  morale: number;           // 0–1, degrades during losing wars
  supplyLine: number;       // 0–1, degrades with overstretched territory
  effectiveStrength: number; // baseStrength * morale * supplyLine
}

interface CivLifecycleState {
  phase: CivLifecyclePhase; phaseEnteredTick: number;
  stabilityScore: number;   // 0–100; below 20 = collapse risk
  instabilityFlags: InstabilityFlag[];
  collapseRisk: number;     // 0–1, recomputed each tick
}
```

---

### Conflict Initiation — War Pressure Model (from Freeciv + CoW)

Each ordered civ-pair `(A → B)` carries a `WarPressureRecord`. Five additive components, each capped at 20pts. War declared when `totalPressure ≥ 65`.

| Component | Formula | Notes |
|---|---|---|
| **Border Tension** | `sharedBorderTiles × 0.5 × A.expansion × techRatio` | Freeciv: border adjacency + expansion trait |
| **Religious Conflict** | `A.piety × 20` if religions hostile; `-10` if same faith | ReligionEngine exposes `areHostile(rA, rB)` |
| **Resource Scarcity** | `GrowthModel.getScarcityIndex(A) × 20 × A.aggression` | Spikes during famine (>0.7 = nearly instant war push) |
| **Grievance** | `accumulatedGrievance × 0.2` | Decays 2pts/tick of peace; from broken pacts, prior losses |
| **Power Imbalance** | `(strengthRatio − 2.0) × 5 × A.aggression` if ratio > 2:1 | CoW preponderance theory: strong bullies weak |

**Moderators** (reduce pressure): active NAP (`×0.5`), alliance (`= 0`), opinion > 50 (`×0.6`).

`WarCause` = whichever component is highest at declaration → written to `ChronicleEntry`.

---

### Battle Resolution — Lanchester Attrition

Per active war, one `BattleResult` computed each tick:

```
// Era-gated law selection (Freeciv/Lanchester hybrid)
if avgTechLevel < 3:  losses = ATTRITION_RATE × enemyStrength × 0.3  (Linear Law, ancient)
if avgTechLevel ≥ 3:  losses = ATTRITION_RATE × enemyStrength         (Square Law, ranged)

// Terrain modifier (defender advantage in forest/mountain; attacker on plains)
Terrain:  plains=1.2, coast=1.1, forest=0.8, hills=0.75, mountains=0.6

// Morale modifier — low morale amplifies losses
aggressorLosses *= (2 − A.morale)

// War score delta → territory capture at ±60, outcome check at ±80
```

**War outcomes:** `white_peace` (20-tick stalemate), `aggressor_wins` (territory + reparations), `defender_wins` (aggressor pays), `vassalage` (score ≥60 + defender stability < 20), `annihilation` (population → 0).

---

### Diplomacy — Opinion Scoring & Treaty Formation

**Opinion modifiers (time-decaying, from Freeciv ledger):**

| Source | Value | Duration |
|---|---|---|
| Shared religion | +15 | permanent |
| Trade agreement active | +10 | while active |
| Military alliance | +25 | while active |
| Broken pact | −30 | 20 ticks |
| Won war vs. them | −20 | 30 ticks |
| Hostile religion | −12 | permanent |
| Atrocity (city razed) | −40 | 50 ticks |

**Treaty formation** (evaluated every 5 ticks):
- NAP: opinion ≥ −10 AND shared enemy OR war pressure > 30
- Trade Agreement: opinion ≥ 20 AND both civs solvent
- Defensive Pact: opinion ≥ 40 AND shared military threat
- Military Alliance: opinion ≥ 60 AND common war enemy

**Status transitions:**
```
peace → cold_war → war → peace/white_peace
peace → alliance (via military_alliance pact)
war → vassal (via vassalage outcome)
vassal → peace (via stability recovery + military win)
```

---

### Civilization Lifecycle — Rise, Peak, Decline, Collapse

**Phase state machine:**
```
founding → growth:   pop > 500 AND territory > 5 tiles
growth   → peak:     stability > 70 AND tech ≥ 3 AND 10+ ticks in growth
peak     → decline:  collapseRisk > 0.4 for 3 consecutive ticks
decline  → collapse: stability < 20 OR collapseRisk > 0.8
collapse → extinct:  population ≤ 0 OR all territory absorbed
collapse → growth:   (rare recovery) stability > 50 AND military victory
```

**Collapse risk factors:** overstretched territory + recent casualty rate + scarcity index + active `InstabilityFlag[]` — all moderated by `species.resilience`.

**Fragmentation on collapse:** if territory > 8 tiles AND population > 200, spawn 2+ successor civilizations carrying the parent's species traits and a fraction of territory. Remaining tiles become unclaimed and absorbed by neighbours over subsequent ticks.

**Succession crisis:** random event (2% chance/tick at peak, 8% at decline) that adds `succession_crisis` flag, drops stability −20, and is logged as a major `ChronicleEntry`.

---

### Tick Loop Order (inside `WorldEngine.tick()`)

```
1. GodCommandProcessor.processCommands()    // external overrides first
2. GrowthModel.tick()                       // population + resource update
3. ReligionEngine.tick()                    // spread, schisms, holy war flags
4. CivilizationInteractionEngine.tick()
     a. Update lifecycle state + collapseRisk for all civs
     b. Update opinion scores (decay modifiers)
     c. Evaluate treaty formation (every 5 ticks)
     d. Check treaty violations
     e. Compute WarPressure for all civ-pairs
     f. Declare wars for pairs crossing threshold
     g. Resolve active wars (Lanchester attrition + territory capture)
     h. Apply war outcomes for concluded wars
     i. Handle collapse + fragmentation + extinction
5. EventGenerator.flushQueue()              // emit all queued ChronicleEntries
```

---

### New Files Added to Folder Structure

```
src/types/
  conflict.ts         ← WarState, WarPressureRecord, BattleResult, WarCause, WarOutcome
  diplomacy.ts        ← DiplomaticPact, OpinionRecord, DiplomacyMatrix, TreatyType

src/engine/civilization/
  CivilizationInteractionEngine.ts  ← PRIMARY: war pressure, Lanchester, treaties, lifecycle
  DiplomacyEngine.ts                ← opinion update, treaty CRUD, status transitions
  PoliticsEngine.ts                 ← declareWar(), endWar(), applyWarOutcome()
```

All existing files in the folder structure remain unchanged. The `CivilizationEngine.ts` (coordinator) now calls `CivilizationInteractionEngine.ts` as one of its subsystems.

---

## Critical Files
- `src/engine/terrain/mapgen4/` — copied mapgen4 source (map.ts, dual-mesh/, painting.ts, render.ts, worker.ts)
- `src/engine/terrain/MapGen4Bridge.ts` — translates Voronoi mesh → flat Tile[]
- `src/engine/core/WorldEngine.ts` — central orchestrator, public API, owns tick loop order
- `src/types/world.ts` — WorldState, WorldConfig, Tile (shared contract for all modules)
- `src/types/conflict.ts` — WarState, WarPressureRecord, BattleResult (foundation for all conflict logic)
- `src/types/diplomacy.ts` — DiplomacyMatrix, DiplomaticPact, OpinionRecord
- `src/types/civilization.ts` — Civilization, CivLifecycleState, MilitaryStrength, InstabilityFlag
- `src/engine/civilization/CivilizationInteractionEngine.ts` — all five algorithms: war pressure, Lanchester attrition, treaty formation, opinion scoring, lifecycle/collapse
- `src/engine/civilization/DiplomacyEngine.ts` — encapsulates DiplomacyMatrix mutations
- `src/registries/BiomeRegistry.ts` — biome definitions used by generation and rendering
- `src/registries/ReligionRegistry.ts` — mutable registry reflecting living religious history
- `src/renderer/MapRenderer.ts` — wraps mapgen4 render.ts, adds layer system
- `src/store/useWorldStore.ts` — Zustand bridge between engine and React

---

## First Action on Implementation Start
Copy this plan to the project repository as `docs/PLAN.md` so it lives alongside the code and can be referenced and updated as development progresses.

---

## Verification

- **Phase 1:** Open app → WorldGenWizard → Generate → mapgen4-quality map with biomes, rivers, pan/zoom
- **Phase 2:** Press Play → civilization borders spread → EventLog fills with chronicle entries (founded, expanded, tech advanced)
- **Phase 3:** Watch war pressure build between border civs → war declared → Lanchester attrition plays out → winner gains territory → peace treaty forms → chronicle records full narrative
- **Phase 3:** Religion spawns → spreads → holy war declared → war pressure logs `holy_war` cause
- **Phase 3:** God panel forces war via `FORCE_WAR` command → war pressure bypassed, instant declaration
- **Phase 4:** Volcanic Eruption → crater on map → nearby civ gets `famine` flag → collapse risk spikes → civ fragments into successors
- **Phase 5:** Save → reload → load JSON → identical world (same seed, same registries, same war history) resumes at same tick
