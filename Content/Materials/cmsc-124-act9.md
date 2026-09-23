---
title: Follow the Name
subtitle: CMSC 124 Activity 9
lead: Resolve one reference through two different lookup paths.
published: 2026-09-24
deadline: 2026-09-25
tags: [cmsc-124]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
isDraft: false
diagrams:
  - title: The same reference follows two lookup paths
    key: scope-lookup-comparison
    description: Static scope follows definitions in the source. Dynamic scope follows active callers.
    steps:
      - title: Follow the static lookup path
        description: "`show` is defined inside `scope`, so lookup finds `scope.rate = 20`. The sibling `invoke` is not a textual parent."
        mermaid: |
          flowchart LR
              SHOW["show()<br/>use rate"] --> SCOPE["scope()<br/>rate = 20"] --> GLOBAL["global<br/>rate = 10"]
              INVOKE["invoke()<br/>rate = 30"]
              INVOKE -. "active caller, not textual parent" .-> SHOW
              classDef chosen fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef rejected fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class SCOPE chosen
              class INVOKE rejected
      - title: Follow the dynamic lookup path
        description: "`invoke` called `show`, so its live `rate = 30` is the first matching declaration. `scope` and the global block remain later on the path."
        mermaid: |
          flowchart LR
              SHOW["show()<br/>use rate"] --> INVOKE["invoke()<br/>rate = 30"] --> SCOPE["scope()<br/>rate = 20"] --> GLOBAL["global<br/>rate = 10"]
              classDef chosen fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef later fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class INVOKE chosen
              class SCOPE,GLOBAL later
  - title: Moving a definition changes one lookup path
    key: moved-definition-trace
    description: Moving `show` changes its textual parent while the active caller stays `invoke`.
    steps:
      - title: Record both relationships before the move
        description: "Before the move, `scope` is the textual parent of `show`, while `invoke` is its active caller."
        mermaid: |
          flowchart LR
              SHOW["show()<br/>use rate"] -->|"textual parent"| SCOPE["scope()<br/>rate = 20"] --> GLOBAL["global<br/>rate = 10"]
              INVOKE["invoke()<br/>rate = 30"] -. "active caller" .-> SHOW
              classDef textual fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef caller fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class SCOPE textual
              class INVOKE caller
      - title: Move only the definition
        description: "After the move, `global` is the textual parent of `show`. The call from `invoke` stays in place."
        mermaid: |
          flowchart LR
              SHOW["show()<br/>use rate"] -->|"new textual parent"| GLOBAL["global<br/>rate = 10"]
              SHOW -. "dynamic path" .-> INVOKE["invoke()<br/>rate = 30"] -.-> SCOPE["scope()<br/>rate = 20"] -.-> GLOBAL
              classDef textual fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef caller fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class GLOBAL textual
              class INVOKE caller
      - title: Resolve the two paths again
        description: "Static lookup now selects global `rate = 10`. Dynamic lookup still selects `invoke.rate = 30`."
        mermaid: |
          flowchart TB
              subgraph STATIC["Static lookup"]
                  direction LR
                  SS["show()<br/>use rate"] --> SG["global<br/>rate = 10"]
              end
              subgraph DYNAMIC["Dynamic lookup"]
                  direction LR
                  DS["show()<br/>use rate"] --> DI["invoke()<br/>rate = 30"] --> DC["scope()<br/>rate = 20"] --> DG["global<br/>rate = 10"]
              end
              classDef chosen fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef later fill:#f3f4f6,stroke:#9ca3af,color:#6b7280
              class SG,DI chosen
              class DC,DG later
---

When three active blocks all declare `x`, the rule `use the nearest one` isn't complete. Nearest in the source and nearest in the active call chain can be different places. Today you'll build both lookup paths before allowing the program to print anything.

The programs here are pseudocode. They're written to be read. Every rule they depend on is on this page. Laboratory Activity 4 is where these paths become code, since the chained environments that activity asks for implement the lookup paths you build today.

