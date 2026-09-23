---
title: When Storage Exists
subtitle: CMSC 124 Activity 8
lead: Track the name, the cell, and the lifetime separately.
published: 2026-09-21
deadline: 2026-09-25
tags: [cmsc-124]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
isDraft: false
diagrams:
  - title: One identifier, one cell, one object
    key: identifier-reference-object
    description: Three separate things with three separate lifetimes, taken one at a time.
    steps:
      - title: The identifier names a cell
        description: The identifier `box` is a name in the source text. What it names is one stack cell, created when the call begins.
        mermaid: |
          flowchart LR
              ID["identifier<br/>box"] -->|names| CELL["stack cell<br/>contents not set yet"]
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef pending fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class ID current
              class CELL pending
      - title: The cell holds a reference
        description: After `new` runs, the cell contains a reference written H1. The reference is a value stored in the cell, not the object itself.
        mermaid: |
          flowchart LR
              ID["identifier<br/>box"] -->|names| CELL["stack cell<br/>holds H1"]
              classDef done fill:#dcfce7,stroke:#16a34a,color:#111827
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class ID done
              class CELL current
      - title: The reference reaches the object
        description: H1 is a third thing, sitting on the heap with its own lifetime. A second identifier can hold the same reference, and then both reach the one object.
        mermaid: |
          flowchart LR
              ID["identifier<br/>box"] -->|names| CELL["stack cell<br/>holds H1"]
              AL["identifier<br/>alias"] -->|names| CELL2["stack cell<br/>holds H1"]
              CELL -->|reaches| OBJ["heap object H1<br/>value 1"]
              CELL2 -->|reaches| OBJ
              classDef done fill:#dcfce7,stroke:#16a34a,color:#111827
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class ID,AL,CELL,CELL2 done
              class OBJ current
  - title: Storage begins and ends at different events
    key: storage-lifetime
    description: The variable cells and the heap object are separate entities even when the variables contain references to that object.
    steps:
      - title: Allocate static storage
        description: "`total` exists before the call and begins with value 1."
        mermaid: |
          flowchart LR
              TOTAL["static total<br/>value 1"]
              classDef live fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class TOTAL live
      - title: Enter the call and allocate the object
        description: The call creates stack cells. `box` and `alias` contain references to one heap object.
        mermaid: |
          flowchart LR
              TOTAL["static total<br/>value 1"]
              READING["stack reading<br/>value 4"]
              DELTA["stack delta<br/>value 3"]
              BOX["stack box<br/>reference H1"] --> H1["heap H1<br/>Cell.value = 1"]
              ALIAS["stack alias<br/>reference H1"] --> H1
              classDef live fill:#dcfce7,stroke:#16a34a,color:#111827
              class TOTAL,READING,DELTA,BOX,ALIAS,H1 live
      - title: Delete the object, not the references
        description: "`delete box` ends H1's lifetime. The two stack cells still contain H1's address and are dangling until return."
        mermaid: |
          flowchart LR
              TOTAL["static total<br/>value 4"]
              READING["stack reading<br/>value 4"]
              DELTA["stack delta<br/>value 3"]
              BOX["stack box<br/>dangling H1"] -.-> H1["heap H1<br/>deallocated"]
              ALIAS["stack alias<br/>dangling H1"] -.-> H1
              classDef live fill:#dcfce7,stroke:#16a34a,color:#111827
              classDef dead fill:#fee2e2,stroke:#dc2626,stroke-width:3px,color:#111827
              class TOTAL,READING,DELTA live
              class BOX,ALIAS,H1 dead
      - title: Return from the call
        description: The stack cells disappear. Static `total` remains with value 4; H1 remains deallocated.
        mermaid: |
          flowchart LR
              TOTAL["static total<br/>value 4"]
              H1["heap H1<br/>deallocated"]
              classDef live fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              classDef dead fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class TOTAL live
              class H1 dead
  - title: Read the two sides of an assignment
    key: lvalue-rvalue
    description: The assignment first finds the target cell on the left, then reads the value produced on the right.
    steps:
      - title: Find the l-value on the left
        description: In `box = alias`, the left occurrence of `box` identifies the stack cell that the assignment will update.
        mermaid: |
          flowchart LR
              SOURCE["box = alias"] --> LEFT["left side: box"] --> CELL["l-value<br/>box's stack cell"]
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class CELL current
      - title: Read the r-value on the right
        description: The right occurrence of `alias` reads H1 from its cell. The assignment copies H1 into `box`'s cell.
        mermaid: |
          flowchart LR
              SOURCE["box = alias"] --> RIGHT["right side: alias"] --> VALUE["r-value<br/>reference H1"] --> CELL["box's stack cell<br/>now holds H1"]
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class VALUE,CELL current
  - title: Copy a reference past return
    key: returned-reference-transfer
    description: The reference value crosses the return boundary while the local stack cell ends with its call.
    steps:
      - title: Create H3 and store its reference in temp
        description: "`new Cell(7)` allocates H3. The local cell `temp` contains reference H3 and reaches that object."
        mermaid: |
          flowchart LR
              KEPT["static kept<br/>uninitialized"]
              TEMP["stack temp<br/>reference H3"] --> H3["heap H3<br/>Cell.value = 7"]
              RETURN["return value<br/>not set"]
              KEPT ~~~ TEMP
              TEMP ~~~ RETURN
              RETURN ~~~ H3
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef pending fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class TEMP,H3 current
              class KEPT,RETURN pending
      - title: Evaluate return temp
        description: "The return expression reads reference H3 from `temp`. The separate return value now preserves that reference."
        mermaid: |
          flowchart LR
              KEPT["static kept<br/>uninitialized"]
              TEMP["stack temp<br/>reference H3"] --> H3["heap H3<br/>Cell.value = 7"]
              RETURN["return value<br/>reference H3"] --> H3
              KEPT ~~~ TEMP
              TEMP ~~~ RETURN
              classDef live fill:#dcfce7,stroke:#16a34a,color:#111827
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef pending fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class TEMP,H3 live
              class RETURN current
              class KEPT pending
  - title: After return, kept reaches H3
    key: returned-reference-after-return
    description: The final frame keeps the same four entities visible and marks the two values that no longer exist.
    steps:
      - title: Return, then assign to kept
        description: "Return deallocates `temp`. The caller writes reference H3 into `kept`, which becomes the one remaining access path."
        mermaid: |
          flowchart LR
              KEPT["static kept<br/>reference H3"] --> H3["heap H3<br/>Cell.value = 7"]
              TEMP["stack temp<br/>deallocated"]
              RETURN["return value<br/>copied into kept"]
              KEPT ~~~ TEMP
              TEMP ~~~ RETURN
              RETURN ~~~ H3
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef dead fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class KEPT,H3 current
              class TEMP,RETURN dead
