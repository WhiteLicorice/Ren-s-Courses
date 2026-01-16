---
title: Fly, Flap, and Die!
subtitle: CMSC 197 GDD MP1 -
lead: Yet Another Flappy Bird Clone (YAFBC).
published: 2026-01-16
tags: [cmsc-197-gdd]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
downloadLink: https://drive.google.com/file/d/1Bwqu2xlrb-1kcZZUXyLqyw0-rh4VaBeB/view?usp=drive_link
isDraft: true
---

Your first *machine problem* (traditionally, this is what we call take-home labs in GDD), is to create Yet Another Flappy Bird Clone (YAFBC) from scratch in the Godot engine. You may scour the internet for free-to-use art assets, such as the infamous Flappy Bird sprite, but the bespoke implementation and the code must come from you.

## Learning Objectives

By the end of this machine problem, you should be able to:

- Navigate the Godot engine interface and understand its node-based architecture
- Implement basic 2D game mechanics including physics, collision detection, and input handling
- Manage game state transitions (idle, flapping, dying, etc.)
- Work with sprites, animations, and sounds
- Implement simple procedural generation
- Apply fundamental game design principles to create a playable experience

---

## Why Flappy Bird?

Flappy Bird is deceptively simple. On the surface, it's just a bird that flaps when you tap the screen, avoiding pipes that scroll endlessly. But underneath that simplicity lies a surprisingly complete game development challenge that forces you to grapple with the fundamentals: physics, collision detection, procedural generation, game state management, and the elusive concept of “feel.”

More importantly, Flappy Bird is small enough to finish in a reasonable timeframe while being complex enough to matter. You're not just moving a sprite around the screen — you're building a complete game loop, from the moment the player launches the game to the moment they inevitably crash into a pipe and see their score.

This is the sweet spot for our first machine problem. It's large enough that you can't brute-force your way through without understanding what you're doing, but small enough that you won't get lost in the weeds of a sprawling codebase. By the time you're done, you'll have touched every major system that modern games rely on, even if in miniature form.

---

## Core Mechanics

### The Bird

Your bird (or whatever flying object you choose) must respond to player input with a single mechanic: flapping. Each flap applies an upward impulse, fighting against gravity. The bird continuously falls due to gravity, and the player must time their flaps to navigate through a series of infinite obstacles.

The physics here matter more than you think. If gravity is too strong, the game becomes frustrating. Too weak, and it becomes trivial. The same goes for flap strength. Finding the right balance between these values is your first lesson in “feel” — the intangible quality that makes a game satisfying to play.

For aesthetics, your bird should also rotate slightly based on its vertical velocity. When falling, it tilts downward. When flapping upward, it tilts up. This small detail provides crucial visual feedback to the player about their current trajectory. Visual feedback is critical for reducing *cognitive load* in high-pressure physics-based games like Flappy Bird.

### The Pipes

Pipes (or whatever obstacles you choose) spawn at regular intervals and scroll across the screen from right to left. Each pipe pair has a gap that the bird must fly through. The vertical position of this gap should vary randomly within reasonable bounds — you don't want it spawning at the very top or bottom of the screen where it's impossible to reach.

As pipes scroll off the left side of the screen, they should be removed from the scene to avoid accumulating objects in memory. This is called *object pooling* in more sophisticated implementations, but for now, simply destroying off-screen pipes and spawning new ones is sufficient. Feel free to implement object pooling if you wish to test your programming chops.

In any case, collision with a pipe ends the game immediately. The hitboxes for collision detection should be fair — players should never feel cheated by a collision that didn't visually make sense. If you wish, you may also introduce other types of obstacles, like moving pipes or floating bombs for extra challenge!

### Scoring

The player scores one point for each pipe pair they successfully pass through. A simple way to implement this: when the bird's x-coordinate crosses the center of a pipe's gap, increment the score — but there are more clever ways to go about this. However you do it, make sure you only award the point once per pipe pair.

Display the current score prominently during gameplay. When the player collides with a pipe and “dies,” reset both the score and the game. Resetting the game should avoid memory leaks and unreferenced objects (i.e., stray pipes). The game shouldn't lag no matter how long it runs.

### Game States

Your game needs at least three distinct states:

- **Idle State** — The initial state the player sees. This is where the bird is just flying (or technically falling).
- **Flapping State** — The bird responds to input and flaps upward, fighting against gravity.
- **Dying State** — Triggered when the bird collides with a pipe or the ground/ceiling. Restart both the player's score and the game state.

Proper state management prevents bugs like the bird continuing to respond to input after dying or the score incrementing while dead.

---

## Technical Requirements

### Input Handling

The game must respond to at least one input method (keyboard, mouse click, or touch if testing on mobile). The input should be simple — one button to flap. When pressed, apply an upward impulse to the bird.

Don't allow input buffering or repeated flapping from holding the button down. Each press should correspond to exactly one flap. This is crucial for the game's difficulty curve.

### Collision Detection

Implement collision detection between:

- The bird and pipes
- The bird and the ground
- The bird and the ceiling (optional, but recommended)

