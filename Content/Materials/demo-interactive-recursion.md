---
title: "Interactive Diagram Demo: Recursion"
subtitle: Build and unwind the factorial call stack
lead: A sequence-diagram example that follows recursive calls and their return values.
published: 2026-03-12
isDraft: false
noDeadline: true
downloadLink: https://example.com/downloads/recursion-demo.pdf
tags:
  - demo
  - interactive-diagrams
submissions:
  - name: Submit stack trace (demo)
    link: https://example.com/submissions/recursion-trace
  - name: Submit explanation (demo)
    link: https://example.com/submissions/recursion-explanation
diagrams:
  - title: Evaluating factorial(3)
    description: Each call waits for the next smaller factorial before it can return.
    steps:
      - title: Call factorial(3)
        description: Main starts the recursive calculation.
        mermaid: |
          sequenceDiagram
              participant M as main
              participant F3 as factorial(3)
              M->>F3: factorial(3)
              activate F3
      - title: Recurse to factorial(2)
        description: factorial(3) needs the value of factorial(2).
        mermaid: |
          sequenceDiagram
              participant M as main
              participant F3 as factorial(3)
              participant F2 as factorial(2)
              M->>F3: factorial(3)
              activate F3
              F3->>F2: 3 × factorial(2)
              activate F2
      - title: Reach the base case
        description: factorial(2) calls factorial(1), which returns 1.
        mermaid: |
          sequenceDiagram
              participant M as main
              participant F3 as factorial(3)
              participant F2 as factorial(2)
              participant F1 as factorial(1)
              M->>F3: factorial(3)
              activate F3
              F3->>F2: 3 × factorial(2)
              activate F2
              F2->>F1: 2 × factorial(1)
              activate F1
              F1-->>F2: 1
              deactivate F1
      - title: Unwind factorial(2)
        description: factorial(2) multiplies 2 by 1 and returns 2.
        mermaid: |
          sequenceDiagram
              participant M as main
              participant F3 as factorial(3)
              participant F2 as factorial(2)
              participant F1 as factorial(1)
              M->>F3: factorial(3)
              activate F3
              F3->>F2: 3 × factorial(2)
              activate F2
              F2->>F1: 2 × factorial(1)
              activate F1
              F1-->>F2: 1
              deactivate F1
              F2-->>F3: 2
              deactivate F2
      - title: Return the final result
        description: factorial(3) multiplies 3 by 2 and returns 6 to main.
        mermaid: |
          sequenceDiagram
              participant M as main
              participant F3 as factorial(3)
              participant F2 as factorial(2)
              participant F1 as factorial(1)
              M->>F3: factorial(3)
              activate F3
              F3->>F2: 3 × factorial(2)
              activate F2
              F2->>F1: 2 × factorial(1)
              activate F1
              F1-->>F2: 1
              deactivate F1
              F2-->>F3: 2
              deactivate F2
              F3-->>M: 6
              deactivate F3
---

## Reading the sequence

The growing activation bars represent pending stack frames; the dashed arrows show values returning as the stack unwinds.

The submission buttons above are placeholders. They open `example.com` and do not submit data.
