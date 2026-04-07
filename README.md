# Hand3DModel

A 3D hand rehabilitation visualization tool built for physical therapy assessment. It renders an interactive 3D hand model that displays joint range of motion (ROM), color-codes joints by recovery severity, and supports side-by-side comparison between affected and unaffected hands.

Built as a thesis project to assist therapists and patients in tracking hand rehabilitation progress.

## Features

- **Interactive 3D Hand Model** — Navigate from whole-hand view down to individual finger and joint views by clicking
- **Range of Motion Visualization** — Auto-rotates joints to demonstrate their current ROM based on patient data
- **Severity Color Coding** — Joints are colored by recovery status:
  - Red: Serious (&lt; 25% ROM)
  - Yellow: Medium (25–75% ROM)
  - Green: Light (&gt; 75% ROM)
- **Hand Comparison** — Display an unaffected hand or milestone target alongside the affected hand for reference
- **Dual Integration** — Receives patient data from a therapist dashboard (React, via `postMessage`) or a patient mobile app (Flutter, via JavaScript channel)
- **Smooth Animations** — `requestAnimationFrame`-based joint rotation with synchronized direction reversal

## Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Framework   | Vue.js 2 + Vue Router + Vuex       |
| 3D Engine   | Three.js (GLTFLoader, OrbitControls)|
| Styling     | SCSS                                |
| Build       | Vue CLI 5                           |

## Project Structure

```
src/
├── views/
│   └── RingView.vue            # Main 3D visualization (scene, camera, animation, interaction)
├── models/
│   └── JointExerciseState.js   # ROM and joint state data models
├── config/
│   ├── global.js               # Display mode constants
│   └── test.js                 # Sample patient data for development
├── router/
│   └── index.js                # Routes (single route → RingView)
├── store/
│   └── index.js                # Vuex store
├── App.vue
└── main.js

public/models/
└── hand_3.glb                  # 3D hand model (GLTF binary)
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm

### Install

```bash
npm install
```

### Run (development)

```bash
npm run serve
```

Opens at `http://localhost:8080` with hot reload.

### Build (production)

```bash
npm run build
```

Outputs to `dist/`.

## Integration

The app listens for external data via two channels:

**Therapist Dashboard (React)**
Send a `postMessage` to the iframe with:
```js
{ type: "initial", data: { hand, jointExerciseState, userState } }
```

**Patient App (Flutter)**
Inject data through `window.hand_data` JavaScript channel. The app posts status updates back via `window.hand_data.postMessage()`.

### Message Types

| Type             | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `initial`        | Load patient hand data and joint states      |
| `rotationDirect` | Change rotation axis (FE / DB)               |
| `contrastModel`  | Toggle unaffected hand or milestone overlay  |
| `natureGesture`  | Reset hand to natural resting position       |

## 3D Scene

- **Camera**: Perspective (75° FOV), repositions based on view level
- **Lighting**: Hemisphere light + 2 directional lights with shadows
- **Controls**: OrbitControls for rotate/zoom/pan
- **Background**: `#F2F4FB`

## License

Private — Thesis project.