Godot provides several collision detection systems. For this project, `Area2D` nodes with collision shapes are sufficient. Make sure your collision shapes match the visual sprites closely enough that collisions feel “fair” to the player.

### Procedural Generation

Pipes should spawn automatically at regular intervals. Each pipe pair should have a randomly positioned gap. You can implement this with a `Timer` node that triggers a pipe spawning function.

Parameters to consider:

- Spawn interval (how often new pipes appear)
- Pipe gap size (distance between top and bottom pipes)
- Gap position variance (how much the gap's vertical position can vary)
- Pipe scroll speed

These values significantly affect difficulty. You'll need to experiment to find settings that create a challenging but fair experience.

### Visual and Audio Feedback

At minimum, your game should include:

- Sprites for the bird, pipes, background, and ground
- A flapping animation for the bird (at least 2–3 frames)
- Sound effects for flapping, scoring, and dying
- Background music (optional but recommended)

You can find free assets on sites like [OpenGameArt.org](https://opengameart.org), [itch.io](https://itch.io), [Kenney.nl](https://kenney.nl), or GitHub. Make sure any assets you use have appropriate licenses for educational use. Don't forget to credit the assets you use in your `README.md`!

---

## Deliverables

### The Game

A playable Godot project that implements all core mechanics and technical requirements listed above. The game should be stable — no crashes, no game-breaking bugs. Minor polish issues are acceptable, but the core loop of idle → flap → die → restart must work flawlessly.

### Source Code Repository

Your complete Godot project must be hosted in a GitHub repository. The repository should include:

- All Godot project files and scenes
- All assets (sprites, sounds, fonts) with proper attribution in a `CREDITS.txt` file
- A `README.md` file with:
  - Brief description of your game and any unique features or variations you added
  - Controls (which keys/buttons do what)
  - Known issues or limitations
  - Asset credits and licenses
  - A built game in the *releases* section
- A short `POSTMORTEM.md` reflecting on:
  - What went well during development
  - What challenges you encountered and how you solved them
  - What you would do differently if you started over
  - What you learned from this project

**Invite [me](https://github.com/WhiteLicorice) as a collaborator on your repository. This will serve as your submission.** Use meaningful commit messages that describe what each commit accomplishes. Your commit history tells a story about your development process — make it a good one.

---

## Grading Notes

This is not a competition to create the most polished or feature-rich version of Flappy Bird. The goal is to demonstrate that you understand the fundamental systems that make games work. A simple but well-implemented game will score better than an ambitious but buggy one. Recall your state machines from CMSC 141 and your object-oriented programming from CMSC 22!

Focus on making the core mechanics feel good. A bird that responds predictably to input, pipes that provide a fair challenge, and collision detection that works correctly are more important than particle effects or elaborate menus. That said, if you finish the core requirements early and want to add extra features (power-ups, different game modes, procedurally generated backgrounds, etc.), go for it. Just make sure the foundation is solid first.

**Code quality matters.** Your code doesn't need to be perfect, but it should be readable and organized. Use meaningful variable names. Break complex functions into smaller ones. Add comments where your intent isn't obvious.

---

## Laboratory Defense

The instructor will be available during scheduled laboratory hours in the assigned room for defense or consultation. You will be catered to on a first-come, first-served basis. It is mandatory to present your code, answer inquiries, and perform live programming if the instructor deems it necessary to further check your understanding.

If a laboratory defense for an activity fails to be conducted within **one month** of its assignment, the instructor will be forced to give a failing grade. Scoring will be done during the laboratory defense (*no defense, no grade* policy). Extensions may be granted due to extraordinary circumstances but ultimately remain up to the judgment of the instructor.

---

## Academic Honesty

The usage of Large Language Models (e.g., ChatGPT, Claude, Deepseek, etc.) to generate code is considered cheating. As cheating is against the university's code of ethics, it is subject to failure in the course and harsh disciplinary action.

---

## Rubric for Programming Exercises (50 pts)

| **Criteria (10 Points Each)** | **Excellent (9–10)** | **Good (6–8)** | **Fair (3–5)** | **Poor (0–2)** |
|--------------------------------|----------------------|----------------|----------------|----------------|
| **Program Correctness** | Executes correctly with no syntax or runtime errors; meets/exceeds specs; displays correct output | Executes with minor errors but meets specs | Executes with major errors but partially meets specs | Does not execute or fails to meet specs |
| **Logical Design** | Logically well-designed with excellent structure and flow | Minor logic errors not affecting results significantly | Major logic errors affecting functionality | Fundamentally incorrect logic |
| **Code Mastery** | Excellent mastery of code | Adequate mastery | Fair mastery | Poor mastery |
| **Engineering Standards** | Stylistically well designed and engineered | Minor poor design choices | Severe poor design choices | Poorly written |
| **Documentation*** | Well-documented; comments exist for clarity, not redundancy | Missing one required or redundant comment | Missing several comments or overly redundant | Missing or poor documentation |

*Remember: "Code tells you how, comments tell you why." — Jeff Atwood, co-founder of Stack Overflow and Discourse*

***Note:** This rubric evaluates your ability to implement and integrate game systems, not your artistic ability. Programmer art is perfectly acceptable as long as the game is playable and the mechanics are clear.*