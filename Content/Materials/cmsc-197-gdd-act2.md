---
title: Coin Dash Pt. 1
subtitle: CMSC 197 Activity 2
lead: Building the Player Scene.
published: 2026-01-30
tags: [cmsc-197-gdd]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
downloadLink: https://drive.google.com/file/d/1yZHBGKncJ5HFClxCCPZs-ZU_lFioYA4T/view?usp=drive_link
isDraft: false
noDeadline: true
---

**Session Objectives**

- Understand Area2D-based collision detection
- Implement input-driven movement with proper delta timing
- Build reusable, testable game objects through scene composition
- Use signals for decoupled communication

## Project Setup

### 1. Create New Project

1. Open Godot, click New Project
2. Name: `CoinDash`
3. Create project folder
4. Click Create & Edit

### 2. Configure Window Settings

**Project, Project Settings, Display, Window:**

```md
Viewport Width: 480
Viewport Height: 720
Stretch/Mode: canvas_items
Stretch/Aspect: keep
Size/Resizable: OFF
```

### 3. Import Assets

- Download [`coin_dash_assets.zip`](https://drive.google.com/file/d/1M_xyTZIHBOEgc5kf3BSgMU0Mx5F4i0BC/view?usp=drive_link)
- Unzip into project folder
- Verify `res://assets/` contains player, coin, audio folders

**Common Pitfalls**

**Window too small?** Zoom viewport using View, Zoom In (Ctrl+Plus)  
**Assets not showing?** Check FileSystem panel, right-click, Reimport

## Part 1: Player Scene Architecture

**Design Decision: Why Area2D?**

We use `Area2D` as the root because the player needs:
- Collision detection (not physics response)
- Signal-based communication when overlapping coins/obstacles
- Manual movement control (not rigid body simulation)

### Scene Tree Structure

```md
Player (Area2D)
|-- AnimatedSprite2D
`-- CollisionShape2D
```

### Step-by-Step Build

**1. Create Root Node**

- Click Add/Create New Node (Ctrl+A)
- Search: `Area2D`
- Rename to `Player`
- Save scene (Ctrl+S): `player.tscn`

**2. Lock Children (CRITICAL)**

- Select `Player` node
- Click icon next to lock: Group Selected Node(s)
- Tooltip: Make selected node's children not selectable
- Icon appears next to Player name

**Common Pitfalls**

**Forgetting to group children causes:**
- Accidentally moving/scaling child nodes
- Misaligned collision shapes
- Hard-to-debug position offsets

**Always group immediately after creating root!**

**3. Add AnimatedSprite2D**

- Select Player, Add Child Node, `AnimatedSprite2D`
- Inspector, Frames: empty, New SpriteFrames
- Click the `SpriteFrames` text to open panel at bottom

**4. Configure Animations**

In SpriteFrames panel (bottom):

1. Rename default animation to `run`
2. Click Add Animation, create `idle`
3. Click Add Animation, create `hurt`
4. For each animation:
   - Navigate to `res://assets/player/` in FileSystem
   - Drag corresponding images into animation frames
   - Set Speed: 8 FPS
5. Select `idle`, click Autoplay on Load (play icon)

**5. Scale Sprite**

- Select `AnimatedSprite2D`
- Inspector, Transform, Scale: `(2, 2)`

**6. Add Collision Shape**

- Select Player, Add Child, `CollisionShape2D`
- Inspector, Shape: empty, New RectangleShape2D
- Drag orange handles to cover sprite
- Pro tip: Hold Alt while dragging for symmetric sizing

**7. Adjust Sprite Offset**

- Select `AnimatedSprite2D`
- Inspector, Offset: `(0, -5)`
- Reason: Centers collision shape on sprite's visual mass

## Part 2: Player Script

### Attach Script

- Select `Player` node
- Click Attach Script icon (scroll icon)
- Accept default path: `res://player.gd`
- Uncheck Template, Click Create

### Variable Declarations

**Architecture Note: Strong Typing**

GDScript supports optional static typing. This course requires type annotations for:
- All member variables
- All function parameters and return types

Benefits: Earlier error detection, better autocomplete, clearer intent.

```gdscript
extends Area2D

# Custom signals for decoupled communication
signal pickup
signal hurt

# Exported variables appear in Inspector
@export var speed: int = 350

# Internal state
var velocity: Vector2 = Vector2.ZERO
var screensize: Vector2 = Vector2(480, 720)
```

**Key Concepts:**

- `@export`: Makes variable Inspector-editable
- `signal`: Declares events this node can emit
- `Vector2.ZERO`: Shorthand for `Vector2(0, 0)`

### Movement Implementation

```gdscript
func _process(delta: float) -> void:
    # Get normalized input vector (-1 to 1 on each axis)
    velocity = Input.get_vector("ui_left", "ui_right", 
                                "ui_up", "ui_down")
    
    # Update position with delta-independent movement
    position += velocity * speed * delta
    
    # Clamp to screen boundaries
    position.x = clamp(position.x, 0, screensize.x)
    position.y = clamp(position.y, 0, screensize.y)
    
    # Animation state machine
    if velocity.length() > 0:
        $AnimatedSprite2D.animation = "run"
    else:
        $AnimatedSprite2D.animation = "idle"
    
    # Flip sprite based on horizontal direction
    if velocity.x != 0:
        $AnimatedSprite2D.flip_h = velocity.x < 0
```

**Design Pattern: Delta-Independent Movement**

**Why multiply by delta?**
- Godot targets 60 FPS (delta approximately 0.016s)
- Frame rate fluctuates due to CPU load
- speed times delta = pixels per second (frame-independent)
- Without delta: movement speed tied to frame rate

**Formula:** distance = velocity times time

### Game State Control

```gdscript
func start() -> void:
    """Reset player for new game."""
    set_process(true)
    position = screensize / 2
    $AnimatedSprite2D.animation = "idle"

func die() -> void:
    """Handle player death."""
    $AnimatedSprite2D.animation = "hurt"
    set_process(false)
```

**Architecture note:** `set_process(false)` disables `_process()` calls. Main scene controls lifecycle.

### Collision Detection Setup

```gdscript
func _on_area_entered(area: Area2D) -> void:
    if area.is_in_group("coins"):
        area.pickup()
        pickup.emit()
    if area.is_in_group("obstacles"):
        hurt.emit()
        die()
```

**Connecting the signal:**

1. Select `Player` node
2. Click Node tab (next to Inspector)
3. Find `area_entered` signal
4. Double-click, click Connect
5. Godot creates `_on_area_entered()` function

**Design Pattern: Groups for Type Checking**

Instead of checking node types directly:
- Use `is_in_group()` for flexible categorization
- Allows multiple objects in same group
- Decouples player from specific node types
- Easy to add new collectible/obstacle types

## Testing the Player

### Run the Scene

- Press F6 or click Run Current Scene
- Use arrow keys to move
- Verify sprite flips correctly
- Check animations switch (run/idle)

**Common Pitfalls**

**Player not moving?**
- Check `speed` value in Inspector
- Verify Input Map has ui_left/right/up/down actions
- Confirm `_process()` has correct spelling

**Player leaving screen?**
- Verify `screensize` matches window settings
- Check clamp() lines for typos

**Animation not playing?**
- Confirm Autoplay on Load is set for idle
- Check animation names match code exactly (case-sensitive)

## Complete Player Script

```gdscript
extends Area2D

signal pickup
signal hurt

@export var speed: int = 350

var velocity: Vector2 = Vector2.ZERO
var screensize: Vector2 = Vector2(480, 720)


func _process(delta: float) -> void:
    velocity = Input.get_vector("ui_left", "ui_right",
                                "ui_up", "ui_down")
    position += velocity * speed * delta
    position.x = clamp(position.x, 0, screensize.x)
    position.y = clamp(position.y, 0, screensize.y)
    
    if velocity.length() > 0:
        $AnimatedSprite2D.animation = "run"
    else:
        $AnimatedSprite2D.animation = "idle"
    
    if velocity.x != 0:
        $AnimatedSprite2D.flip_h = velocity.x < 0


func start() -> void:
    set_process(true)
    position = screensize / 2
    $AnimatedSprite2D.animation = "idle"


func die() -> void:
    $AnimatedSprite2D.animation = "hurt"
    set_process(false)


func _on_area_entered(area: Area2D) -> void:
    if area.is_in_group("coins"):
        area.pickup()
        pickup.emit()
    if area.is_in_group("obstacles"):
        hurt.emit()
        die()
```

## Architecture Review

### What We Built

- Self-contained player object (scene composition)
- Signal-based communication (decoupling)
- State control via lifecycle methods (start/die)
- Group-based collision detection (flexibility)

### Key Takeaways

1. **Modularity:** Player scene works independently, testable in isolation
2. **Separation of Concerns:** Movement logic separate from collision handling
3. **Extensibility:** Easy to add new animations or collision types
4. **Type Safety:** Strong typing catches errors at edit-time

### Next Session Preview

- Build Coin scene with pickup behavior
- Create Main scene with spawning system
- Implement HUD with signal-driven updates
- Complete game loop architecture

---

*This activity is to be accomplished in class.*