# F1 Data-Driven Race Simulation

![F1 Simulation](https://img.shields.io/badge/Simulation-F1%202024-red.svg)
![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)
![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-orange.svg)

## 🏎️ Project Overview

This project presents an advanced, data-driven Formula 1 race simulation system that integrates rigorous statistical modeling with a real-time, browser-based visualization engine. The system simulates a complete 20-driver 2024 FIA Formula 1 World Championship grid competing over a 15-lap race at the Autodromo Nazionale di Monza (or Silverstone Circuit depending on configuration).

The primary objective is to demonstrate how raw statistical data and probability distributions—specifically the Log-Normal distribution—can be translated into a mathematically accurate, visually dynamic physics engine that faithfully reflects real-world racing dynamics, including tire degradation, pit stop strategy, and driver-to-driver performance variance.

## ✨ Key Features

- **Mathematical Data Engine (Python):** Generates lap times using Log-Normal distributions and executes 500 Monte Carlo simulations per driver to predict race outcomes.
- **Dynamic Statistical Testing:** Automatically performs T-Tests, Chi-Square Goodness of Fit, and ANOVA to yield real-world F1 analytical insights (e.g., Teammate Battles, Strategy Optimization).
- **Advanced Race Physics:** Incorporates non-linear tire degradation (Soft, Medium, Hard) and individual driver pit stop strategies.
- **Visual Simulation Engine (HTML5 Canvas):** A 60fps GPU-accelerated visualization featuring procedural track rendering (Catmull-Rom splines), dynamic pit lanes, and a sleek, glassmorphism UI with a scrollable 20-driver timing tower.
- **Full 2024 Grid:** Features the official 2024 F1 teams and driver line-ups with accurate team color palettes.

## 🏗️ System Architecture

The project employs a decoupled, two-component architecture:
1. **Data Engine (`local/f1_analysis.py`):** The computational Python backend that performs Monte Carlo simulations and outputs predictions to a JSON file.
2. **Visualization Engine (`local/index.html` & `local/app.js`):** The standalone HTML5/JS web frontend that reads the JSON payload and renders the race.

## 🚀 How to Run

Running the simulation is designed to be seamless. A provided launcher script orchestrates both the data generation and the visualization.

### Prerequisites
- **Python 3.8+**
- Python packages: `numpy`, `scipy` (Install via `pip install -r local/requirements.txt` if needed, though the launcher handles basic execution)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Execution Steps

1. Clone or download this repository.
2. Open your terminal or command prompt.
3. Navigate to the `local` directory:
   ```bash
   cd local
   ```
4. Run the launcher script:
   ```bash
   python run.py
   ```

### What happens when you run `run.py`?
1. The **Monte Carlo analysis engine** (`f1_analysis.py`) is executed, generating synthetic lap times and statistical tests.
2. A data payload is saved to `data/drivers.json`.
3. A **local HTTP server** is automatically started on port `8000`.
4. Your **default web browser** will open `http://localhost:8000/index.html`, starting the real-time visual race simulation.

## 📊 Technical Highlights

- **Log-Normal Lap Time Generation:** Accurately models the physical lower bounds and unbounded upper limits (mistakes, traffic) of motorsport lap times.
- **Dynamic Pit Lane:** The visualizer dynamically routes pitting cars off the racing line, enforces a pit limiter speed, applies a 2.5s tire change penalty, and merges them back smoothly.
- **Data-Driven Pace:** The visual velocity of each car on the track is mathematically locked to its expected race time from the Monte Carlo engine, ensuring the visual outcome matches the statistical prediction.

---
*Developed as an academic-grade simulation and statistical analysis suite.*
