---
title: "Interactive Diagram Demo: Breadth-First Search"
subtitle: Follow the queue across a small graph
lead: A graph traversal example showing the visited set and frontier at each step.
published: 2026-03-11
isDraft: false
noDeadline: true
downloadLink: https://example.com/downloads/bfs-demo.pdf
tags:
  - demo
  - interactive-diagrams
submissions:
  - name: Submit traversal trace (demo)
    link: https://example.com/submissions/bfs-trace
  - name: Submit source code (demo)
    link: https://example.com/submissions/bfs-code
diagrams:
  - title: Breadth-first search from A
    key: bfs-traversal
    description: Green nodes are visited; red nodes are currently in the queue.
    steps:
      - title: Enqueue the starting node
        description: The queue contains A.
        mermaid: |
          flowchart TB
              A((A)) --> B((B))
              A --> C((C))
              B --> D((D))
              B --> E((E))
              C --> F((F))
              classDef frontier fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class A frontier
      - title: Visit A and enqueue its neighbors
        description: A is visited; B and C enter the queue.
        mermaid: |
          flowchart TB
              A((A)) --> B((B))
              A --> C((C))
              B --> D((D))
              B --> E((E))
              C --> F((F))
              classDef visited fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              classDef frontier fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class A visited
              class B,C frontier
      - title: Visit B and extend the queue
        description: D and E are discovered behind C.
        mermaid: |
          flowchart TB
              A((A)) --> B((B))
              A --> C((C))
              B --> D((D))
              B --> E((E))
              C --> F((F))
              classDef visited fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              classDef frontier fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class A,B visited
              class C,D,E frontier
      - title: Visit C and discover F
        description: The remaining queue is D, E, F.
        mermaid: |
          flowchart TB
              A((A)) --> B((B))
              A --> C((C))
              B --> D((D))
              B --> E((E))
              C --> F((F))
              classDef visited fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              classDef frontier fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px
              class A,B,C visited
              class D,E,F frontier
      - title: Finish the traversal
        description: Every reachable node has been visited in breadth-first order.
        mermaid: |
          flowchart TB
              A((A)) --> B((B))
              A --> C((C))
              B --> D((D))
              B --> E((E))
              C --> F((F))
              classDef visited fill:#16a34a,color:#ffffff,stroke:#166534,stroke-width:2px
              class A,B,C,D,E,F visited
---

## Queue trace

<!-- diagram: bfs-traversal -->

The step descriptions mirror the queue states `A` → `B, C` → `C, D, E` → `D, E, F` → empty.

The submission buttons above are placeholders. They open `example.com` and do not submit data.
