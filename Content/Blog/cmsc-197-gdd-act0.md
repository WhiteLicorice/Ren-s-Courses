---
title: Link, Start!
subtitle: CMSC 197 GDD Act 0
lead: GDQuest on.
published: 2026-01-19
tags: [cmsc-197-gdd]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
downloadLink: https://drive.google.com/file/d/1IW6tVZdhn-T2pshkvOopZEu99ip0xtY2/view?usp=drive_link
isDraft: true
---

Welcome to the special topics elective **Game Design and Development (GDD)**. Since we will be using **Godot** for this course, and for most people (if not all) this course will be their first time encountering Godot or even a game engine of any kind, your first laboratory activity is a simple introduction to Godot to get your feet wet. You are tasked to **accomplish the free, interactive GDQuest course** found [on their website](https://gdquest.github.io/learn-gdscript/).

## Overview

The Godot engine provides its own tightly integrated scripting language, **GDScript**. We will be using GDScript for most of the course. However, since Godot allows interfacing with other languages like Python, C#, C++, brave souls may later on in the semester experiment with using these languages for Godot.

GDscript is an **interpreted statically dynamically typed** language. That is, variables are dynamically typed by default (think: Python). The type of a variable is inferred (type inference) during first assignment. Future reassignment to another type is allowed. However, Godot provides **typehints** (think: Kotlin) that renders the type of a variable static across its lifetime. A typehinted variable being reassigned or coerced to be that of the wrong type will throw a `ParseError`. It then becomes possible to **mix both static and dynamic typing** in GDScript. For this course, it is **mandatory to typehint all method and function signatures, as well as class members**, for easier development. Typehint variables as necessary for clarity and to insist on strict typing, especially during collaborative work (this is how you enforce your will over other devs!).

GDScript follows Python conventions for naming methods, classes, and variables, as it is a Python dialect. Methods and variables must be in `snake_case`. Classes must be in `PascalCase`. Private class members must be prefixed with an underscore, like so: `_private_var`. Like Python, GDScript does not have a true `private` access modifier. In GDScript, source code is named in `lower_snake_case` format, with the exception of source code in other languages like C#, which must adhere to the other language's conventions. In the case of C#, source code must be named after the `ClassName` it contains in `PascalCase`.

The following is an example of valid code in GDScript.

```gdscript
const PI_CONST = 3.14   # Cannot change const variable PI_CONST.
var radius: float = 2.0 # The var variable radius is always a float.
func get_area_of_circle(r: float) -> float:
    # The var variable area's type is inferred to be float.
    var area = PI_CONST * r ** 2
    return area
```

## Task

Your task is to accomplish **all 27 sections of the GDQuest course** in order. Remember to take screenshots of **accomplishing each exercise** in the course. You will **compile these screenshots in a folder** as you work for later submission. Do not forget to take **a screenshot of the final screen in the course**. You will be scored according to the completeness and organization of the screenshots you provide.

## Laboratory Defense

No laboratory defense is expected for this activity, but you must accomplish the task and submit on or before **our next meeting**. In this course, it is your responsibility to keep abreast of deadlines and pending coursework.

## In the Future

Since the course does not offer a lecture component, GDD will be comprised of interactive in-class activities and challenging take-home machine problems. Thus, you are encouraged to procure **a laptop that you will bring in attendance**. You must install [Godot](https://godotengine.org/) beforehand (stable release) and verify that it works on your machine. Consult the [Godot System Requirements](https://docs.godotengine.org/en/stable/about/system_requirements.html) to see if your device meets **minimum system requirements** for the **compatibility** setting (don't worry: Godot is lighter than Unity, and Godot runs on potatoes!). However, if no device is available to you or your device does not meet minimum system requirements, you may use the machines in the computer laboratory where we will be holding class. Good luck, and see you on the other side!

---

*See the [laboratory manual](https://drive.google.com/file/d/1IW6tVZdhn-T2pshkvOopZEu99ip0xtY2/view?usp=drive_link) for submission requirements.*