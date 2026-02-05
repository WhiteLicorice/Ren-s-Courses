---
title: Coin Dash Pt. 3
subtitle: CMSC 197 GDD Activity 4
lead: Building the HUD.
published: 2026-02-06
tags: [cmsc-197-gdd]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
downloadLink: https://drive.google.com/file/d/12EvPHx4lyc1YaxQfx86HLOAnXrKgMOLx/view?usp=drive_link
isDraft: false
noDeadline: true
---

## Session Objectives

* Build HUD using Control nodes and containers
* Implement signal-driven UI updates
* Create title screen with menu state management
* Add sound effects for game events
* Complete full game loop with restart capability

## Part 1: HUD Scene

The HUD displays score, timer, and messages during gameplay.

### Scene Structure

**Node Hierarchy:**
```gdscript
HUD (CanvasLayer)
|-- Timer
|-- MarginContainer
|   |-- Score (Label)
|   `-- Time (Label)
|-- Message (Label)
`-- StartButton (Button)

```

### Build Steps

**1. Create Root and Timer**

* New scene, root: `CanvasLayer` named `HUD`
* Add `Timer` child
* Timer: Wait Time = 2, One Shot = On

#### Design Decision: CanvasLayer

`CanvasLayer` renders UI above game objects regardless of camera position. Essential for HUDs that stay fixed on screen.

**2. Score and Time Display**

* Add `MarginContainer`
* Layout: Top Wide
* Theme Overrides/Constants: Right = 10, Left = 10, Top = 10, Bottom = 10
* Add two `Label` children: `Score` and `Time`

**3. Configure Score/Time Labels**

* Score: Text = "0", Horizontal Alignment = Left
* Time: Text = "0", Horizontal Alignment = Right
* Both: Vertical Alignment = Center
* Both: Label Settings, New LabelSettings
* Font: `res://assets/Kenney Bold.ttf`
* Size: 48
* Outline: Size = 16, Color = black

#### Common Pitfalls

**Font not appearing?**

* Verify font file in assets folder
* Check LabelSettings is actually assigned (not just created)
* Confirm Size is set (default 16 is too small)

**4. Message Label**

* Add `Label` to HUD root named `Message`
* Layout: Center Wide
* Text: "Coin Dash!"
* Horizontal Alignment: Center
* Label Settings: Same font, Size = 72

**5. Start Button**

* Add `Button` to HUD root named `StartButton`
* Layout: Center Bottom
* Text: "Start"
* Label Settings: Same font, Size = 48

### HUD Script

```gdscript
extends CanvasLayer

signal start_game


func update_score(value: int) -> void:
    $MarginContainer/Score.text = str(value)


func update_timer(value: int) -> void:
    $MarginContainer/Time.text = str(value)


func show_message(text: String) -> void:
    $Message.text = text
    $Message.show()
    $Timer.start()


func _on_timer_timeout() -> void:
    $Message.hide()


func _on_start_button_pressed() -> void:
    $StartButton.hide()
    $Message.hide()
    start_game.emit()


func show_game_over() -> void:
    show_message("Game Over")
    await $Timer.timeout
    $StartButton.show()
    $Message.text = "Coin Dash!"
    $Message.show()

```

#### Design Pattern: Async UI Flow

`await $Timer.timeout` pauses execution until the timer signal fires. This creates a clean sequence:

1. Show "Game Over" (2 seconds via timer)
2. Timer fires timeout
3. Show title and start button

Without `await`, all steps execute instantly.

**Connect Signals:**

* Timer `timeout` to `_on_timer_timeout`
* StartButton `pressed` to `_on_start_button_pressed`

## Part 2: Integrate HUD with Main

### Add HUD to Main

* Open `main.tscn`
* Add instance of `hud.tscn`

### Update Main Script

**Connect HUD start_game signal:**

* Select HUD instance
* Node tab, find `start_game` signal
* Connect to `new_game` method in Main

**Update new_game:**

