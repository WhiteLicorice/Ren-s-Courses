---
title: Fail Fast, Fail Early
subtitle: CMSC 124 Case Study 1
lead: A pessimist's guide to solving problems.
published: 2026-09-07
tags: [cmsc-124]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
isDraft: false
noDeadline: true
downloadLink: https://drive.google.com/drive/folders/1V5i7v68QISDlQLd12m4kQHVz3uo8Z6dt?usp=drive_link
diagrams:
  - title: From a command line to two arguments
    key: argv-path
    description: The shell supplies one list of strings, and the program assigns roles to its entries.
    steps:
      - title: The list arrives
        description: The executable name may occupy index zero, depending on the language interface.
        mermaid: |
          flowchart LR
            command["run --pos tests/cs1/pos/case1.rbt"] --> list["argument list"]
            list --> program["program entry point"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class command raw
            class list current
            class program done
      - title: The roles become clear after splitting out the executable name
        description: The first real argument is the mode and the second real argument is the path.
        mermaid: |
          flowchart LR
            zero["argv[0] executable"] --> mode["argv[1] --pos"]
            mode --> path["argv[2] test path"]
            java["args[0] --pos"] --> javaPath["args[1] test path"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class zero raw
            class mode current
            class path done
            class java raw
            class javaPath done
  - title: The Courier state
    key: courier-state
    description: The simulation keeps position, visited cells, and parcel cells as separate state.
    steps:
      - title: Start with three pieces of state
        description: The courier starts at row zero and column zero, with the start cell already visited.
        mermaid: |
          flowchart LR
            input["header and commands"] --> position["position row, column"]
            input --> visited["visited cell set"]
            input --> parcels["parcel cell set"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class input raw
            class position current
            class visited done
            class parcels done
      - title: Update each piece in order
        description: A move changes position, then the program checks bounds and records the new cell.
        mermaid: |
          flowchart LR
            command["U D L R"] --> move["change position"]
            move --> guard{"inside grid?"}
            guard -->|no| exit70["exit 70"]
            guard -->|yes| record["insert visited cell"]
            record --> next["read next command"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class command raw
            class move current
            class guard current
            class exit70 done
            class record done
            class next raw
  - title: The validation funnel
    key: validation-funnel
    description: Invalid files stop before simulation, while valid movement failures use a different exit code.
    steps:
      - title: Check static input first
        description: File, header, range, command, and mode checks reject malformed input with exit 65.
        mermaid: |
          flowchart LR
            file["input file"] --> readable{"readable?"}
            readable -->|no| bad65a["exit 65"]
            readable -->|yes| header{"valid header?"}
            header -->|no| bad65b["exit 65"]
            header -->|yes| commands{"known commands?"}
            commands -->|no| bad65c["exit 65"]
            commands -->|yes| simulation["simulate"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class file raw
            class readable current
            class header current
            class commands current
            class bad65a done
            class bad65b done
            class bad65c done
            class simulation raw
      - title: Check movement during simulation
        description: A known movement that leaves the grid exits with 70.
        mermaid: |
          flowchart LR
            simulation["simulate move"] --> bounds{"inside grid?"}
            bounds -->|no| bad70["exit 70"]
            bounds -->|yes| output["select output mode"]
            classDef raw fill:#eceff1,stroke:#546e7a,color:#263238
            classDef current fill:#bbdefb,stroke:#1565c0,color:#0d47a1
            classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
            class simulation raw
            class bounds current
            class bad70 done
            class output done
---

> "The best software engineers are the worst pessimists: they're always thinking of how
things will fail, seldom how they'll succeed."

This article earns no marks. You submit nothing. It's a post-mortem case study of a
practical exam that exposed gaps earlier courses should have closed: namely CMSC 11, CMSC 21,
CMSC 22, CMSC 123, and CMSC 142. This guides you through a worked solution to a problem like
the one on the exam, demonstrating how to think, discover, decide, and build. By the
end, you'll have a working Python reference, an approach to solving unfamiliar problems,
a test-first habit, and a translation guide for the seven exam languages.

## The Courier

Everything that you need to know about our case study problem is in this section. The sections that
follow teach you how to build the solution. They point back here instead of restating the rules.
I suggest that you open this section in another tab or screen so you can reference it quickly. The test
fixtures, including a guide on how to bootstrap it, can be downloaded using the `Download` button above,
or from [here](https://drive.google.com/drive/folders/1V5i7v68QISDlQLd12m4kQHVz3uo8Z6dt?usp=drive_link).
Use your university email to access the folder.

### The Problem

A courier walks a grid and leaves parcels behind. You write a program that
reads a description of the walk from a file, simulates it, and prints one of
three outputs.

### The Commands

The input file starts with a header line and continues with zero or more
command lines. Each command line is exactly one of five strings:

| Command | Effect |
|---|---|
| `U` | Move up one row |
| `D` | Move down one row |
| `L` | Move left one column |
| `R` | Move right one column |
| `DROP` | Leave a parcel at the current cell |

`U`, `D`, `L`, and `R` change the courier's position. `DROP` records a parcel
where the courier stands, without changing the courier's position.

### The Run Contract

The harness calls your program like this:

```
./run <mode> <path>
```

The mode comes first, then the path to the input file. `<mode>` is one of `--pos`,
`--visited`, or `--map`. Your program needs exactly two arguments.

*Did you try passing in these arguments with quotes and without quotes during the exam? What changed in behavior?*

### The Input File

Read the file at `<path>` as [UTF-8 (standard for text encoding)](https://en.wikipedia.org/wiki/UTF-8). A text file is bytes on disk decoded as characters, so the line breaks you see in an editor are control bytes you can inspect.

A newline written `\n`, which features prominently in `print("\n")` from CMSC 11, ends one line and starts the next. A carriage return, written `\r`, is its old partner from Windows line endings. Many Windows editors still save each break as the pair `\r\n`. You'll meet that pair a lot. You type one character in a Windows editor and save the file. But if you examine the file afterward, it holds two bytes.

```text
editor shows:   3 4
                R
bytes hold:     3 4\r\nR\r\n
```

A good read routine normalizes that away in three small moves. Say the file holds `3 4\r\nR\r\n`. When you split on `"\n"`, you get `3 4\r` and `R\r` plus a trailing empty piece. When you strip trailing `\r` bytes, the first two become `3 4` and `R`. When you drop empty strings, the trailing piece and any blank lines go away. What remains is the header followed by commands.

```text
file holds:   3 4\r\nR\r\n
split on \n:  "3 4\r" | "R\r" | ""
strip \r:     "3 4" | "R" | ""
drop empties: "3 4" | "R"
```

So strip trailing `\r` bytes from each split piece and drop lines that are empty afterward. The first remaining line is the header. Every line after the header is a command. A line with spaces in it still counts as a command.

The header has the form `H W`, with one space between the two values. Both
values are integers from 1 through 20. A header with one field, three fields,
nonnumeric values, or out-of-range values is invalid.

### The Grid

The courier starts at row 0 and column 0. Row 0 is the top row. Column 0 is
the leftmost column.

| Command | Row change | Column change |
|---|---:|---:|
| `U` | -1 | 0 |
| `D` | +1 | 0 |
| `L` | 0 | -1 |
| `R` | 0 | +1 |

A move that lands outside the grid is an error. The program tracks three
pieces of state: the courier's current position, the set of distinct cells
the courier has visited, and the set of cells where a parcel was dropped. The
starting cell counts as visited before the first command runs.

### The Output Modes

| Mode | Output |
|---|---|
| `--pos` | The final row and column, separated by one space |
| `--visited` | The number of distinct visited cells |
| `--map` | `H` rows of `W` characters |

In `--map` output, `@` marks the courier's final position, `*` marks a parcel,
and `.` marks an empty cell. When the courier finishes on a parcel cell, `@`
wins.

The output mode changes only what gets printed afterward, not the simulation.

### The Exit Codes

| Code | Meaning |
|---:|---|
| 0 | The program ran to completion and printed valid output |
| 65 | The input was rejected before simulation |
| 70 | A known command caused a runtime failure during simulation |

Exit 65 covers static checks: bad arguments, an unreadable file, a bad
header, an unknown command, or an unknown mode. Exit 70 covers one runtime
condition. The courier stepped off the grid.

### Five Worked Cases

The test suite has five graded cases. Each one runs in all three modes,
giving 15 valid executions total.

**Case 1.** A 3 by 4 grid. The courier moves right twice, drops a parcel,
moves down twice, then moves up once.

```text
3 4
R
R
DROP
D
D
U
```

| Mode | Expected |
|---|---|
| `--pos` | `1 2` |
| `--visited` | `5` |
|  | `..*.` |
| `--map` | `..@.` |
| | `....` |

The parcel stays at `(0, 2)` where the courier dropped it. The courier
finishes at `(1, 2)` because the `U` after two `D`s moves one row back up.

**Case 2.** A 2 by 2 grid. The courier drops a parcel at each corner.

```text
2 2
DROP
R
DROP
D
DROP
L
DROP
```

| Mode | Expected |
|---|---|
| `--pos` | `1 0` |
| `--visited` | `4` |
| `--map` | `**`  |
| | `@*` |

All four cells hold parcels. The courier finishes at `(1, 0)`, so `@`
replaces the `*` there.

**Case 3.** A 1 by 5 grid. The courier moves right to the edge, comes back,
and drops a parcel.

```text
1 5
R
R
R
R
L
L
DROP
```

| Mode | Expected |
|---|---|
| `--pos` | `0 2` |
| `--visited` | `5` |
| `--map` | `..@..` |

The courier visits all five columns but finishes at column 2. The `DROP`
happens after the moves, so the parcel lands under the courier and `@` hides
it.

**Case 4.** A 1 by 1 grid with a blank line in the input.

```text

1 1

DROP
```

| Mode | Expected |
|---|---|
| `--pos` | `0 0` |
| `--visited` | `1` |
| `--map` | `@` |

Blank lines are stripped before parsing. On a one-cell grid, the courier can't
move, but `DROP` still works. The `@` covers the parcel.

**Case 5.** A 20 by 20 grid with one `DROP` and no movement.

```text
20 20
DROP
```

| Mode | Expected |
|---|---|
| `--pos` | `0 0` |
| `--visited` | `1` |
| `--map` | `@` followed by 19 dots, then 19 rows of 20 dots |

The grid is at maximum size. The courier never moves, so only the starting
cell is visited. The `@` sits in the top-left corner and every other cell is
empty.

### The Rejections

Every rejection expectation file is empty. A correctly rejected input
produces no stdout. The modes reuse each input, so the same rule and exit
code apply across `errors-pos`, `errors-visited`, and `errors-map`.

| Fixture | Input | Rule | Exit |
|---|---|---|---:|
| `err1` | empty | no header | 65 |
| `err2` | `3 3`, `R`, `JUMP` | unknown command | 65 |
| `err3` | `3`, `R` | one header field | 65 |
| `err4` | `3 3 3`, `R` | three header fields | 65 |
| `err5` | `x 3`, `R` | nonnumeric height | 65 |
| `err6` | `3 x`, `R` | nonnumeric width | 65 |
| `err7` | `0 3`, `R` | height below range | 65 |
| `err8` | `3 0`, `R` | width below range | 65 |
| `err9` | `21 3`, `R` | height above range | 65 |
| `err10` | `3 21`, `R` | width above range | 65 |
| `err11` | `3 3`, `R 1` | command with extra text | 65 |
| `err12` | `3 3`, `U` | move leaves top edge | 70 |
| `err13` | `3 3`, `L` | move leaves left edge | 70 |
| `err14` | `2 3`, `D`, `D` | second move leaves bottom edge | 70 |
| `err15` | `2 3`, `R`, `R`, `R` | third move leaves right edge | 70 |

The first eleven are static. They can be caught before simulation starts. The
last four contain valid commands that fail during simulation. They use
exit 70 instead of 65.

---

## 1. What the Exam Actually Measured

The Courier run has 60 executions. Five graded cases and fifteen rejection
cases each run in all three modes, so the run splits into 15 valid and 45
rejection executions.

| Side of the run | Cases | Modes | Executions |
|---|---:|---:|---:|
| Valid outputs | 5 | 3 | 15 |
| Rejections | 15 | 3 | 45 |
| Total | 20 | 3 | 60 |

Three quarters of the run is rejection handling. That makes error
handling *not* a side quest. The harness reports one flat score out of 60.
The 45 count tells you where a careful first pass can earn coverage.

The first useful surprise is the score from a program that only validates input and
then stops. No simulation at all. The measured score is a whopping 33 out of
60. The program passes err1 through err11 in each of the three error folders.
It misses the four off-grid cases and all fifteen valid cases.

That result changes the order of your work. A parser isn't a warm-up you throw
away before the full solution. It's already a large part of the tested
behavior. Once the parser has a clean boundary, the simulation has fewer jobs.

The score also gives you a quick diagnostic. Zero means the entry path or
argument handling is wrong. Around 33 means the static contract is mostly
present. 50 means the simulation and position output work but another mode
still needs attention. These labels come from the fixture run, not a new
grading rule.

Four gaps from previous courses show up here. The first is not
splitting a specification into separate obligations (CMSC 123, CMSC 142). The
second is not seeing a command line as a list of strings (CMSC 21, CMSC 22).
The third is not trying a small case before building the whole thing (CMSC 11).
The fourth is leaving failure handling for last (CMSC 11, CMSC 21, CMSC 22, CMSC 123, CMSC 142).
Sections 2 through 5 address each gap.

Run the harness once before you change any code. Write down the six folder
totals beside your editor.

## 2. Take the Problem Apart

Gap 1 is the habit of treating a paragraph as one task. The Courier gets less
slippery when you turn each sentence into one obligation.

Reread *The Commands* and *The Grid* now. Each sentence there states one fact
your program has to enforce or track. Use this checklist as a decomposition
pattern:

| Obligation group | Questions to answer |
|---|---|
| Input guarantees | Which line is the header? Which lines are commands? What are the valid ranges and exact spellings? |
| Validation | How many real arguments must arrive? Which file, header, command, and mode checks reject with exit 65? |
| State | What's the current position? Which cells have been visited? Which cells hold parcels? |
| Output | What does each mode print? Which marker wins when two facts share one cell? |
| Failure | Which known command can still fail during simulation? What exit code marks that failure? |

The checklist doesn't choose a language, a class structure, or a loop to start
with. It gives every later line of code a job, so write this checklist down
before you start programming.

## 3. The Command Line Is a List of Strings

In CMSC 21, you've written `int main(int argc, char *argv[])`. In CMSC 22,
you've written `public static void main(String[] args)`. Those signatures are
already in your hands, and those parameters were *always* there.
This is the lesson that both CMSC 21 and CMSC 22 owed you about them.
`argc` and `args.length` tell you how many strings arrived from the command line,
when your program is invoked. `argv` and `args` hold those strings.
The names differ, but the fact is the same.

When you type a command, the shell splits its words into strings. The operating
system hands that list to the program. The entry point reads it by index. That
list isn't the *contents* of any file. It's the command that tells the
program which mode to use and which file to read.

For this run, the command has three visible words:

```bash
./run --pos tests/cs1/pos/case1.rbt
```

In C and C++, the executable name usually occupies `argv[0]`. The mode is
`argv[1]`. The path is `argv[2]`. In Java, the runtime gives `args` only the
mode and the path, so the mode is `args[0]` and the path is `args[1]`.

The seven exam languages use the same split with different surface names,
if you read the back page before tackling the problem.

| Language | Executable entry | Mode index | Path index |
|---|---|---:|---:|
| Rust | `env::args()` includes the executable | 1 before a slice, or 0 after `skip(1)` | 2 before a slice, or 1 after `skip(1)` |
| Kotlin | `args` contains real arguments | 0 | 1 |
| Dart | `main(List<String> arguments)` contains real arguments | 0 | 1 |
| C# | `Main(string[] args)` contains real arguments | 0 | 1 |
| C++ | `argv[0]` is the executable | 1 | 2 |
| Go | `os.Args[0]` is the executable | 1 before a slice, or 0 after `os.Args[1:]` | 2 before a slice, or 1 after `os.Args[1:]` |
| Julia | `ARGS` contains real arguments and uses one-based indexing | 1 | 2 |

The starter templates set an intentional trap. They bind the first argument to a file path.
The harness passes the mode first and the path second. If you keep that
starter binding, your program opens `--pos` instead of the test file. That
mistake fails all fifteen cases in a mode, exposing Gap 2.

The Python version here makes the correction visible:

```python
arguments = sys.argv[1:]
if len(arguments) != 2:
    fail("usage: run <--pos|--visited|--map> <path>")
mode, path = arguments
source = Path(path).read_text(encoding="utf-8")
```

The slice removes the script name. The unpacking keeps the mode and path in
their contract order. The rest of the program can now work with the input
file directly.

Run the Python entry point with `--pos` before a known test path, then inspect
the two values your program receives. Use `print`.

<!-- diagram: argv-path -->

## 4. Try It and See

Gap 3 isn't solved by understanding the harness description, or reading test cases or any prose.
You solve it by running a small program and looking at its result.

The fastest way to check is a small argument probe. It prints the arguments
after the script name
to standard error and exits with 65. Standard error keeps the probe visible
without pretending the program produced a valid answer. The exit code also makes
it a valid rejection stub for the harness.

```python
import sys


print(sys.argv[1:], file=sys.stderr)
sys.exit(65)
```

A `run` wrapper is a small launcher that forwards the harness's arguments to
your program. For Python, it calls `main.py`.

```bash
#!/usr/bin/env bash
exec python3 "$(dirname "$0")/main.py" "$@"
```

Then run the harness against each folder. The wrapper receives the flag and
path in that order. The Python file prints the list it sees. The harness still
checks stdout and exit code, so the stub fails valid cases and runtime cases.

The measured result is 11 out of 15 in each error folder and 33 out of 60
overall. That's not a disappointing result. It proves that the harness is
running the entry point, that the expected rejection code is 65, and that the
static error cases are test cases worth passing.

One run takes seconds. Guessing about the argument list can waste an entire
debugging session and burn 90 minutes. Run the experiment first, then build on what you see.

Run the stub with `--pos tests/cs1/pos/case1.rbt` and read its standard error.

## 5. Fail on Purpose, Fail Early, Fail Fast

The fourth gap is making the happy path the first path. The Courier
reverses that priority. Look at *The Rejections* near the top. The fixtures
number the rules clearly enough to show the order your program should check
them.

The first eleven checks are static. They inspect the file and its command
names without moving the courier. The last four contain known commands. They
become invalid only when the simulation applies a move. The code order follows
that distinction.

The samples in this article are cuts from one Python file. They assume the imports
`re`, `sys`, and `Path` and the four helpers `fail`, `die`, `number`, and
`output` that the first Appendix listing shows in place. That listing is the
finished file. A sample carries on from the code you wrote before it, and where
a later sample reworks a block, replace the block instead of keeping both
versions.

```python
lines = []
for raw in source.split("\n"):
    line = raw.rstrip("\r")
    if line:
        lines.append(line)
if not lines:
    fail("the file has no header line")

header = lines[0].split(" ")
if len(header) != 2:
    fail("the header needs a height and a width")
height = number(header[0], "bad height")
width = number(header[1], "bad width")
if height < 1 or height > 20 or width < 1 or width > 20:
    fail("the height and width must each be between 1 and 20")

for line in lines[1:]:
    if line not in {"U", "D", "L", "R", "DROP"}:
        fail(f"unknown command '{line}'")
```

The static-only version passes err1 through err11 in all three error folders.
The measured folder totals are 11/15, 11/15, and 11/15. The valid folders
still fail because this version stops before simulation and output. That gives
33 out of 60.

Place a guard beside the fact it protects. A file guard belongs after reading.
A range guard belongs after parsing. A movement guard belongs after changing a
candidate position and before recording that position as valid. A mode guard
belongs before the program prints an answer.

Run all six folders and confirm the error folders report 11/15 each. Then mark
err1 through err11 as static and err12 through err15 as runtime in your own
checklist.

<!-- diagram: validation-funnel -->

## 6. The Guided Build

The guided build uses Python because Python keeps attention on the decisions.
Python isn't one of the seven host languages that count for the exam. CMSC 11
taught Python. CMSC 123 and CMSC 142 taught Python again, presumably, if not C or C++.
That makes Python the only language that bookends this course sequence for every reader.

The listing focuses on the decisions, not on syntax details. The harness is
Python too, so the entry path is familiar on the day you run it. No group ships
Python for a graded laboratory activity. The Python solution is the reasoning.
Appendix A holds solutions for the seven languages that you use in laboratory activities.

Each part adds one behavior. Run all six folders after each part. The totals
below come from harness runs.

| Part | Adds | Folder result | Total |
|---:|---|---|---:|
| 0 | Argument handling and immediate exit | 0/5, 0/5, 0/5, 0/15, 0/15, 0/15 | 0/60 |
| 1 | File reading, blank removal, header form, and range | 0/5, 0/5, 0/5, 9/15, 9/15, 9/15 | 27/60 |
| 2 | Command names and command arity | 0/5, 0/5, 0/5, 11/15, 11/15, 11/15 | 33/60 |
| 3 | Simulation, off-grid failure, and `--pos` | 5/5, 0/5, 0/5, 15/15, 15/15, 15/15 | 50/60 |
| 4 | The three output modes | 5/5, 5/5, 5/5, 15/15, 15/15, 15/15 | 60/60 |

The six folder results appear in this order: `pos`, `visited`, `map`,
`errors-pos`, `errors-visited`, and `errors-map`. Keep that order in your own
terminal notes. It prevents a total from hiding a missing mode.

### Part 0: Put the Entry Point Under Test

Start by accepting exactly two arguments besides the script name. The Python process has its own
name at `sys.argv[0]`, so the mode begins at index 1. Exit immediately after
the argument check. There's no file read yet.

```python
arguments = sys.argv[1:]
if len(arguments) != 2:
    fail("usage: run <--pos|--visited|--map> <path>")
mode, path = arguments
```

This part scores 0/60. There's no output yet, so nothing can pass. What you
get instead is an entry point that accepts exactly two arguments besides the script name and
stops cleanly. The beginning is pristine, so no environmental errors may occur.

Run all six folders. Record the six zero totals before you move to Part 1.

### Part 1: Read and Validate the Header

Read the path as UTF-8. Remove blank lines and one trailing carriage return per
line. Split the first remaining line on one literal space. That split preserves
empty fields, so `3  3` doesn't become a valid header. Parse both
numbers and apply the inclusive 1 through 20 range.

```python
try:
    source = Path(path).read_text(encoding="utf-8")
except (OSError, UnicodeError) as error:
    fail(f"cannot read '{path}': {error}")

lines = []
for raw in source.split("\n"):
    line = raw.rstrip("\r")
    if line:
        lines.append(line)
if not lines:
    fail("the file has no header line")

header = lines[0].split(" ")
if len(header) != 2:
    fail("the header needs a height and a width")
height = number(header[0], "bad height")
width = number(header[1], "bad width")
if height < 1 or height > 20 or width < 1 or width > 20:
    fail("the height and width must each be between 1 and 20")
```

This part scores 27/60. It passes nine rejection cases in each error folder.
The unknown-command case still needs command validation. The four runtime cases
also pass through because no move has been applied yet.

Run all six folders. Look at the first failing error in each folder.

### Part 2: Validate Exact Commands

Scan the lines after the header. Compare each line against the five exact
spellings. Keep `DROP` separate from movement. It changes the parcel set but
doesn't change the position. Stop after this scan so the next score isolates
static validation.

```python
parcels = set()
visited = {(0, 0)}
row = 0
column = 0

for line in lines[1:]:
    if line not in {"U", "D", "L", "R", "DROP"}:
        fail(f"unknown command '{line}'")
    if line == "DROP":
        parcels.add((row, column))
        continue
```

This part scores 33/60. It passes err1 through err11 in each error folder. It
doesn't pass the four off-grid cases because it hasn't applied movement yet.

Run the three error folders and confirm that each reports 11/15 before you
start the simulation.

### Part 3: Simulate and Guard the Grid

Map each movement to a row and column change. Apply the change. Check the new
position before inserting it into the visited set. This order lets the runtime
failure use exit 70 and keeps an off-grid cell out of the visited set.

```python
for line in lines[1:]:
    if line == "U":
        step_row, step_column = -1, 0
    elif line == "D":
        step_row, step_column = 1, 0
    elif line == "L":
        step_row, step_column = 0, -1
    elif line == "R":
        step_row, step_column = 0, 1
    elif line == "DROP":
        parcels.add((row, column))
        continue
    else:
        fail(f"unknown command '{line}'")

    row += step_row
    column += step_column
    if row < 0 or row >= height or column < 0 or column >= width:
        die("the courier stepped off the grid")
    visited.add((row, column))

if mode == "--pos":
    output(f"{row} {column}")
```

This part scores 50/60. Position output now passes all five valid cases. Static
and runtime rejection handling passes all 45 rejection executions. The
visited and map modes still have no output.

Run all six folders. Confirm that the three valid folders split into 5/5,
0/5, and 0/5.

### Part 4: Select the Output Mode

The simulation has one final state. Each mode reads that state differently.
Check the mode after the simulation so an unknown mode can't print a plausible
partial answer.

```python
if mode == "--pos":
    output(f"{row} {column}")
elif mode == "--visited":
    output(str(len(visited)))
elif mode == "--map":
    for current_row in range(height):
        rendered = []
        for current_column in range(width):
            if current_row == row and current_column == column:
                rendered.append("@")
            elif (current_row, current_column) in parcels:
                rendered.append("*")
            else:
                rendered.append(".")
        output("".join(rendered))
else:
    fail(f"unknown mode '{mode}'")
```

The complete program appears as the first listing in Appendix A. It preserves
the checks in this order. On Windows, the `\r` stripping in the input reader
handles files saved with Windows line endings. The output uses Unix-style
newlines, so the harness can compare stdout across platforms.

This part scores 60/60. Run all six folders and read the totals. Each folder
should report its full count now, matching the last row of the table above.

<!-- diagram: courier-state -->

## 7. The Same Reasoning in Your Own Language

The seven exam references share one algorithm. They differ in five language
interfaces: argument index, file reading, integer parsing, exit call, and the
container used for the visited set. The first four were detailed on the back page,
while the last one tests your fluency over your chosen language.

| Decision | Python walkthrough | Seven-language reference choices |
|---|---|---|
| Argument index | Slice `sys.argv[1:]` | Rust, C++, and Go account for the executable. Kotlin, Dart, C#, and Julia receive real arguments directly. |
| File reading | `Path.read_text` with UTF-8 | Each template uses its language file API and the same line cleanup. |
| Integer parsing | Regex plus `int` and signed 64-bit bounds | Rust, Kotlin, Dart, C#, C++, Go, and Julia parse before the range check. |
| Exit call | `sys.exit(65)` or `sys.exit(70)` | Each language calls its process exit function with the same code. |
| Visited container | Set of `(row, column)` tuples | Each reference uses a set-like collection of coordinate pairs. |

Translate each named obligation, not every Python token. Appendix A holds all
eight listings.

Run one non-Python verifier now. Walk through the five rows while you watch its
six folder results.

## 8. What to Carry into Laboratory Activity 1 and Future Problems

Your four gaps become four actions.

1. Break the problem statement into input, validation, state, output, and failure.
2. Print or inspect the arguments before you guess their order.
3. Try one small input and read the actual result.
4. Add failure guards before the happy path grows around them.

Write those four actions at the top of your next laboratory file. Then create a
five-row checklist for the next problem before you start coding.

---

## Appendix A. The Courier in Eight Languages

These listings are complete. Python comes first because it carries the
walkthrough. Each listing matches the runnable file beside this article. The
comments inside the code call out language-specific decisions.

### Python

<!-- listing-python -->
```python
#!/usr/bin/env python3
"""Reference solution for the CMSC 124 Courier case study."""

import re
import sys
from pathlib import Path
from typing import NoReturn


def fail(message: str) -> NoReturn:
    print(f"exam: {message}", file=sys.stderr)
    sys.exit(65)


def die(message: str) -> NoReturn:
    print(f"exam: {message}", file=sys.stderr)
    sys.exit(70)


def output(line: str) -> None:
    sys.stdout.buffer.write(f"{line}\n".encode("utf-8"))


def number(text: str, complaint: str) -> int:
    # Parse the header token as a signed 64-bit integer, then let the
    # range check below decide whether the value is usable.
    if re.fullmatch(r"[+-]?\d+", text) is None:
        fail(complaint)
    value: int = int(text, 10)
    if not -(1 << 63) <= value <= (1 << 63) - 1:
        fail(complaint)
    return value


def main() -> None:
    # Python's argv[0] is the script name, so the mode is argv[1].
    arguments: list[str] = sys.argv[1:]
    if len(arguments) != 2:
        fail("usage: run <--pos|--visited|--map> <path>")
    mode, path = arguments

    try:
        source: str = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        fail(f"cannot read '{path}': {error}")

    lines: list[str] = []
    for raw in source.split("\n"):
        line = raw.rstrip("\r")
        if line:
            lines.append(line)
    if not lines:
        fail("the file has no header line")

    # split(" ") keeps empty fields, which enforces the exact header form.
    header: list[str] = lines[0].split(" ")
    if len(header) != 2:
        fail("the header needs a height and a width")
    height: int = number(header[0], "bad height")
    width: int = number(header[1], "bad width")
    if height < 1 or height > 20 or width < 1 or width > 20:
        fail("the height and width must each be between 1 and 20")

    parcels: set[tuple[int, int]] = set()
    visited: set[tuple[int, int]] = set()
    row: int = 0
    column: int = 0
    visited.add((row, column))

    for line in lines[1:]:
        step_row: int
        step_column: int
        if line == "U":
            step_row, step_column = -1, 0
        elif line == "D":
            step_row, step_column = 1, 0
        elif line == "L":
            step_row, step_column = 0, -1
        elif line == "R":
            step_row, step_column = 0, 1
        elif line == "DROP":
            parcels.add((row, column))
            continue
        else:
            fail(f"unknown command '{line}'")

        row += step_row
        column += step_column
        if row < 0 or row >= height or column < 0 or column >= width:
            die("the courier stepped off the grid")
        visited.add((row, column))

    if mode == "--pos":
        output(f"{row} {column}")
    elif mode == "--visited":
        output(str(len(visited)))
    elif mode == "--map":
        for current_row in range(height):
            rendered: list[str] = []
            for current_column in range(width):
                if current_row == row and current_column == column:
                    rendered.append("@")
                elif (current_row, current_column) in parcels:
                    rendered.append("*")
                else:
                    rendered.append(".")
            output("".join(rendered))
    else:
        fail(f"unknown mode '{mode}'")


main()
```

### Rust

<!-- listing-rust -->
```rust
// Reference solution for the CMSC 124 Courier case study.

use std::{collections::HashSet, env, fs, process};

fn fail(message: &str) -> ! {
    eprintln!("exam: {message}");
    process::exit(65);
}

fn die(message: &str) -> ! {
    eprintln!("exam: {message}");
    process::exit(70);
}

fn main() {
    // Skip argv[0], the executable name. The mode is the first real argument.
    let arguments: Vec<String> = env::args().skip(1).collect();
    if arguments.len() != 2 {
        fail("usage: run <--pos|--visited|--map> <path>");
    }
    let mode = arguments[0].clone();
    let path = arguments[1].clone();

    let source = fs::read_to_string(&path)
        .unwrap_or_else(|error| fail(&format!("cannot read '{path}': {error}")));

    let mut lines: Vec<String> = Vec::new();
    // Remove only blank lines and a trailing carriage return. Keep other text exact.
    for raw in source.split('\n') {
        let line = raw.trim_end_matches('\r').to_string();
        if !line.is_empty() {
            lines.push(line);
        }
    }
    if lines.is_empty() {
        fail("the file has no header line");
    }

    let header: Vec<&str> = lines[0].split(' ').collect();
    if header.len() != 2 {
        fail("the header needs a height and a width");
    }
    let height: i64 = header[0].parse().unwrap_or_else(|_| fail("bad height"));
    let width: i64 = header[1].parse().unwrap_or_else(|_| fail("bad width"));
    if height < 1 || height > 20 || width < 1 || width > 20 {
        fail("the height and width must each be between 1 and 20");
    }

    let mut parcels: HashSet<(i64, i64)> = HashSet::new();
    let mut visited: HashSet<(i64, i64)> = HashSet::new();
    let mut row: i64 = 0;
    let mut column: i64 = 0;
    // A HashSet counts each cell once, including the starting cell.
    visited.insert((row, column));

    for line in &lines[1..] {
        let (step_row, step_column) = match line.as_str() {
            "U" => (-1, 0),
            "D" => (1, 0),
            "L" => (0, -1),
            "R" => (0, 1),
            "DROP" => {
                parcels.insert((row, column));
                continue;
            }
            other => fail(&format!("unknown command '{other}'")),
        };
        row += step_row;
        column += step_column;
        if row < 0 || row >= height || column < 0 || column >= width {
            die("the courier stepped off the grid");
        }
        visited.insert((row, column));
    }

    match mode.as_str() {
        "--pos" => println!("{row} {column}"),
        "--visited" => println!("{}", visited.len()),
        "--map" => {
            for r in 0..height {
                let mut rendered = String::new();
                for c in 0..width {
                    if r == row && c == column {
                        rendered.push('@');
                    } else if parcels.contains(&(r, c)) {
                        rendered.push('*');
                    } else {
                        rendered.push('.');
                    }
                }
                println!("{rendered}");
            }
        }
        other => fail(&format!("unknown mode '{other}'")),
    }
}
```

### Kotlin

<!-- listing-kotlin -->
```kotlin
// Reference solution for the CMSC 124 Courier case study.

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess

private fun fail(message: String): Nothing {
    System.err.println("exam: $message")
    exitProcess(65)
}

private fun die(message: String): Nothing {
    System.err.println("exam: $message")
    exitProcess(70)
}

private fun number(text: String, complaint: String): Long =
    text.toLongOrNull() ?: fail(complaint)

fun main(args: Array<String>) {
    // Kotlin starts the real argument list at index 0. The mode comes first.
    if (args.size != 2) {
        fail("usage: run <--pos|--visited|--map> <path>")
    }
    val mode = args[0]
    val path = args[1]

    val source = try {
        Files.readString(Path.of(path), StandardCharsets.UTF_8)
    } catch (error: Exception) {
        fail("cannot read '$path': ${error.message}")
    }

    val lines = source.split("\n")
        // Keep the header and commands exact after removing blank lines.
        .map { it.removeSuffix("\r") }
        .filter { it.isNotEmpty() }
    if (lines.isEmpty()) {
        fail("the file has no header line")
    }

    val header = lines[0].split(" ")
    if (header.size != 2) {
        fail("the header needs a height and a width")
    }
    val height = number(header[0], "bad height")
    val width = number(header[1], "bad width")
    if (height < 1 || height > 20 || width < 1 || width > 20) {
        fail("the height and width must each be between 1 and 20")
    }

    val parcels = mutableSetOf<Pair<Long, Long>>()
    val visited = mutableSetOf<Pair<Long, Long>>()
    var row = 0L
    var column = 0L
    // The set stores pairs, so revisiting a cell does not increase the count.
    visited.add(row to column)

    for (line in lines.drop(1)) {
        var stepRow = 0L
        var stepColumn = 0L
        when (line) {
            "U" -> stepRow = -1L
            "D" -> stepRow = 1L
            "L" -> stepColumn = -1L
            "R" -> stepColumn = 1L
            "DROP" -> {
                parcels.add(row to column)
                continue
            }
            else -> fail("unknown command '$line'")
        }

        row += stepRow
        column += stepColumn
        if (row < 0 || row >= height || column < 0 || column >= width) {
            die("the courier stepped off the grid")
        }
        visited.add(row to column)
    }

    when (mode) {
        "--pos" -> println("$row $column")
        "--visited" -> println(visited.size)
        "--map" -> {
            for (r in 0 until height) {
                val rendered = StringBuilder()
                for (c in 0 until width) {
                    when {
                        r == row && c == column -> rendered.append('@')
                        parcels.contains(r to c) -> rendered.append('*')
                        else -> rendered.append('.')
                    }
                }
                println(rendered)
            }
        }
        else -> fail("unknown mode '$mode'")
    }
}
```

### Dart

<!-- listing-dart -->
```dart
// Reference solution for the CMSC 124 Courier case study.

import 'dart:convert';
import 'dart:io';

Never fail(String message) {
  stderr.writeln('exam: $message');
  exit(65);
}

Never die(String message) {
  stderr.writeln('exam: $message');
  exit(70);
}

int number(String text, String complaint) =>
    int.tryParse(text) ?? fail(complaint);

List<String> readLines(String path) {
  String source;
  try {
    source = File(path).readAsStringSync(encoding: utf8);
  } on FileSystemException catch (error) {
    fail("cannot read '$path': ${error.message}");
  }
  return source
      .split('\n')
      .map((line) =>
          line.endsWith('\r') ? line.substring(0, line.length - 1) : line)
      .where((line) => line.isNotEmpty)
      .toList();
}

void main(List<String> arguments) {
  // Dart uses index 0 for the first real argument, which is the mode flag.
  if (arguments.length != 2) {
    fail('usage: run <--pos|--visited|--map> <path>');
  }
  final mode = arguments[0];
  final lines = readLines(arguments[1]);
  if (lines.isEmpty) {
    fail('the file has no header line');
  }

  final header = lines[0].split(' ');
  if (header.length != 2) {
    fail('the header needs a height and a width');
  }
  final height = number(header[0], 'bad height');
  final width = number(header[1], 'bad width');
  if (height < 1 || height > 20 || width < 1 || width > 20) {
    fail('the height and width must each be between 1 and 20');
  }

  final parcels = <String>{};
  final visited = <String>{};
  var row = 0;
  var column = 0;
  // Store coordinates as strings because a Dart Set compares string values.
  visited.add('$row $column');

  for (final line in lines.skip(1)) {
    var stepRow = 0;
    var stepColumn = 0;
    if (line == 'U') {
      stepRow = -1;
    } else if (line == 'D') {
      stepRow = 1;
    } else if (line == 'L') {
      stepColumn = -1;
    } else if (line == 'R') {
      stepColumn = 1;
    } else if (line == 'DROP') {
      parcels.add('$row $column');
      continue;
    } else {
      fail("unknown command '$line'");
    }

    row += stepRow;
    column += stepColumn;
    if (row < 0 || row >= height || column < 0 || column >= width) {
      die('the courier stepped off the grid');
    }
    visited.add('$row $column');
  }

  if (mode == '--pos') {
    stdout.writeln('$row $column');
  } else if (mode == '--visited') {
    stdout.writeln(visited.length);
  } else if (mode == '--map') {
    for (var r = 0; r < height; r++) {
      final rendered = StringBuffer();
      for (var c = 0; c < width; c++) {
        if (r == row && c == column) {
          rendered.write('@');
        } else if (parcels.contains('$r $c')) {
          rendered.write('*');
        } else {
          rendered.write('.');
        }
      }
      stdout.writeln(rendered.toString());
    }
  } else {
    fail("unknown mode '$mode'");
  }
}
```

### C#

<!-- listing-csharp -->
```csharp
// Reference solution for the CMSC 124 Courier case study.

using System.Diagnostics.CodeAnalysis;
using System.Text;

internal static class Program
{
    [DoesNotReturn]
    private static void Fail(string message)
    {
        Console.Error.WriteLine($"exam: {message}");
        Environment.Exit(65);
        throw new InvalidOperationException();
    }

    [DoesNotReturn]
    private static void Die(string message)
    {
        Console.Error.WriteLine($"exam: {message}");
        Environment.Exit(70);
        throw new InvalidOperationException();
    }

    private static long Number(string text, string complaint)
    {
        if (!long.TryParse(text, out var value))
        {
            Fail(complaint);
        }
        return value;
    }

    private static void Main(string[] args)
    {
        // C# uses index 0 for the first real argument, which is the mode.
        if (args.Length != 2)
        {
            Fail("usage: run <--pos|--visited|--map> <path>");
        }
        var mode = args[0];
        var path = args[1];

        string source;
        try
        {
            source = File.ReadAllText(path, Encoding.UTF8);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Fail($"cannot read '{path}': {error.Message}");
            return;
        }

        var lines = new List<string>();
        foreach (var raw in source.Split('\n'))
        {
            var line = raw.TrimEnd('\r');
            if (line.Length != 0)
            {
                lines.Add(line);
            }
        }
        if (lines.Count == 0)
        {
            Fail("the file has no header line");
        }

        var header = lines[0].Split(' ');
        if (header.Length != 2)
        {
            Fail("the header needs a height and a width");
        }
        var height = Number(header[0], "bad height");
        var width = Number(header[1], "bad width");
        if (height < 1 || height > 20 || width < 1 || width > 20)
        {
            Fail("the height and width must each be between 1 and 20");
        }

        var parcels = new HashSet<(long, long)>();
        var visited = new HashSet<(long, long)>();
        long row = 0;
        long column = 0;
        // A HashSet keeps the visited count distinct when a path doubles back.
        visited.Add((row, column));

        for (var index = 1; index < lines.Count; index++)
        {
            var line = lines[index];
            long stepRow = 0;
            long stepColumn = 0;
            switch (line)
            {
                case "U": stepRow = -1; break;
                case "D": stepRow = 1; break;
                case "L": stepColumn = -1; break;
                case "R": stepColumn = 1; break;
                case "DROP":
                    parcels.Add((row, column));
                    continue;
                default:
                    Fail($"unknown command '{line}'");
                    break;
            }

            row += stepRow;
            column += stepColumn;
            if (row < 0 || row >= height || column < 0 || column >= width)
            {
                Die("the courier stepped off the grid");
            }
            visited.Add((row, column));
        }

        switch (mode)
        {
            case "--pos":
                Console.WriteLine($"{row} {column}");
                break;
            case "--visited":
                Console.WriteLine(visited.Count);
                break;
            case "--map":
                for (long r = 0; r < height; r++)
                {
                    var rendered = new StringBuilder();
                    for (long c = 0; c < width; c++)
                    {
                        if (r == row && c == column) { rendered.Append('@'); }
                        else if (parcels.Contains((r, c))) { rendered.Append('*'); }
                        else { rendered.Append('.'); }
                    }
                    Console.WriteLine(rendered.ToString());
                }
                break;
            default:
                Fail($"unknown mode '{mode}'");
                break;
        }
    }
}
```

### C++

<!-- listing-cpp -->
```cpp
// Reference solution for the CMSC 124 Courier case study.

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <set>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

using Cell = std::pair<long long, long long>;

[[noreturn]] void fail(const std::string& message)
{
    std::cerr << "exam: " << message << '\n';
    std::exit(65);
}

[[noreturn]] void die(const std::string& message)
{
    std::cerr << "exam: " << message << '\n';
    std::exit(70);
}

std::vector<std::string> split(const std::string& text, char separator)
{
    std::vector<std::string> fields;
    std::istringstream stream(text);
    std::string field;
    while (std::getline(stream, field, separator))
    {
        fields.push_back(field);
    }
    return fields;
}

long long number(const std::string& text, const std::string& complaint)
{
    try
    {
        std::size_t used = 0;
        const long long value = std::stoll(text, &used);
        if (used != text.size())
        {
            fail(complaint);
        }
        return value;
    }
    catch (const std::exception&)
    {
        fail(complaint);
    }
}

int main(int argc, char* argv[])
{
    // C++ keeps the executable at argv[0], so argv[1] holds the mode.
    if (argc != 3)
    {
        fail("usage: run <--pos|--visited|--map> <path>");
    }
    const std::string mode(argv[1]);
    const std::string path(argv[2]);

    std::ifstream file(path);
    if (!file)
    {
        fail("cannot read '" + path + "'");
    }
    std::ostringstream buffer;
    buffer << file.rdbuf();
    const std::string source = buffer.str();

    std::vector<std::string> lines;
    for (std::string line : split(source, '\n'))
    {
        if (!line.empty() && line.back() == '\r')
        {
            line.pop_back();
        }
        if (!line.empty())
        {
            lines.push_back(line);
        }
    }
    if (lines.empty())
    {
        fail("the file has no header line");
    }

    const std::vector<std::string> header = split(lines[0], ' ');
    if (header.size() != 2)
    {
        fail("the header needs a height and a width");
    }
    const long long height = number(header[0], "bad height");
    const long long width = number(header[1], "bad width");
    if (height < 1 || height > 20 || width < 1 || width > 20)
    {
        fail("the height and width must each be between 1 and 20");
    }

    std::set<Cell> parcels;
    std::set<Cell> visited;
    long long row = 0;
    long long column = 0;
    // A set makes the visited total a count of distinct coordinate pairs.
    visited.insert({row, column});

    for (std::size_t index = 1; index < lines.size(); index++)
    {
        const std::string& line = lines[index];
        long long step_row = 0;
        long long step_column = 0;
        if (line == "U") { step_row = -1; }
        else if (line == "D") { step_row = 1; }
        else if (line == "L") { step_column = -1; }
        else if (line == "R") { step_column = 1; }
        else if (line == "DROP") { parcels.insert({row, column}); continue; }
        else { fail("unknown command '" + line + "'"); }

        row += step_row;
        column += step_column;
        if (row < 0 || row >= height || column < 0 || column >= width)
        {
            die("the courier stepped off the grid");
        }
        visited.insert({row, column});
    }

    if (mode == "--pos")
    {
        std::cout << row << ' ' << column << '\n';
    }
    else if (mode == "--visited")
    {
        std::cout << visited.size() << '\n';
    }
    else if (mode == "--map")
    {
        for (long long r = 0; r < height; r++)
        {
            std::string rendered;
            for (long long c = 0; c < width; c++)
            {
                if (r == row && c == column) { rendered += '@'; }
                else if (parcels.count({r, c}) != 0) { rendered += '*'; }
                else { rendered += '.'; }
            }
            std::cout << rendered << '\n';
        }
    }
    else
    {
        fail("unknown mode '" + mode + "'");
    }

    return 0;
}
```

### Go

<!-- listing-go -->
```go
// Reference solution for the CMSC 124 Courier case study.

package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type cell struct {
	row    int64
	column int64
}

func fail(format string, arguments ...any) {
	fmt.Fprintf(os.Stderr, "exam: "+format+"\n", arguments...)
	os.Exit(65)
}

func die(format string, arguments ...any) {
	fmt.Fprintf(os.Stderr, "exam: "+format+"\n", arguments...)
	os.Exit(70)
}

func number(text string, complaint string) int64 {
	value, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		fail("%s", complaint)
	}
	return value
}

func main() {
    // os.Args[0] is the executable. Slice it away before reading the mode.
	arguments := os.Args[1:]
	if len(arguments) != 2 {
		fail("usage: run <--pos|--visited|--map> <path>")
	}
	mode := arguments[0]
	path := arguments[1]

	source, err := os.ReadFile(path)
	if err != nil {
		fail("cannot read '%s': %v", path, err)
	}

	lines := []string{}
	for _, raw := range strings.Split(string(source), "\n") {
		line := strings.TrimSuffix(raw, "\r")
		if line != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) == 0 {
		fail("the file has no header line")
	}

	header := strings.Split(lines[0], " ")
	if len(header) != 2 {
		fail("the header needs a height and a width")
	}
	height := number(header[0], "bad height")
	width := number(header[1], "bad width")
	if height < 1 || height > 20 || width < 1 || width > 20 {
		fail("the height and width must each be between 1 and 20")
	}

	parcels := map[cell]bool{}
	visited := map[cell]bool{}
	var row int64 = 0
	var column int64 = 0
	// A map keyed by cell coordinates records each visited cell once.
	visited[cell{row, column}] = true

	for _, line := range lines[1:] {
		var stepRow, stepColumn int64
		switch line {
		case "U":
			stepRow = -1
		case "D":
			stepRow = 1
		case "L":
			stepColumn = -1
		case "R":
			stepColumn = 1
		case "DROP":
			parcels[cell{row, column}] = true
			continue
		default:
			fail("unknown command '%s'", line)
		}

		row += stepRow
		column += stepColumn
		if row < 0 || row >= height || column < 0 || column >= width {
			die("the courier stepped off the grid")
		}
		visited[cell{row, column}] = true
	}

	switch mode {
	case "--pos":
		fmt.Printf("%d %d\n", row, column)
	case "--visited":
		fmt.Printf("%d\n", len(visited))
	case "--map":
		for r := int64(0); r < height; r++ {
			rendered := strings.Builder{}
			for c := int64(0); c < width; c++ {
				switch {
				case r == row && c == column:
					rendered.WriteByte('@')
				case parcels[cell{r, c}]:
					rendered.WriteByte('*')
				default:
					rendered.WriteByte('.')
				}
			}
			fmt.Println(rendered.String())
		}
	default:
		fail("unknown mode '%s'", mode)
	}
}
```

### Julia

<!-- listing-julia -->
```julia
# Reference solution for the CMSC 124 Courier case study.
#
# Everything lives inside main() so the simulation's variables are locals. At
# top level a `for` loop starts a new scope, and assigning to `row` from inside
# one would need a `global` declaration in every nested loop.

function fail(message)
    println(stderr, "exam: $message")
    exit(65)
end

function die(message)
    println(stderr, "exam: $message")
    exit(70)
end

function number(text, complaint)
    value = tryparse(Int, text)
    value === nothing && fail(complaint)
    return value
end

function readlines_nonempty(path)
    source = try
        read(path, String)
    catch error
        fail("cannot read '$path': $(sprint(showerror, error))")
    end
    kept = String[]
    for raw in split(source, '\n')
        line = String(rstrip(raw, '\r'))
        if !isempty(line)
            push!(kept, line)
        end
    end
    return kept
end

function main()
    # Julia arrays are 1-indexed, so ARGS[1] is the mode and ARGS[2] is the path.
    if length(ARGS) != 2
        fail("usage: run <--pos|--visited|--map> <path>")
    end
    mode = ARGS[1]
    lines = readlines_nonempty(ARGS[2])
    if isempty(lines)
        fail("the file has no header line")
    end

    header = split(lines[1], ' ')
    if length(header) != 2
        fail("the header needs a height and a width")
    end
    height = number(header[1], "bad height")
    width = number(header[2], "bad width")
    if height < 1 || height > 20 || width < 1 || width > 20
        fail("the height and width must each be between 1 and 20")
    end

    parcels = Set{Tuple{Int,Int}}()
    visited = Set{Tuple{Int,Int}}()
    row = 0
    column = 0
    # Coordinate tuples stay zero-based even though Julia arrays start at one.
    push!(visited, (row, column))

    for line in lines[2:end]
        step_row = 0
        step_column = 0
        if line == "U"
            step_row = -1
        elseif line == "D"
            step_row = 1
        elseif line == "L"
            step_column = -1
        elseif line == "R"
            step_column = 1
        elseif line == "DROP"
            push!(parcels, (row, column))
            continue
        else
            fail("unknown command '$line'")
        end

        row += step_row
        column += step_column
        if row < 0 || row >= height || column < 0 || column >= width
            die("the courier stepped off the grid")
        end
        push!(visited, (row, column))
    end

    if mode == "--pos"
        println("$row $column")
    elseif mode == "--visited"
        println(length(visited))
    elseif mode == "--map"
        # Rows and columns are counted from zero in this problem, so nothing
        # in this loop indexes a Julia array.
        for r in 0:(height - 1)
            rendered = Char[]
            for c in 0:(width - 1)
                if r == row && c == column
                    push!(rendered, '@')
                elseif (r, c) in parcels
                    push!(rendered, '*')
                else
                    push!(rendered, '.')
                end
            end
            println(String(rendered))
        end
    else
        fail("unknown mode '$mode'")
    end
end

main()
```

---

*This post-mortem Courier case study was prepared for CMSC 124 (Design and Implementation of Programming Languages)
by Rene Andre Bedonia Jocsing as a reference for the reasoning behind the CMSC 124 Lab 0 Practical Exam.*