---

The identifier `box`, its stored reference, and the heap object reached through that reference aren't the same thing. Today you'll put each one on a timeline. The program's behavior becomes easier to trace once every storage cell and object has a clear beginning and end.

In this activity's pseudocode, `new Cell(v)` allocates one `Cell` object on the heap, sets its `value` field to `v`, and returns a reference to that object. The reference is a value that another variable can copy, pointing to the same object.

The figures below separate them one at a time.

<!-- diagram: identifier-reference-object -->

The programs here are pseudocode, written to be read. Every rule they depend on is on this page.

You have 60 minutes for the two checkpoints. Keep each worked example beside the checkpoint it supports. Discussion with classmates and the instructor is allowed and encouraged throughout. This activity is worth 10 points: six for the lifetime construction, four for the rules that explain it.

## The Storage Rules

A **binding** connects an entity to an attribute. An identifier can be bound to a type, a storage cell, or a value. **Binding time** is when that connection is chosen. In today's pseudocode, variable types are fixed when the program is translated, while each call's local cells are bound at run time.

Those two don't cover every option. A binding can be settled at six common moments:

| Binding time | The connection is chosen when | Example |
|---|---|---|
| Language design time | The language itself is specified | `*` is the multiplication operator |
| Language implementation time | The compiler or interpreter is built | `int` gets its range of representable values |
| Compile time | The source is translated | `delta` is fixed as an integer variable |
| Link time | Separately translated pieces are joined | A call to a library routine finds that routine's code |
| Load time | The program is placed in memory | `total` receives the address of its static cell |
| Run time | The program is executing | `box` receives the address that `new` returned |

The earlier the binding, the less work remains for run time and the less the program can change while running. That trade drives most of the storage decisions below.

When the program executes `record(3)`, it **calls** the function `record` with argument `3`. That call begins when control enters `record` and returns when control leaves it. Each call gets fresh cells for its parameter and local variables.

The `delete box` operation follows the reference stored in `box` and deallocates the reached heap object. It leaves all reference values unchanged, including the value still stored in `box`.

Use these storage categories:

| Category | Allocation | Deallocation |
|---|---|---|
| Static | Before execution | When the program ends |
| Stack-dynamic | When a call begins | When that call returns |
| Explicit heap-dynamic | When `new` runs | When `delete` runs |

The labels **l-value** and **r-value** come from the two sides of an assignment. Read them literally. In `box = alias`, the left side needs the l-value of `box`, which identifies the cell to update. The right side needs the r-value of `alias`, which is the value read from that cell.

<!-- diagram: lvalue-rvalue -->

Two references are **aliases** when they reach the same object. An access that still points to a deallocated object is **dangling**. An object is **reachable** while some live access path leads to it. Under **explicit ownership**, the program must decide which code eventually deallocates each heap object.

### Named Constants

A **named constant** is an identifier bound to a value once and never rebound. Its binding time determines whether the running program needs a storage cell for it.

```
static MAX = 100
static START = clock()
```

