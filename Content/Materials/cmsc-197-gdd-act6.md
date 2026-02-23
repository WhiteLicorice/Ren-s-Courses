---
title: Jungle Jump Pt. 2
subtitle: CMSC 197 GDD Activity 6
lead: Platformer Movement
published: 2026-03-17
tags: [cmsc-197-gdd]
authors:
    - name: Rene Andre B. Jocsing
      gitHubUserName: WhiteLicorice
      nickname: Ren
downloadLink: https://drive.google.com/file/d/1MHzwuGHm786vk2l1age9ePi0DuNVmDVT/view?usp=drive_link
isDraft: false
noDeadline: true
---

## Session Objectives

* Implement player movement with velocity-based physics
* Complete finite state machine with state transitions
* Integrate animation system with state machine
* Add gravity and jump mechanics
* Create player health system with damage response

---

## Recap from Pt. 1

Last session, you created the Player scene with:

* CharacterBody2D root node with proper collision layers
* AnimationPlayer with all movement animations
* Camera2D for viewport control
* Basic FSM skeleton with enum states

Today, you'll bring the player to life with movement, state transitions, and a health system.

---

## Player Movement Implementation

### Input Processing

The player needs three controls: left, right, and jump. Create a `get_input()` function that processes inputs and determines state transitions.

**Add to player.gd (after change_state function):**

```gdscript
func get_input() -> void:
    var right: bool = Input.is_action_pressed("right")
    var left: bool = Input.is_action_pressed("left")
    var jump: bool = Input.is_action_just_pressed("jump")
    
    # Movement occurs in all states
    velocity.x = 0
    if right:
        velocity.x += run_speed
        $Sprite2D.flip_h = false
    if left:
        velocity.x -= run_speed
        $Sprite2D.flip_h = true
    
    # Only allow jumping when on the ground
    if jump and is_on_floor():
        change_state(JUMP)
        velocity.y = jump_speed
    
    # IDLE transitions to RUN when moving
    if state == IDLE and velocity.x != 0:
        change_state(RUN)
    
    # RUN transitions to IDLE when standing still
    if state == RUN and velocity.x == 0:
        change_state(IDLE)
    
    # Transition to JUMP when in the air
    if state in [IDLE, RUN] and not is_on_floor():
        change_state(JUMP)
```

#### Design Pattern: Velocity Reset

`velocity.x = 0` at the start of `get_input()` ensures the player stops immediately when no keys are pressed. Without this, the player would continue sliding due to retained velocity.

This differs from RigidBody2D where friction gradually reduces velocity. For platformers, instant response feels better.

### Input Method Comparison

| **Method** | **Behavior** |
|---|---|
| `is_action_pressed()` | Returns `true` continuously while key is held |
| `is_action_just_pressed()` | Returns `true` only on the frame the key was pressed |

**Jump uses `is_action_just_pressed()`:** Players must press jump each time. Holding the key doesn't create continuous jumps. This prevents accidental double-jumping and provides precise control.

### Sprite Flipping

```gdscript
$Sprite2D.flip_h = false  # Face right
$Sprite2D.flip_h = true   # Face left
```

**Rationale:** Instead of rotating the sprite or creating separate left/right animations, we flip the sprite horizontally. This saves memory and animation effort while maintaining visual correctness.

---

## Physics Processing

### The Physics Loop

Add the `_physics_process()` function to handle gravity, input, and movement:

```gdscript
func _physics_process(delta: float) -> void:
    velocity.y += gravity * delta
    get_input()
    move_and_slide()
    
    # JUMP ends when landing
    if state == JUMP and is_on_floor():
        change_state(IDLE)
    
    # Switch to falling animation
    if state == JUMP and velocity.y > 0:
        $AnimationPlayer.play("jump_down")
```

#### Architecture Note: Physics Frame Independence

**Why multiply by delta?**

`delta` is the time elapsed since the last frame (typically ~0.016s for 60 FPS).

Without delta: `velocity.y += 750` would add 750 pixels/frame

