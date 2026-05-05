# Data DJ

A browser-based CSV scatter plot visualizer with live MIDI controller support. Load a CSV file, assign columns to axes, filter rows, and control the camera and display parameters in real time by turning knobs on a physical MIDI device.
Now deployed on [Github Pages](https://dezeude.github.io/DataDJ/)

---

## Features

- **2D and 3D scatter plots** rendered with Three.js
- **Axis assignment** — map any numeric or categorical CSV column to X, Y, or Z
- **Color mapping** — discrete (rainbow LUT) or continuous (plasma gradient) coloring based on any column
- **Row filtering** — add multiple column/value filter rows that AND together to show/hide points
- **MIDI binding** — bind any knob, slider, or button on a MIDI controller to camera pan, zoom, point size, transparency, or axis/color cycling
- **Legend** — auto-generated discrete or continuous color legend
- **Toast notifications** — lightweight on-screen feedback for every interaction

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- A modern browser with Web MIDI API support (Chrome or Edge; Firefox requires a plugin)

### Install & Run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite (typically `http://localhost:8080`).
---

## Usage

### 1. Load a CSV

Click the file input in the top-left and select a `.csv` file. Every column must be uniformly typed — all numbers or all strings. Mixed-type columns will throw an error.

A Python helper script is included for generating test data:

```bash
python gen_csv.py   # produces points.csv with 100 random (x, y) pairs in [0, 10]
```

### 2. Assign Axes

Use the **X-axis**, **Y-axis**, and **Z-axis** dropdowns in the top-right to pick which columns to plot. The Z-axis selector is hidden until you switch to 3D mode.

### 3. Switch Dimensions

The **2D / 3D** selector swaps between an orthographic camera (2D, pan only) and a perspective camera (3D, full orbit). Switching to 3D reveals the Z-axis dropdown.

### 4. Color Points

The **Color** dropdown colors each point based on the selected column:

- **Categorical / low-cardinality columns** (≤ 10 unique values): discrete rainbow color map with a labeled legend.
- **High-cardinality or numeric columns** (> 10 unique values): continuous plasma gradient with a color bar legend.

Selecting the blank option resets all points to yellow.

### 5. Filter Rows

Click **Filters → + Add Filter** to add a filter row. Each row lets you pick a column and a value; only matching rows are shown. Multiple filters are ANDed together. Deleting a row immediately re-applies the remaining filters.

### 6. Navigate the Plot

In **2D**: click and drag to pan; scroll to zoom.  
In **3D**: click and drag to orbit; scroll to zoom.

Mouse coordinates are projected onto the XY plane and shown in the top-left overlay, along with the current camera frustum bounds. Clicking anywhere shows the world-space coordinate as a toast.

---

## MIDI Control

Data DJ's main differentiator is that almost every UI control can be bound to a physical MIDI input (knob, slider, button, or pad) for hands-free, real-time data exploration — hence the name.

NOTE: In case MIDI inputs are not working on your browser when plugged in, enable/disable the midi flag on your browser. It should look like this for a Chrome-based browser:

Chrome: **chrome://flags/#enable-web-midi**

Edge: **edge://flags/#enable-web-midi**

*Enter one of the links above ^^ in your browser URL bar, then toggle the flag, reload DataDJ page, and try again.*

### How Binding Works

The system uses two controller classes defined in `inputManager.ts`:

#### `BindSelectController`

Binds a MIDI input to a `<select>` element. When triggered, it **rotates** the select's selected option forward or backward.

Used for: filter value selects (each filter row gets one).

**Binding flow:**
1. Click **Bind** → button shows "Press any key..."
2. Touch any control on your MIDI device → that control's first two MIDI bytes (status byte + note/CC number) are stored as the signature.
3. The button shows "Bound".

**Triggering after binding:**
- If the incoming MIDI data's third byte (`velocity/value`) is `0x01`, the select rotates backward.
- If it's `0x41` (65), it rotates forward.
- Any other value also rotates forward (default).

This maps naturally to endless encoder knobs, which send `0x01` and `0x41` for counter-clockwise and clockwise turns.

#### `BindCallbackController`

Binds a MIDI input to an arbitrary callback function. The controller stores only the first two MIDI bytes as its signature (ignoring velocity), so any press/turn of that control fires the callback.

Used for: axis cycle buttons, color cycle button, and all entries in the **Dimensions** dropdown (XMIN, XMAX, YMIN, YMAX, Point Size, Zoom, Alpha).

**Binding flow:** identical to `BindSelectController` above.

**Triggering after binding:**
- Any MIDI message whose first two bytes match the stored signature calls the registered callback with the full `MIDIMessageEvent`.
- The callback reads byte 3 (`event.data[2]`) to determine direction — `0x01` = one direction, `0x41` = the other.

#### Global "only one waiting" rule

Only one controller can be in the "waiting for input" state at a time. If you click **Bind** on a second button while the first is still waiting, the first is automatically cancelled. Clicking anywhere outside a waiting button also cancels it.

### Bindable Parameters

| Control | Type | Effect |
|---|---|---|
| **X-axis cycle** (`🔄` next to X) | `BindCallbackController` | Rotates the X-axis column select |
| **Y-axis cycle** | `BindCallbackController` | Rotates the Y-axis column select |
| **Z-axis cycle** | `BindCallbackController` | Rotates the Z-axis column select |
| **Color cycle** | `BindCallbackController` | Rotates the Color column select |
| **XMIN** (Dimensions dropdown) | `BindCallbackController` | Pans camera left/right |
| **XMAX** | `BindCallbackController` | Pans camera left/right |
| **YMIN** | `BindCallbackController` | Pans camera down/up |
| **YMAX** | `BindCallbackController` | Pans camera down/up |
| **Point Size** | `BindCallbackController` | Increases/decreases point size by 1 |
| **Zoom** | `BindCallbackController` | Adjusts camera zoom by ±0.1 |
| **Alpha** | `BindCallbackController` | Adjusts point transparency by ±0.01 |
| **Filter value selects** | `BindSelectController` | Rotates the value options for that filter |

### MIDI Device Support

The app calls `navigator.requestMIDIAccess()` on load and listens only to the **first** MIDI input port. If your device connects after the page loads, it will be detected via the `onstatechange` handler, but you may need to refresh for the listener to attach to a newly connected port.

MIDI requires browser permission. Chrome will prompt automatically; if permission is denied, an error is thrown on startup.

---

## Project Structure

```
src/
├── main.ts          # Entry point — wires file input, canvas, and MIDI init
├── fileHandler.ts   # Reads the file input, runs PapaParse, calls setupHeader
├── file.ts          # CSV data model — parsedData, colTypes, strColMap, etc.
├── header.ts        # All UI logic — axis selects, filters, color mapping, MIDI bindings
├── render.ts        # Three.js scene — camera, point cloud, color buffers
├── inputManager.ts  # MIDI binding controllers (BindSelectController, BindCallbackController)
├── midi.ts          # Web MIDI API init and event listener registration
├── toast.ts         # Transient on-screen notification messages
├── types.ts         # Shared types (Stack utility class)
└── style.css        # Global styles
```

### Data Flow

```
CSV file
  └─ fileHandler.ts (PapaParse)
       └─ file.ts (parseData)
            ├─ parsedData: Map<colName, Float32Array>   ← raw column values
            ├─ colTypes: Map<colName, "string"|"number">
            ├─ strColMap: Map<colName, Map<value, uniqueId>>
            └─ invertedStrMap: Map<colName, Map<uniqueId, string>>
                 └─ header.ts (setupHeader)
                      └─ render.ts (setXColumn / setYColumn / colorMapRows...)
                           └─ Three.js GPU buffers → canvas
```

String columns are converted to dense integer IDs so they can be stored in `Float32Array` buffers alongside numeric columns. `strColMap` maps string values → IDs; `invertedStrMap` maps IDs → string values (used for legend labels).

---

## Dependencies

| Package | Purpose |
|---|---|
| [three](https://threejs.org/) | 3D rendering (scene, camera, points geometry) |
| [d3](https://d3js.org/) | Color scales, SVG legend, data extent utilities |
| [papaparse](https://www.papaparse.com/) | Fast, robust CSV parsing |
| [vite](https://vitejs.dev/) | Dev server and bundler |
| TypeScript | Type checking |

---

## Known Limitations & TODOs

- Only the **first** MIDI input port is listened to. Multi-device setups are not supported.
- Filters use exact equality matching; range or fuzzy comparisons for numeric columns are not yet implemented.
- Mixed-type columns (some rows numeric, some string) are not allowed and will throw at parse time.
- The Z-axis camera framing in 3D mode is not yet implemented (the auto-fit code is commented out in `render.ts`).
- The `Stack` class in `types.ts` and the `addRandomPoints` / `listInputsAndOutputs` functions in `render.ts` are currently unused scaffolding.
