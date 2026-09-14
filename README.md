# 🏋️‍♂️ Iron Ledger — Powerlifting & Bodybuilding Periodisation Tracker

<p align="center">
  <strong>A comprehensive, offline-first periodisation engine and strength training journal built for competitive powerlifters, bodybuilders, and strength athletes.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Capacitor-Android_8.5-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor Android" />
  <img src="https://img.shields.io/badge/Linter-Oxlint-F59E0B?style=for-the-badge" alt="Oxlint" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

---

## 📌 Overview

**Iron Ledger (Periodisation)** is an advanced strength training and periodisation management platform designed to replace fragmented spreadsheets, notes, and generic workout loggers.

Structured around classical and undulating periodisation principles, it tracks training across **Mesocycles**, **Microcycles**, and **Individual Training Days** with granular set-by-set logging, automated Personal Record (PR) detection, visual anatomy muscle load mapping, readiness journaling, and in-depth fatigue/volume analytics.

Packaged as a lightning-fast web application and native Android app via **Capacitor**.

---

## ✨ Core Features

### 🔄 1. Hierarchical Periodisation Engine
* **Phased Mesocycles**: Plan and structure training blocks across *Hypertrophy*, *Strength*, *Peaking*, *Accumulation*, *Base Building*, and *Deload* phases.
* **Microcycle Breakdown**: Group sessions into structured training weeks or rolling microcycles with custom targets and focus areas.
* **Day-Level Planning**: Differentiate workout days, active recovery sessions, physio visits, rest periods, and illness/events.

### 📊 2. Granular Workout & Set Logging
* **Multi-Type Sets**: Warmups (`W`), working sets, drop sets, and cardio sessions (distance, duration, calories).
* **Equipment Specifications**: Tag sets as **Raw** or **Gear** (wraps, suits, sleeves).
* **Rest Timer & Active Workout Drawer**: Persistent, minimizable workout drawer allowing seamless navigation during active gym sessions without losing state.
* **Celebratory PR Tracking**: Real-time PR detection with canvas confetti feedback.

### 🧠 3. Interactive Muscle Anatomy Visualizer
* **Body Heatmap**: Integrated 2D anatomical muscle highlighter powered by `react-muscle-highlighter`.
* **Load Distribution**: Automatically highlights target muscle groups (Chest, Lats, Quads, Delts, Hamstrings, Core, etc.) based on exercises logged.

### 📚 4. Comprehensive Exercise Library & Kanban
* **Lyfta API Integration**: Access to a massive catalog of movements with muscle tags and animated execution demos/GIFs.
* **Offline Fallback Catalog**: Pre-bundled with an offline dataset (`~800 KB`) so you never lose exercise definitions without an internet connection.
* **Interactive Kanban**: Organize movements by target muscle split, movement patterns, or equipment availability.

### 📈 5. In-Depth Analytics & Readiness Journaling
* **Volume & Intensity Curves**: Dynamic progression charts for load, volume load, and rep ranges over time.
* **Readiness & State of Mind**: Track daily fatigue, mental state  and physio recovery notes.
* **Nutrition & Diet Logging**: Integrated daily meal and macro tracking alongside lifting performance.

### 🔒 6. Privacy & Data Sovereignty
* **100% Offline-First**: Zero mandatory cloud login. All data persists securely in client-side `localStorage`.
* **Full JSON Export/Import**: One-click full-fidelity backup and restore of all mesocycles, PR shelves, habits, and history.

---

## 🛠️ Tech Stack

| Domain | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Core** | React 19, TypeScript 6.0 | Modern functional React architecture with strict typings |
| **Build & Tooling** | Vite 8.2, Oxlint | High-performance build tool and next-gen Rust-based linter |
| **Styling** | Tailwind CSS v4 | Custom utility system with dark-mode aesthetic |
| **Mobile Runtime** | Capacitor 8.5 (Android) | Native Android bridge for mobile deployment and offline use |
| **Icons & Visuals** | Lucide React | Clean, consistent vector iconography |
| **Anatomy Visuals** | `react-muscle-highlighter` | Interactive SVG-based muscular load visualizer |
| **FX & Animations** | `canvas-confetti` | Milestone and PR celebration animations |

---