- 60 FPS: 750 * 60 = 45,000 pixels/second
- 30 FPS: 750 * 30 = 22,500 pixels/second

With delta: `velocity.y += 750 * delta`

- 60 FPS: 750 * 0.016 * 60 = 750 pixels/second
- 30 FPS: 750 * 0.033 * 30 = 750 pixels/second

Result: Consistent physics regardless of framerate.

*Can you prove this using Riemann Sums? Recall Math 54 and Physics 71 (Euler's Method and the definition of an integral, alongside the definition of a derivative with respect to acceleration and velocity).*

`The proof is trivial and is left as an exercise to the reader.`

### Understanding move_and_slide()

`move_and_slide()` performs three critical operations:

1. **Moves the body** by the current `velocity` vector
2. **Detects collisions** with other physics bodies
3. **Slides along surfaces** when collisions occur

Additionally, because `Up Direction` is set to `(0, -1)`:

* Collisions below the player = floor
* `is_on_floor()` returns `true` when standing on surfaces
* `is_on_ceiling()` detects overhead collisions

#### Common Pitfalls

**Common mistake: Calling move_and_slide() multiple times**

Each call moves the character. Multiple calls in one frame = multiple movements = incorrect physics.

Always call `move_and_slide()` exactly once per `_physics_process()` frame.

### Jump Animation Transition

```gdscript
if state == JUMP and velocity.y > 0:
    $AnimationPlayer.play("jump_down")
```

**Logic:**

* `velocity.y < 0`: Moving upward (ascending)
* `velocity.y > 0`: Moving downward (falling)

When velocity transitions from negative to positive, switch from `jump_up` to `jump_down` animation. This creates a natural jump arc visual.

### State Transition Rules

| **From State** | **To State** | **Condition** |
|---|---|---|
| IDLE | RUN | velocity.x ≠ 0 |
| RUN | IDLE | velocity.x == 0 |
| IDLE/RUN | JUMP | Jump pressed and is_on_floor() |
| IDLE/RUN | JUMP | not is_on_floor() (fell off edge) |
| JUMP | IDLE | is_on_floor() |

#### Design Pattern: State Transition Validation

Notice that jumps only trigger when `is_on_floor()` is `true`. This prevents mid-air jumping (unless you want double-jump mechanics).

The `state in [IDLE, RUN]` check ensures players can't transition to JUMP from HURT or DEAD states—a critical gameplay constraint.

---

## Testing the Movement

Before adding more features, verify the movement works correctly.

### Test Scene Setup

You should still have the Main scene from last session with a StaticBody2D platform. If not:

1. Open Main.tscn (or create new scene with Node root)
2. Add Player instance (if not present)
3. Add StaticBody2D with RectangleShape2D collision
4. Stretch collision shape horizontally
5. Position platform below player

### Enable Collision Visualization

**Menu: Debug → Visible Collision Shapes**

This debug setting draws collision shapes during gameplay. Essential for troubleshooting physics issues.

### Testing Checklist

Press **F6** (Play Scene) and verify:

1. Player falls and stops on platform (gravity works)
2. `idle` animation plays when standing still
3. Left/Right movement works, sprite flips correctly
4. `run` animation plays while moving
5. Space bar makes player jump
6. `jump_up` animation plays while ascending
7. `jump_down` animation plays while falling
8. Player returns to `idle` after landing
9. Walking off platform edge triggers JUMP state

#### Common Pitfalls

**Player falls through platform?**

Check:

* Player collision mask includes `environment` layer
* StaticBody2D collision layer is `environment`
* CollisionShape2D has a shape assigned
* Visible Collision Shapes is enabled to debug

**Player doesn't jump?**

Check:

* Input action `jump` exists with Space assigned
* No typos in `Input.is_action_just_pressed("jump")`
* Player is actually on the floor (add `print(is_on_floor())` to debug)

---

## Player Health System

The player will start with three hearts and lose one each time damaged.

### Health Variables and Signals

**Add to top of player.gd (after extends line):**

```gdscript
signal life_changed
signal died

var life: int = 3: set = set_life

func set_life(value: int) -> void:
    life = value
    life_changed.emit(life)
    if life <= 0:
        change_state(DEAD)
```

#### Design Pattern: Setter Functions

**Godot 4 property setter syntax:**

`var life: int = 3: set = set_life`

Whenever `life` is modified (via `life = 2` or `life -= 1`), the `set_life()` function is automatically called.

**Benefits:**

* Centralized logic for property changes
* Automatic signal emission on value change
* Validation (e.g., clamping health between 0-3)
* Side effects (triggering state changes)

**Old Godot 3 syntax:** `var life = 3 setget set_life`

### Signal Explanation

* **life_changed**: Emitted whenever health changes. UI will connect to this to update heart display.
* **died**: Emitted when life reaches 0. Main game scene will handle game over logic.

### Damage Response Function

```gdscript
func hurt() -> void:
    if state != HURT:
        change_state(HURT)
```

#### Design Decision: Invulnerability During HURT

The `if state != HURT` check prevents damage loops.

**Without this check:** Enemy collision → hurt() → life -= 1 → still colliding → hurt() → life -= 1...

Result: Instant death from single touch.

**With this check:** Once in HURT state, additional damage calls are ignored until state changes back to IDLE.

### Enhanced HURT State Behavior

**Update the HURT case in change_state():**

```gdscript
HURT:
    $AnimationPlayer.play("hurt")
    velocity.y = -200
    velocity.x = -100 * sign(velocity.x)
    life -= 1
    await get_tree().create_timer(0.5).timeout
    change_state(IDLE)
```

**Breakdown:**

* `velocity.y = -200`: Bounce upward
* `velocity.x = -100 * sign(velocity.x)`: Knock back opposite to current movement direction
* `life -= 1`: Decrease health (triggers `set_life()`)
* `await...create_timer(0.5)`: Wait 0.5 seconds
* `change_state(IDLE)`: Return to normal state

#### Architecture Note: sign() Function

`sign(x)` returns:

* 1 if x > 0
* -1 if x < 0
* 0 if x == 0

`-100 * sign(velocity.x)` creates knockback:

* Moving right (velocity.x > 0): -100 * 1 = -100 (pushed left)
* Moving left (velocity.x < 0): -100 * -1 = 100 (pushed right)

This ensures knockback feels natural—you're pushed away from the danger source.

### Update DEAD State

```gdscript
DEAD:
    died.emit()
    hide()
```

Emit signal to notify Main scene, then hide the player sprite.

### Disable Input During HURT

**Add to the beginning of get_input():**

```gdscript
func get_input() -> void:
    if state == HURT:
        return
    # ... rest of function
```

**Rationale:** Players shouldn't control the character during damage knockback. The early return prevents all input processing when hurt.

### Reset Function for Respawning

**Add this function:**

```gdscript
func reset(_position: Vector2) -> void:
    position = _position
    show()
    life = 3
    change_state(IDLE)
```

**Usage:** Later, the Main scene will call this when starting a level or respawning after death. This centralizes spawn logic.

#### Common Pitfalls

**Why set position directly here?**

Earlier, we said never directly set `position` on CharacterBody2D. But during spawn/reset, the player isn't moving—they're being placed. This is safe.

**Rule of thumb:** Use `move_and_slide()` for movement during gameplay. Direct position assignment is acceptable for teleportation/spawning.

---

## Complete Player Script

Your `player.gd` should now look like this:

```gdscript
class_name Player extends CharacterBody2D

signal life_changed
signal died

# Movement parameters
@export var gravity: int = 750
@export var run_speed: int = 150
@export var jump_speed: int = -300

# State machine
enum {IDLE, RUN, JUMP, HURT, DEAD}
var state: int = IDLE

# Health
var life: int = 3: set = set_life

func set_life(value: int) -> void:
    life = value
    life_changed.emit(life)
    if life <= 0:
        change_state(DEAD)


func _ready() -> void:
    change_state(IDLE)


func change_state(new_state: int) -> void:
    state = new_state
    match state:
        IDLE:
            $AnimationPlayer.play("idle")
        RUN:
            $AnimationPlayer.play("run")
        JUMP:
            $AnimationPlayer.play("jump_up")
        HURT:
            $AnimationPlayer.play("hurt")
            velocity.y = -200
            velocity.x = -100 * sign(velocity.x)
            life -= 1
            await get_tree().create_timer(0.5).timeout
            change_state(IDLE)
        DEAD:
            died.emit()
            hide()


func get_input() -> void:
    if state == HURT:
        return
    
    var right: bool = Input.is_action_pressed("right")
    var left: bool = Input.is_action_pressed("left")
    var jump: bool = Input.is_action_just_pressed("jump")
    
    # Movement occurs in all states
    velocity.x = 0
    if right:
        velocity.x += run_speed
        $Sprite2D.flip_h = false
    if left:
        velocity.x -= run_speed
        $Sprite2D.flip_h = true
    
    # Only allow jumping when on the ground
    if jump and is_on_floor():
        change_state(JUMP)
        velocity.y = jump_speed
    
    # IDLE transitions to RUN when moving
    if state == IDLE and velocity.x != 0:
        change_state(RUN)
    
    # RUN transitions to IDLE when standing still
    if state == RUN and velocity.x == 0:
        change_state(IDLE)
    
    # Transition to JUMP when in the air
    if state in [IDLE, RUN] and not is_on_floor():
        change_state(JUMP)


func _physics_process(delta: float) -> void:
    velocity.y += gravity * delta
    get_input()
    move_and_slide()
    
    # JUMP ends when landing
    if state == JUMP and is_on_floor():
        change_state(IDLE)
    
    # Switch to falling animation
    if state == JUMP and velocity.y > 0:
        $AnimationPlayer.play("jump_down")


func reset(_position: Vector2) -> void:
    position = _position
    show()
    life = 3
    change_state(IDLE)


func hurt() -> void:
    if state != HURT:
        change_state(HURT)
```

---

## Testing the Complete System

### Manual Damage Testing

You don't have enemies yet, but you can test the health system manually.

**Add to Main.gd (create script if needed):**

```gdscript
extends Node

func _ready() -> void:
    $Player.life_changed.connect(_on_player_life_changed)
    $Player.died.connect(_on_player_died)


func _on_player_life_changed(new_life: int) -> void:
    print("Player life: ", new_life)


func _on_player_died() -> void:
    print("Player died!")


func _input(event: InputEvent) -> void:
    # Press Enter to test damage
    if event.is_action_pressed("ui_accept"):
        $Player.hurt()
```

**Test:** Press Enter/Return repeatedly. Console should show life decreasing. After three presses, player should disappear and "Player died!" should print.

### Verification Checklist

1. Damage creates upward bounce
2. Knockback pushes player away from movement direction
3. `hurt` animation plays
4. Input disabled during HURT state
5. Life decreases by 1
6. After 0.5s, returns to IDLE state
7. After 3 hits, player dies and disappears

---

## Session Summary

### What We Built

* Complete player movement with responsive controls
* Functional FSM with proper state transitions
* Gravity and jump mechanics
* Health system with damage response and knockback
* Signal-based communication for UI integration

### Key Architectural Patterns

1. **Velocity-based movement:** Manual gravity + move_and_slide()
2. **Delta-time physics:** Frame-independent movement
3. **FSM state transitions:** Condition-based state changes
4. **Property setters:** Automatic signal emission on value changes
5. **Invulnerability frames:** Preventing damage loops

### GDScript Patterns Introduced

* `is_on_floor()` for platform detection
* `sign()` for directional logic
* `await...create_timer()` for timed state changes
* Property setters with `: set = func_name`
* Early return pattern for conditional logic

### Next Session Preview

* Design levels using TileMap node
* Create TileSet with collision and custom data
* Implement camera limits based on level bounds
* Add screen wrapping for continuous worlds
* Build multiple level scenes