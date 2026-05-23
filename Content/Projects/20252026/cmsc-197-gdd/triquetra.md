---
title: Triquetra
authors:
  - Luis Victor V. Borbolla
  - Christian Joseph G. Hernia
abstract: "Triquetra is a top-down 2D action game built in Godot 4.6 in which the player channels three guardian spirit forms — Sword, Spear, and Bow — each with distinct primary and special attacks, through a wave-based forest arena. The game's central mechanic is form permanence and loss: dying in a form locks it for the rest of the run, and losing all three resets the timeline from the beginning. HP and stamina are shared across forms; kills restore stamina, and stamina fuels both sprinting and special attacks. The arena pits the player against four enemy types — Ninja variants, Werewolf, Knight, and a multi-phase Minotaur boss — across four escalating waves. Architecture is driven by a GameStateMachine autoload, an 11-state player FSM managed by FormManager, and a 7-state BaseEnemy FSM shared across all enemy variants. A SoundManager handles four categorized sound libraries."
docs: https://github.com/sizzlingsisig/triquetra/blob/main/docs/Triquetra_DesignDoc.md
repository: https://github.com/sizzlingsisig/triquetra
thumbnail: null
tags: [cmsc-197-gdd]
published: 2026-05-23
schoolYear: 2025
---