You have 60 minutes for the three checkpoints. Keep each worked example beside the checkpoint it supports. Discussion with classmates and the instructor is allowed and encouraged throughout. This activity is worth 16 points. Nine points reward scope constructions, and seven reward explanations.

A declaration's **scope** is the region where its identifier may be used. Its **lifetime** is the time when its storage exists. **Shadowing** happens when a nearer declaration hides another declaration of the same identifier.

Under **static scope**, also called lexical scope, lookup follows textual nesting: current block, enclosing block, then the next enclosing block. A **textual parent** is the surrounding block where a procedure is defined. Under **dynamic scope**, lookup follows active calls: current call, caller, caller's caller, and so on. An **active caller** is the procedure whose unfinished call invoked the current one.

A **lookup path** lists the scopes that one rule can check, in order. Lookup stops at the first matching declaration. A **referencing environment** contains the variable bindings visible at one program point after lookup resolves shadowing. Shadowed variables and procedure declarations don't enter that environment.

### Worked Example for Checkpoint 1

*Suggested time: 32 minutes, including the worked example.*

Indentation shows textual nesting:

```
rate = 10

scope():
    rate = 20

    show():
        print(rate)

    invoke():
        rate = 30
        show()

    invoke()

scope()
```

At `print`, all three `rate` cells are alive. Static lookup checks `show`, then its textual parent `scope`, where it finds 20. Dynamic lookup checks the active call `show`, then its caller `invoke`, where it finds 30. The two rules therefore print different values even though the active runtime state is the same.

Write the complete lookup path before selecting a variable. Then stop at the first matching `rate` and place only that binding in the referencing environment.

| Rule | Complete lookup path for `rate` | First match | Referencing environment at `print` |
|---|---|---|---|
| static | `show -> scope -> global` | `scope.rate = 20` | `scope.rate = 20` |
| dynamic | `show -> invoke -> scope -> global` | `invoke.rate = 30` | `invoke.rate = 30` |

The path records where lookup could proceed. The environment records what the statement can use. Global `rate` is shadowed under both rules, so it appears on each complete path but in neither environment.

The governing question is which path determines proximity. Choosing 30 for static lookup because `invoke` made the call follows the dynamic path under the wrong label. Sibling procedures don't become textual parents when one calls the other.

The two figures below are the same program point under the two rules. Only the
lookup path changes.

<!-- diagram: scope-lookup-comparison -->

### Checkpoint 1: Build Both Paths (8 Points)

#### Running Case

Use this pseudocode. Indentation shows which procedures are textually nested.

```
x = 1

outer():
    x = 2

    target():
        y = 4
        print(x + y)

    caller():
        x = 3
        target()

    caller()

outer()
```

Build each lookup path before selecting a declaration. Then record only the selected variables in the referencing environment. Two different things can stop a live declaration from being chosen.

A declaration can be alive but hidden. Global `x = 1` is alive the whole time, but under static scope `outer`'s `x = 2` sits nearer and hides it.

A declaration can be alive but off the path entirely. `caller`'s `x = 3` is alive at `print`, yet the static path out of `target` never passes through `caller`, so static lookup never reaches it.

At the `print` call, all three assignments to `x` have executed and their storage still exists.

**1. (Construction: 5 points)** Write the complete static lookup paths for `x` and `y`, and mark each first match. Record the selected bindings in the static referencing environment, then compute the printed value. Repeat these steps under dynamic scope. `y` is declared inside `target`, so both rules find it in the first scope they check.

**2. (Explanation: 3 points)** Answer both parts.

a. Explain why the two results differ. Your answer must distinguish `target`'s textual parent from its active caller.

b. Under each rule in turn, say which `x` gets selected and which ones it shadows.


## Scope Isn't Lifetime

During `target`, the local `x` belonging to `caller` is alive because `caller` hasn't returned. Static scope still doesn't let `target` access that cell because `caller` isn't a textual ancestor of `target`.

### Worked Example for Checkpoint 2

*Suggested time: 12 minutes, including the worked example.*

