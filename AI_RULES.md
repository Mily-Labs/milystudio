# AI Rules & Architecture Guidelines

Welcome to **MilyStudio**! This workspace is a multi-system monorepo combining state-of-the-art Python AI, high-performance Node.js/FFmpeg automation, custom SolidJS/CanvasKit vector animation engines, and React web applications.

To maintain structure, reliability, and ease of automated maintenance, follow these rules and guidelines when modifying any part of the project.

---

## 🛠️ Tech Stack Overview

The workspace is divided into three core subsystems, each optimized for its target domain:

*   **Subsystem 1: FFmpeg (Media Orchestration)**
    *   **Core:** Native `ffmpeg.exe` (with hardware-accelerated transcoding, filters, scaling, audio mixing, and SubStation Alpha `.ass` subtitle rendering).
    *   **Automation:** Node.js (V8 runtime) orchestrating network downloads, file operations, dynamic `.ass` stylesheet compilation, and API hooks to AI engines.
*   **Subsystem 2: OmniVoice (AI Core & Dubbing Studio)**
    *   **Backend:** Python 3.10+ utilizing **FastAPI** (97 programmatic endpoints), PyTorch, SQL Alchemy (sqlite storage with Alembic migrations), Demucs (vocal stems extraction), and WhisperX (word-level aligned transcription).
    *   **Frontend UI:** **React** + Vite, leveraging **Redux Toolkit** (`@reduxjs/toolkit`) for global state management, custom modular UI elements, and Tailwind CSS for layouts.
    *   **Desktop Wrapper:** **Tauri** (Rust runtime) wrapping the Vite frontend.
*   **Subsystem 3: text-to-lottie (Motion-Graphics Core)**
    *   **Frontend:** **SolidJS** built on Vite 7, styled with Tailwind CSS 4 + Kobalte UI + Solid DevTools.
    *   **Renderer:** Skia **CanvasKit-WASM** / Skottie (official high-performance C++ player compiled to WASM) — NOT `lottie-web`.
    *   **Dev-Server API:** Custom Vite middleware endpoints (`/__scenes`, `/__context`, etc.) for live file system updates, heartbeat syncing, and AI agent integration.
*   **Subsystem 4: milylabs-landing (Sleek Product Showcase)**
    *   **Frontend:** **React** + TypeScript + Vite, using **Tailwind CSS** for ultra-responsive styling, featuring custom mathematical/WebGL visualizations (Mobius strips, Frenet frames, dynamic particle systems, virtual scrolling).

---

## 📐 General Coding Rules

1.  **Keep it Simple (No Over-engineering):** Implement exactly what is asked. Do not add speculative interfaces, backwards-compatibility hacks, or multi-layered wrappers where direct, clear functions do the job.
2.  **Surgical Changes:** Edit only relevant files. Never leave partial implementations, placeholder comments, or uncompiled files.
3.  **Strict Type Safety:** All TypeScript code must compile without errors. Use `run_type_checks` to verify edits before finalizing.
4.  **No Unused Variables or Comments:** Clean up unused imports, dead variables, and legacy commented-out lines completely when refactoring.

---

## 📦 Subsystem Architecture & Library Rules

### 1. `ffmpeg/` Node.js Automation
*   **FS Operations:** Use native Node.js `fs` and `path` modules.
*   **Process Execution:** Use `child_process.exec` or `spawn` to invoke `ffmpeg.exe` / `ffprobe.exe`.
*   **Subtitles:** Use `.ASS` (Advanced SubStation Alpha) format for rich, colorful karaoke-style subtitles. Avoid basic SRT where styled layouts are required.

### 2. `OmniVoice/frontend/` React Application
*   **State Management:** Always use **Redux Toolkit (`@reduxjs/toolkit`)**. Read state with `useSelector` and dispatch actions with `useDispatch`. Do not introduce conflicting state systems (like Zustand or Recoil) in this directory.
*   **UI Components:** Build using the design language found in `src/ui/` (e.g., `<Button>`, `<Input>`, `<Dialog>`). Utilize global styling variables in `tokens.css` and `themes.css`.
*   **Tailwind CSS:** Fully rely on Tailwind classes for local layouts and margins. Use existing CSS modules alongside Tailwind where legacy scoped classes are declared.
*   **Interactivity:** Utilize standard hooks (`useState`, `useEffect`, `useMemo`) for local element interactivity. Avoid third-party animation libraries unless they match existing layout constraints.

### 3. `text-to-lottie/` Motion Hub
*   **Reactive Framework:** Use **SolidJS** exclusively here. Do not inject React or Vue libraries into this folder.
*   **Rendering:** Rely strictly on **CanvasKit (Skottie)** for Bodymovin JSON rendering. Maintain full support for reactive `"sid"` (Skottie slots) properties to enable immediate live editing of vectors without re-parsing the JSON.
*   **Styles & Components:** Built with Tailwind CSS 4 and Kobalte components. Maintain the responsive sidebar navigation layout.
*   **Agent Interaction Rules:**
    *   Always read `lottie.json` from disk before modifying it (to capture any changes written directly from the UI sliders).
    *   Ensure each newly generated animation exposes a background color control (`bgColor`) in `controls.json`.

### 4. `milylabs-landing/` Web Landing
*   **Design Paradigm:** Premium, high-end visual design with fluid spatial movements, glassmorphism (`GlassCard`), custom camera rigs (`CameraRig`), and particle overlays.
*   **Performance:** Math operations (Frenet frames, Mobius strip geometry generation) should remain lightweight. Use virtual scrolling (`useVirtualScroll`) to maintain smooth rendering performance at 60 FPS.

---

## 🧪 Verification & Best Practices
*   When editing the React/SolidJS apps, check console output or logs to verify no circular dependencies or build errors.
*   For API changes in Python, ensure any schema changes are cleanly declared in `OmniVoice/backend/api/schemas.py`.
*   Run appropriate type checkers (`run_type_checks` or framework-specific linters) prior to completing any task.