```gdscript
func new_game() -> void:
    playing = true
    level = 1
    score = 0
    time_left = playtime
    
    $HUD.update_score(score)
    $HUD.update_timer(time_left)
    $HUD.show_message("Get Ready!")
    
    $Player.start()
    $Player.show()
    
    await $HUD/Timer.timeout
    $GameTimer.start()
    spawn_coins()

```

**Update _on_game_timer_timeout:**

```gdscript
func _on_game_timer_timeout() -> void:
    time_left -= 1
    $HUD.update_timer(time_left)
    if time_left <= 0:
        game_over()

```

**Update game_over:**

```gdscript
func game_over() -> void:
    playing = false
    $GameTimer.stop()
    get_tree().call_group("coins", "queue_free")
    $HUD.show_game_over()
    $Player.die()

```

**Update _on_player_pickup:**

```gdscript
func _on_player_pickup(type: String) -> void:
    match type:
        "coin":
            score += 1
            $HUD.update_score(score)
        "powerup":
            time_left += 5
            $HUD.update_timer(time_left)

```

**Update _process for level advancement:**

```gdscript
func _process(delta: float) -> void:
    if not playing:
        return
    
    if get_tree().get_nodes_in_group("coins").size() == 0:
        level += 1
        time_left += 5
        $HUD.update_timer(time_left)
        $HUD.show_message("Level %s" % level)
        spawn_coins()

```

## Part 3: Sound Effects

Add `AudioStreamPlayer` nodes to play sounds for game events.

### Add to Main Scene

* Add 3 `AudioStreamPlayer` nodes to Main
* Names: `CoinSound`, `LevelSound`, `EndSound`
* Drag audio files from `res://assets/audio/`:
* CoinSound: `Coin.wav`
* LevelSound: `Level.wav`
* EndSound: `EndSound.wav`
* PowerupSound: `PowerupSound.wav`
* HitSound: `Hit.wav`



#### Audio Best Practices

* Use `.wav` for short effects (better loop points)
* Use `.ogg` for longer sounds/music (smaller file size)
* Adjust Volume dB if too loud (try -10 to start)

### Trigger Sounds in Code

**In _on_player_pickup:**

```gdscript
func _on_player_pickup(type: String) -> void:
    match type:
        "coin":
            $CoinSound.play()
            score += 1
            $HUD.update_score(score)
        "powerup":
            time_left += 5
            $HUD.update_timer(time_left)
            $PowerupSound.play()

```

**In _process (level up):**

```gdscript
if get_tree().get_nodes_in_group("coins").size() == 0:
    level += 1
    time_left += 5
    $LevelSound.play()
    $HUD.update_timer(time_left)
    $HUD.show_message("Level %s" % level)
    spawn_coins()

```

**In game_over:**

```gdscript
func game_over() -> void:
    playing = false
    $GameTimer.stop()
    $EndSound.play()
    get_tree().call_group("coins", "queue_free")
    $HUD.show_game_over()
    $Player.die()

```

## Part 4: Visual Polish

### Coin Animation Shimmer

Add Timer to Coin scene for randomized animation start.

**Update coin.gd:**

```gdscript
func _ready() -> void:
    $Lifetime.wait_time = randf_range(3, 8)
    $Lifetime.start()


func _on_lifetime_timeout() -> void:
    $AnimatedSprite2D.frame = 0
    $AnimatedSprite2D.play()

```

**Configure AnimatedSprite2D:**

* Animation Looping: Off
* Speed: 12 FPS

**Connect Lifetime signal:**

* Connect `timeout` to `_on_lifetime_timeout`

### Obstacles

Create obstacles that end the game when touched.

**Scene Setup:**

```
Obstacle (Area2D)
|-- Sprite2D
`-- CollisionShape2D

```

**Configuration:**

* Sprite2D: Texture = `res://assets/cactus.png`
* CollisionShape2D: RectangleShape2D covering sprite
* Layer: `obstacles` (layer 3)
* Mask: `player`
* Node Tab, Groups: Add `obstacles`