```
rate = 10

scope():
    rate = 20

    show():
        print(rate)

    invoke():
        rate = 30
        show()

    invoke()

scope()
```

In this `rate` example, all three `rate` cells are alive at `print`. Static lookup can select `scope.rate` but can't select sibling `invoke.rate`. Dynamic lookup can select `invoke.rate` because `invoke` is the active caller.

| Declaration | Alive? | In static environment? | In dynamic environment? |
|---|---|---|---|
| global `rate` | yes | no, hidden by `scope.rate` | no, hidden by `invoke.rate` |
| `scope.rate` | yes | yes, first match | no, hidden by `invoke.rate` |
| `invoke.rate` | yes | no, off the static path | yes, first match |

Treating every live cell as visible under both rules confuses lifetime with scope. Lifetime answers whether storage exists. Scope answers whether an identifier can select it.

### Checkpoint 2: Account for Every Declaration (4 Points)

Use this running program:

```
x = 1

outer():
    x = 2

    target():
        y = 4
        print(x + y)

    caller():
        x = 3
        target()

    caller()

outer()
```

At the `print(x + y)` point in the running program, the live declarations are global `x = 1`, `outer`'s `x = 2`, `caller`'s `x = 3`, and `target`'s `y = 4`.

**1. (Construction: 2 points)** Make a table with one row for each `x`. At the `print` point, record whether its cell is alive and whether it enters the static and dynamic referencing environments.

**2. (Explanation: 2 points)** Explain one row where lifetime and visibility have different answers.

<!-- newpage -->

## Move a Definition, Rebuild the Chains

### Worked Example for Checkpoint 3

*Suggested time: 16 minutes, including the worked example.*

Trace one source edit. This is the original program:

```
rate = 10

scope():
    rate = 20

    show():
        print(rate)

    invoke():
        rate = 30
        show()

    invoke()

scope()
```

Now move the complete definition of `show` to global level. Keep every declaration, value, and call the same:

```
rate = 10

show():
    print(rate)

scope():
    rate = 20

    invoke():
        rate = 30
        show()

    invoke()

scope()
```

Compare the relationships first. Calculate the results after that. The move changes the textual parent of `show` from `scope` to `global`. The active caller at `print` is still `invoke` because the call statements didn't move.

Follow the change in execution order:

1. Build the new static path from the new source nesting: `show -> global`.
2. Copy the unchanged dynamic path from the active calls: `show -> invoke -> scope -> global`.
3. Stop at the first `rate` on each path. Static lookup selects global `rate = 10`. Dynamic lookup selects `invoke.rate = 30`.
4. Record only the selected binding in each referencing environment.

<!-- diagram: moved-definition-trace -->

Moving a definition changes source nesting. It doesn't rewrite the call history.

### Checkpoint 3: Resolve the Moved Name (4 Points)

Compare these complete programs. Program A is the original running case:

```
x = 1

outer():
    x = 2

    target():
        y = 4
        print(x + y)

    caller():
        x = 3
        target()

    caller()

outer()
```

Program B moves only the definition of `target` to global level:

```
x = 1

target():
    y = 4
    print(x + y)

outer():
    x = 2

    caller():
        x = 3
        target()

    caller()

outer()
```

Build your trace in this order:

1. Record the changed textual parent of `target`: `outer` in Program A, then `global` in Program B.
2. Record the unchanged active call chain: `outer -> caller -> target`.
3. Build Program B's complete static and dynamic lookup paths.
4. Resolve local `y` first. Then stop at the first `x` on each path.
5. Write each referencing environment with only the selected `x` and `y` bindings.
6. Compute both results and compare them with Program A.

**1. (Construction: 2 points)** Draw Program B's two complete lookup paths. Mark each first `x`, write both referencing environments, and compute both results.

**2. (Explanation: 2 points)** Answer both parts.

a. State which of the two printed values changes and which stays the same.

b. Moving the definition changed one relationship and left the other intact. Identify both, and state which lookup rule depends on each.

Submit both paths, first matches, and referencing environments. A result alone doesn't identify the scope rule.
