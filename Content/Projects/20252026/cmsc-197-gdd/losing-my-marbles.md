---
title: Losing My Marbles
authors:
  - Adriel Neyro S. Caraig
  - Keith Ashly M. Domingo
abstract: "Losing My Marbles is a turn-based, pass-and-play deck-builder built in Godot 4, reimagining the Filipino marble game Holen with card strategy and 2D physics simulation. Two players alternate turns across five phases — Draw, Play, Aim, Simulating, and End Turn — spending mana to play cards before executing shots with three independent aiming inputs: map rotation, fine-tune angle, and a flick-strength slider. Five card types interact with the physics engine and the opponent: Marbles carry dual PLAY and SIMULATION effects; Power-Ups buff the active player; Tricks apply instant field effects; Terrains set a global physics modifier; and Area-of-Effect cards stack time-limited physics deltas. All field properties — friction, gravity, stickiness, and elasticity — stack additively across the Map Base, active Terrain, and live AOE effects via a FieldStateManager. A Knockout Multiplier scales effect values up to 3× for chained knockouts within a single simulation phase. The architecture is server-authoritative with RPC stubs already wired for deferred online multiplayer injection."
docs: https://github.com/FakeSquiffy-Games/losing-my-marbles/blob/main/docs/LOSING_MY_MARBLES_DesignDoc.pdf
repository: https://github.com/FakeSquiffy-Games/losing-my-marbles
thumbnail: null
tags: [cmsc-197-gdd]
published: 2026-05-22
schoolYear: 2025
---
