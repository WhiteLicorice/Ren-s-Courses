---
title: Fixture Laboratory
subtitle: Fixture Course A Lab 1
lead: A permanent material for the end-to-end suite.
published: 2026-09-01
deadline: 2026-09-20
tags: [fixture-course-a]
authors:
    - name: "Fixture Author"
      gitHubUserName: "fixture-author"
      nickname: "Fixture"
---

This material exists only for the end-to-end suite. It is test infrastructure, not course content. Change it only together with the specs that read it.

## Setup

Open a terminal and run the build script.

```bash
./build.sh
./run tests/lab1/hello.src
```

## Layout

The block below has no language label. Its last line is wider than any viewport, so the block scrolls sideways.

```
<repo-root>/
  build.sh                      <- builds your interpreter, once
  run                           <- executes it: ./run <path-to-source-file>
  tests/
    lab1/
      hello.src
      hello.expected
  a-very-long-path-segment/that-keeps-going/past-the-right-edge/of-the-article-column/so-the-code-block-must-scroll-sideways/to-show-this-line.txt
```

## Program

```python
def greet(name):
    return f"Hello, {name}!"


print(greet("fixture"))
```

## Submission

Push the commit and check the workflow result.