**No script needed** -- player already checks for obstacles group.

**Add to Main:**

* Add instance to Main scene
* Position manually in viewport

### Coin/Powerup Overlap Prevention

Prevent spawning on obstacles.

**Update coin.gd and powerup.gd:**

```gdscript
func _on_area_entered(area: Area2D) -> void:
    if area.is_in_group("obstacles"):
        position = Vector2(
            randi_range(0, screensize.x),
            randi_range(0, screensize.y)
        )

```

**Connect signals:**

* Coin/Powerup `area_entered` to `_on_area_entered`

## Testing Checklist

### HUD

* Score updates when collecting coins
* Timer counts down every second
* "Get Ready" message displays at game start
* "Game Over" message displays, then shows menu
* Start button restarts game

### Audio

* Coin sound plays on collection
* Level up sound plays when advancing
* Game over sound plays on death/timeout

### Polish

* Coins shimmer at random intervals
* Obstacles prevent coin spawning on top
* Hitting obstacle ends game

#### Common Pitfalls

**Common issues:**

* HUD not updating: Check signals connected correctly
* Sounds not playing: Verify audio files imported
* Start button doesn't work: Check signal emits to `new_game`
* Coins still spawn on obstacles: Verify area_entered connected

## Complete Main Script

```gdscript
extends Node

@export var coin_scene: PackedScene
@export var powerup_scene: PackedScene
@export var playtime: int = 30

var level: int = 1
var score: int = 0
var time_left: int = 0
var screensize: Vector2 = Vector2.ZERO
var playing: bool = false


func _ready() -> void:
    screensize = get_viewport().get_visible_rect().size
    $Player.screensize = screensize
    $Player.hide()


func new_game() -> void:
    playing = true
    level = 1
    score = 0
    time_left = playtime
    
    $HUD.update_score(score)
    $HUD.update_timer(time_left)
    $HUD.show_message("Get Ready!")
    
    $Player.start()
    $Player.show()
    
    await $HUD/Timer.timeout
    $GameTimer.start()
    spawn_coins()


func spawn_coins() -> void:
    for i in level + 4:
        var coin := coin_scene.instantiate()
        add_child(coin)
        coin.screensize = screensize
        coin.position = Vector2(
            randi_range(0, screensize.x),
            randi_range(0, screensize.y)
        )


func _process(delta: float) -> void:
    if not playing:
        return
    
    if get_tree().get_nodes_in_group("coins").size() == 0:
        level += 1
        time_left += 5
        $LevelSound.play()
        $HUD.update_timer(time_left)
        $HUD.show_message("Level %s" % level)
        spawn_coins()


func _on_game_timer_timeout() -> void:
    time_left -= 1
    $HUD.update_timer(time_left)
    if time_left <= 0:
        game_over()


func game_over() -> void:
    playing = false
    $GameTimer.stop()
    $EndSound.play()
    get_tree().call_group("coins", "queue_free")
    $HUD.show_game_over()
    $Player.die()


func _on_player_pickup(type: String) -> void:
    match type:
        "coin":
            $CoinSound.play()
            score += 1
            $HUD.update_score(score)
        "powerup":
            time_left += 5
            $HUD.update_timer(time_left)
            $PowerupSound.play()

```

## Architecture Review

### What We Built

* Container-based UI layout system
* Signal-driven state management (menu/game/gameover)
* Async UI flows using await
* Audio integration for game events
* Complete game loop with restart

### Key Takeaways

1. **Containers:** Automatic layout beats manual positioning
2. **CanvasLayer:** Decouples UI from game world
3. **Await:** Clean async sequencing without explicit timing
4. **Groups:** Flexible object categorization and batch operations

### Extension Ideas

* High score persistence (file I/O)
* Multiple obstacle types
* Particle effects on coin collection
* Camera shake on game over