The translator can bind `MAX` at compile time because its value appears in the source. It can substitute 100 wherever `MAX` occurs and omit the cell. `START` depends on a run-time clock reading, so the program needs a cell for that value. Neither constant can be rebound after its first value is chosen.

### Worked Example for Checkpoint 1

*Suggested time: 38 minutes, including the worked example.*

Trace one call in this smaller case:

```
static total = 1

inspect(reading):
    delta = reading - total
    box = new Cell(1)
    alias = box
    total = reading
    delete box

inspect(4)
```

| Event | Static storage | Stack storage | Heap storage |
|---|---|---|---|
| program begins | `total = 1` allocated | none | none |
| `inspect(4)` begins | `total = 1` | allocate `reading = 4`, uninitialized `delta`, `box`, and `alias` | none |
| `delta = reading - total` | unchanged | `delta = 3` | none |
| `new Cell(1)` | unchanged | `box` receives reference H1 | H1 allocated with `value = 1` |
| `alias = box` | unchanged | both reference cells contain H1 | H1 still exists once |
| `total = reading` | `total = 4` | unchanged | unchanged |
| `delete box` | unchanged | `box` and `alias` contain dangling references | H1 deallocated |
| return | `total = 4` remains | all call cells deallocated | H1 remains dead |

The l-value of `box` is its stack cell. Its r-value after `new` is reference H1. H1 is a third object with its own lifetime. The rule says `delete` deallocates the reached heap object. It doesn't clear every reference that holds that address.

Erasing `alias` when `delete box` runs would require the runtime to find and rewrite all aliases, which isn't part of this language's contract. `alias` dangles from the deletion until the call returns.

The four figures below show one program at four moments. A box appears when its
storage is allocated and turns red when that storage becomes invalid.

<!-- diagram: storage-lifetime -->

### Checkpoint 1: Build the Lifetime Timeline (6 Points)

#### Running Case

Execute this pseudocode in a language with explicit heap deallocation:

```
static visits = 0

record(reading):
    delta = reading - visits
    box = new Cell(delta)
    alias = box
    visits = reading
    delete box

record(3)
record(8)
```

`Cell(v)` creates a heap object whose field `value` starts as `v`. Assigning `alias = box` copies the reference. Both variables then reach the same object. `delete box` deallocates that object. It doesn't rewrite either reference variable.

Apply these storage rules to the complete program above. `visits` is allocated before execution and lives until program end. Each parameter and local cell is allocated on call entry and deallocated on return. Each `Cell` object is allocated by `new` and deallocated by `delete`.

**1. (Construction: 4 points)** Draw a timeline for `visits`, both `reading` cells, both `delta` cells, the two `box` and `alias` pairs, and both heap objects. Mark allocation, every value change, deallocation, and each call return. Show the value of `visits` at every marked event.

**2. (Explanation: 2 points)** Answer both parts.

a. Classify each item as static, stack-dynamic, or explicit heap-dynamic, then explain why `box` and the object it reaches have different lifetimes.

b. Give the exact interval during which `alias` is dangling, with the event that starts it and the event that ends it.


<!-- newpage -->

## Copy a Reference Past Return

### Worked Example for Checkpoint 2

*Suggested time: 22 minutes, including the worked example.*

Trace this complete program:

```
static kept

make():
    temp = new Cell(7)
    return temp

kept = make()
```

Follow the events in execution order:

1. `new Cell(7)` allocates H3, and the local cell `temp` receives reference H3.
2. `return temp` reads H3 from `temp` and makes that reference the function's return value.
3. Returning from `make` deallocates its stack cells, including `temp`.
4. The assignment writes the returned reference into the static cell `kept`.

<!-- diagram: returned-reference-transfer -->

<!-- newpage -->

<!-- diagram: returned-reference-after-return -->

The reference value crosses the return boundary. The local cell does not. After the assignment, `kept` reaches H3 even though `temp` no longer exists.

### Checkpoint 2: Follow the Returned Reference (4 Points)

Use this modified program. It has one call and does not execute `delete`:

```
static visits = 0
static saved

record(reading):
    delta = reading - visits
    box = new Cell(delta)
    alias = box
    visits = reading
    return alias

saved = record(3)
```

Trace these events in order: allocation of H1, the copy into `alias`, evaluation of `return alias`, stack deallocation, and assignment to `saved`.

**1. (Construction: 2 points)** Redraw only the end of the first call. Show which stack cells disappear, which heap object remains, and what l-value and r-value belong to `saved`.

**2. (Explanation: 2 points)** Explain why returning the reference doesn't extend the stack lifetime of `alias`, yet still makes H1 reachable. State who must eventually deallocate H1 in this language.

End with H1 and the single live access path `saved -> H1` on the same timeline. The static cell `saved` is the l-value, and reference H1 is its stored r-value. The owner of `saved` must eventually deallocate H1 because reachability doesn't provide automatic ownership.
