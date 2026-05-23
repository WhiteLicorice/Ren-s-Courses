---
title: Pixel Origins
authors:
  - Kent Francis E. Genilo
  - Mark Leonel T. Misola
abstract: "Pixel Origins is a 2D top-down action RPG prototype built in Godot 4.6 featuring state-driven character movement and combat, a multi-stage world with persistent save and load, and a quest system with dialogue-based acceptance and turn-in flows. The player navigates an overworld hub connected to named regions — Tauracre and Bramblewilds — engages in melee combat using a 3-hit attack system with active hit-window detection, and completes repeatable quests rewarded with gold. Goblin enemies operate on a camp-behavior AI with idle, aggro, chase, attack, and retreat states, and display a health bar only after taking damage. Four core singletons — StageManager, SaveManager, QuestManager, and SignalBus — decouple UI from gameplay events and persist stage identity, player position, health, and gold across sessions. Death reloads the last save, with a fallback to the start screen when none exists. The Dialogue Manager addon powers branching NPC conversations with choice flows for quest acceptance."
docs: null
repository: https://github.com/Blue-Shell-Studios/Pixel-Origins-V2
thumbnail: null
tags: [cmsc-197-gdd]
published: 2026-05-22
schoolYear: 2025
---
