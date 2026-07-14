---
title: "Interactive Diagram Demo: Bubble Sort"
subtitle: Watch adjacent values move into order
lead: A browser-ready example of a step-by-step sorting visualization with submission actions.
published: 2026-03-10
isDraft: false
noDeadline: true
downloadLink: https://example.com/downloads/bubble-sort-demo.pdf
tags:
  - demo
  - interactive-diagrams
submissions:
  - name: Submit implementation (demo)
    link: https://example.com/submissions/bubble-sort-code
  - name: Submit reflection (demo)
    link: https://example.com/submissions/bubble-sort-reflection
diagrams:
  - title: Bubble sort — first pass
    description: Compare neighboring values and swap them when the left value is larger.
    steps:
      - title: Start with the unsorted array
        description: The first comparison will be 5 and 2.
        mermaid: |
          flowchart LR
              A["5"] --> B["2"] --> C["4"] --> D["1"]
              classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class A,B active
      - title: Swap 5 and 2
        description: Because 5 is greater than 2, the pair changes places.
        mermaid: |
          flowchart LR
              B["2"] --> A["5"] --> C["4"] --> D["1"]
              classDef settled fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class B settled
              class A,C active
      - title: Swap 5 and 4
        description: Five moves right again after the next comparison.
        mermaid: |
          flowchart LR
              B["2"] --> C["4"] --> A["5"] --> D["1"]
              classDef settled fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class B,C settled
              class A,D active
      - title: Swap 5 and 1
        description: The largest value has reached the end of the array after one pass.
        mermaid: |
          flowchart LR
              B["2"] --> C["4"] --> D["1"] --> A["5"]
              classDef settled fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              class A settled
---

## What to try

Use **Previous** and **Next** to inspect each comparison, then select **Play** to run the pass automatically.

The submission buttons above are placeholders. They open `example.com` and do not submit data.
