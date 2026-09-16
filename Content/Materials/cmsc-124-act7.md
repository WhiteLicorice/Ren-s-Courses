---
title: Walk the Parser
subtitle: CMSC 124 Activity 7
lead: Monkey see, monkey climb tree.
published: 2026-09-17
deadline: 2026-09-17
tags: [cmsc-124]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
isDraft: false
diagrams:
  - title: Descend to the first operand
    key: parser-builds-ast-descend
    description: Each frame keeps the complete token stream, grammar rule, and parser function in view. Bold marks the token consumed and the line running in that frame.
    steps:
      - title: expression() calls term()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              expression ::= **term**`"]
              C["`code          ​
              expression(): ​
              **return term()** ​`"]
              S["`active calls
              expression() → term()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: term() calls factor()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `term()` requests its first operand. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              term ::= **factor** { ( PLUS | MINUS ) factor }`"]
              C["`code                                      ​
              term():                                   ​
              **node = factor()**                           ​
              while match(PLUS, MINUS):                 ​
              node = Binary(node, previous(), factor()) ​
              return node                               ​`"]
              S["`active calls
              expression() → term() → factor()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: factor() calls primary()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `factor()` requests its first operand. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= **primary** { ( STAR | SLASH ) primary }`"]
              C["`code                                       ​
              factor():                                  ​
              **node = primary()**                           ​
              while match(STAR, SLASH):                  ​
              node = Binary(node, previous(), primary()) ​
              return node                                ​`"]
              S["`active calls
              expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Match the first operand, then unwind to factor()
    key: parser-builds-ast-first-match
    description: The parser reaches the bottom rule. Watch the first match, then watch `primary()` leave the call stack.
    steps:
      - title: primary() matches NUMBER(4)
        description: |
          **NUMBER(4)** `PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The `NUMBER` alternative matches. `primary()` consumes the token and creates `Number(4)`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              primary ::= **NUMBER** | LEFT_PAREN expression RIGHT_PAREN`"]
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              S["`primary holds Number(4)
              active: expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: primary() returns Number(4) to factor()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `primary()` leaves the call stack. `factor()` receives `Number(4)` as its first operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              B["`stack before
              expression() → term() → factor() → primary()`"]
              A["`stack after
              primary() removed
              factor node: Number(4)`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
      - title: factor() tests for a multiplicative operator and fails
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `match(STAR, SLASH)` sees `PLUS` and answers false. The loop body never runs and no token moves.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= primary { **( STAR | SLASH )** primary }`"]
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              **while match(STAR, SLASH):**                  ​
              node = Binary(node, previous(), primary()) ​
              return node                                ​`"]
              S["`factor node: Number(4)
              active: expression() → term() → factor()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Return to term() and take the operator
    key: parser-builds-ast-first-unwind
    description: Control returns to `term()`. The parser then takes `PLUS` and asks for the operand on its right.
    steps:
      - title: factor() returns Number(4) to term()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `factor()` leaves the call stack. `term()` receives `Number(4)` as its first operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              while match(STAR, SLASH):                  ​
              node = Binary(node, previous(), primary()) ​
              **return node**                                ​`"]
              B["`stack before
              expression() → term() → factor()`"]
              A["`stack after
              factor() removed
              term node: Number(4)`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
      - title: term() consumes PLUS
        description: |
          `NUMBER(4)` **PLUS** `NUMBER(5) STAR NUMBER(2) EOF`

          The repetition matches. `term()` saves the operator before it requests the right operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              term ::= factor { **( PLUS | MINUS )** factor }`"]
              C["`code                                      ​
              term():                                   ​
              node = factor()                           ​
              **while match(PLUS, MINUS):**                 ​
              node = Binary(node, previous(), factor()) ​
              return node                               ​`"]
              S["`term holds Number(4) and PLUS
              active: expression() → term()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: term() calls factor() for the right operand
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The loop body requests the operand to the right of `PLUS`. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              term ::= factor { ( PLUS | MINUS ) **factor** }`"]
              C["`code                                      ​
              term():                                   ​
              node = factor()                           ​
              while match(PLUS, MINUS):                 ​
              **node = Binary(node, previous(), factor())** ​
              return node                               ​`"]
              S["`active calls
              expression() → term() → factor()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Descend to the second operand
    key: parser-builds-ast-right-descend
    description: The parser descends again for the operand after `PLUS`. The same call pattern repeats.
    steps:
      - title: factor() calls primary()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The new `factor()` requests its first operand. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= **primary** { ( STAR | SLASH ) primary }`"]
              C["`code                                       ​
              factor():                                  ​
              **node = primary()**                           ​
              while match(STAR, SLASH):                  ​
              node = Binary(node, previous(), primary()) ​
              return node                                ​`"]
              S["`active calls
              expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: primary() matches NUMBER(5)
        description: |
          `NUMBER(4) PLUS` **NUMBER(5)** `STAR NUMBER(2) EOF`

          The `NUMBER` alternative matches. `primary()` consumes the token and creates `Number(5)`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              primary ::= **NUMBER** | LEFT_PAREN expression RIGHT_PAREN`"]
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              S["`primary holds Number(5)
              active: expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: primary() returns Number(5) to factor()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `primary()` leaves the call stack. `factor()` receives `Number(5)` as its left operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              B["`stack before
              expression() → term() → factor() → primary()`"]
              A["`stack after
              primary() removed
              factor node: Number(5)`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
  - title: Take the multiplicative operator and its operand
    key: parser-builds-ast-right-factor
    description: The loop inside `factor()` takes `STAR`. It then asks for the operand on the right of `STAR`.
    steps:
      - title: factor() consumes STAR
        description: |
          `NUMBER(4) PLUS NUMBER(5)` **STAR** `NUMBER(2) EOF`

          The repetition matches. `factor()` saves the operator before it requests the right operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= primary { **( STAR | SLASH )** primary }`"]
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              **while match(STAR, SLASH):**                  ​
              node = Binary(node, previous(), primary()) ​
              return node                                ​`"]
              S["`factor holds Number(5) and STAR
              active: expression() → term() → factor()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: factor() calls primary() for the right operand
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The loop body requests the operand to the right of `STAR`. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= primary { ( STAR | SLASH ) **primary** }`"]
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              while match(STAR, SLASH):                  ​
              **node = Binary(node, previous(), primary())** ​
              return node                                ​`"]
              S["`active calls
              expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
      - title: primary() matches NUMBER(2)
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR` **NUMBER(2)** `EOF`

          The `NUMBER` alternative matches. `primary()` consumes the token and creates `Number(2)`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              primary ::= **NUMBER** | LEFT_PAREN expression RIGHT_PAREN`"]
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              S["`primary holds Number(2)
              active: expression() → term() → factor() → primary()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Build the multiplication subtree
    key: parser-builds-ast-mult
    description: Both multiplication operands are ready. `factor()` joins them, then tests for another multiplicative operator.
    steps:
      - title: primary() returns Number(2) to factor()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `primary()` leaves the call stack. `factor()` now holds both multiplication operands.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                            ​
              primary():                                      ​
              **if match(NUMBER): return Number(previous token)** ​
              if match(LEFT_PAREN):                           ​
              node = expression()                             ​
              consume(RIGHT_PAREN); return Group(node)        ​
              report an error at peek()                       ​`"]
              B["`stack before
              expression() → term() → factor() → primary()`"]
              A["`stack after
              primary() removed
              factor holds Number(5), STAR, Number(2)`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
      - title: factor() builds the multiplication subtree
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The loop body joins the saved left operand, operator, and returned right operand. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= primary **{ ( STAR | SLASH ) primary }**`"]
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              while match(STAR, SLASH):                  ​
              **node = Binary(node, previous(), primary())** ​
              return node                                ​`"]
              G --> C
              C --> M["Binary *"]
              M --> N5["Number(5)"]
              M --> N2["Number(2)"]
              classDef mono font-family:monospace
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class C mono
              class M result
      - title: factor() tests for a second multiplicative operator and fails
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `match(STAR, SLASH)` sees `EOF` and answers false. The loop ends and no token moves.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              factor ::= primary { **( STAR | SLASH )** primary }`"]
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              **while match(STAR, SLASH):**                  ​
              node = Binary(node, previous(), primary()) ​
              return node                                ​`"]
              S["`factor node: Binary(5, STAR, 2)
              active: expression() → term() → factor()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Build the addition tree
    key: parser-builds-ast-add
    description: The multiplication subtree moves up to `term()`. Then `term()` joins its saved parts into the addition tree.
    steps:
      - title: factor() returns the multiplication subtree to term()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `factor()` leaves the call stack. `term()` receives the multiplication subtree as its right operand.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                       ​
              factor():                                  ​
              node = primary()                           ​
              while match(STAR, SLASH):                  ​
              node = Binary(node, previous(), primary()) ​
              **return node**                                ​`"]
              B["`stack before
              expression() → term() → factor()`"]
              A["`stack after
              factor() removed
              term receives Binary(5, STAR, 2)`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
      - title: term() builds the addition tree
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          The loop body joins its saved parts with the multiplication subtree. No token is consumed.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              term ::= factor **{ ( PLUS | MINUS ) factor }**`"]
              C["`code                                      ​
              term():                                   ​
              node = factor()                           ​
              while match(PLUS, MINUS):                 ​
              **node = Binary(node, previous(), factor())** ​
              return node                               ​`"]
              G --> C
              C --> A["Binary +"]
              A --> N4["Number(4)"]
              A --> M["Binary *"]
              M --> N5["Number(5)"]
              M --> N2["Number(2)"]
              classDef mono font-family:monospace
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class C mono
              class A,M result
      - title: term() tests for a second additive operator and fails
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `match(PLUS, MINUS)` sees `EOF` and answers false. The loop ends and no token moves.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              term ::= factor { **( PLUS | MINUS )** factor }`"]
              C["`code                                      ​
              term():                                   ​
              node = factor()                           ​
              **while match(PLUS, MINUS):**                 ​
              node = Binary(node, previous(), factor()) ​
              return node                               ​`"]
              S["`term node: complete tree
              active: expression() → term()`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              class C mono
              class S current
  - title: Unwind to the start rule
    key: parser-builds-ast-final-returns
    description: The finished tree leaves `term()` and reaches `expression()`. The parse ends.
    steps:
      - title: term() returns the complete tree to expression()
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `term()` leaves the call stack. `expression()` receives the finished tree.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["`code                                      ​
              term():                                   ​
              node = factor()                           ​
              while match(PLUS, MINUS):                 ​
              node = Binary(node, previous(), factor()) ​
              **return node**                               ​`"]
              B["`stack before
              expression() → term()`"]
              A["`stack after
              term() removed
              expression holds the complete tree`"]
              C --> B --> A
              classDef mono font-family:monospace
              classDef unwind fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              class C mono
              class A unwind
      - title: expression() returns the complete AST
        description: |
          `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`

          `expression()` returns the tree. `EOF` remains unread because no expression rule consumes it.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              G["`grammar
              expression ::= **term**`"]
              C["`code          ​
              expression(): ​
              **return term()** ​`"]
              S["`no active parser calls
              final AST returned`"]
              G --> C --> S
              classDef mono font-family:monospace
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class C mono
              class S result
  - title: Watch the stalled calls pile up
    key: left-recursion-stall
    description: Each frame keeps the same unread token in view. No frame consumes input, so the stack only grows.
    steps:
      - title: First chain() call sees NUMBER(1)
        description: |
          `NUMBER(1) PLUS NUMBER(2) PLUS NUMBER(3) EOF`

          No token is consumed. The first `chain()` picks the recursive alternative and calls itself.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              T["next unread<br/>NUMBER(1)"] --> C1["chain() #1<br/>no consume"]
              classDef tok fill:#f3f4f6,stroke:#9ca3af,color:#111827
              classDef bad fill:#fee2e2,stroke:#dc2626,stroke-width:3px,color:#111827
              class T tok
              class C1 bad
      - title: Second chain() call sees the same NUMBER(1)
        description: |
          `NUMBER(1) PLUS NUMBER(2) PLUS NUMBER(3) EOF`

          No token is consumed. The second call repeats the same choice. The stack now holds two frames.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              T["next unread<br/>NUMBER(1)"] --> C1["chain() #1"] --> C2["chain() #2<br/>no consume"]
              classDef tok fill:#f3f4f6,stroke:#9ca3af,color:#111827
              classDef bad fill:#fee2e2,stroke:#dc2626,stroke-width:3px,color:#111827
              class T tok
              class C1,C2 bad
      - title: Third chain() call still sees NUMBER(1)
        description: |
          `NUMBER(1) PLUS NUMBER(2) PLUS NUMBER(3) EOF`

          No token is consumed. A third frame starts the same way. The descent never reaches `item`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              T["next unread<br/>NUMBER(1)"] --> C1["chain() #1"] --> C2["chain() #2"] --> C3["chain() #3<br/>never reaches item"]
              classDef tok fill:#f3f4f6,stroke:#9ca3af,color:#111827
              classDef bad fill:#fee2e2,stroke:#dc2626,stroke-width:3px,color:#111827
              class T tok
              class C1,C2,C3 bad
  - title: How the replacement rule repairs the stall
    key: left-recursion-rewrite
    description: The old and replacement rules are successive versions. The replacement reads one item before its loop, so every later pass starts from input already consumed.
    steps:
      - title: Replace the rule, then map its parts to code
        description: |
          `chain ::= chain PLUS item | item` is the old rule to remove. `chain ::= item { PLUS item }` is the replacement to use, the repaired version. The first `item()` call returns the value stored in `node`, which becomes the seed for the loop.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              OLD["Old rule: remove<br/>self-call comes first"] -. "replace, don't combine" .-> NEW["Replacement: use<br/>item { PLUS item }"]
              NEW --> MAP["item maps to the seed node<br/>{ PLUS item } maps to the loop<br/>assignment makes the left fold"]
              classDef old fill:#f3f4f6,stroke:#9ca3af,color:#111827
              classDef good fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class OLD old
              class NEW,MAP good
  - title: Fold 1 + 2 + 3 from the left
    key: left-associative-fold
    description: The accumulator node carries the previous tree into each pass. Each frame shows the whole tree so far.
    steps:
      - title: Seed node, then run the first pass
        description: |
          **NUMBER(1)** **PLUS** **NUMBER(2)** `PLUS NUMBER(3) EOF`

          `node` starts as `Number(1)`. The first pass uses that node as its left child and produces `Binary(Number(1), PLUS, Number(2))`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              SEED["seed<br/>node = Number(1)"] --> PASS["first pass<br/>node = Binary +"]
              PASS --> N1["Number(1)"]
              PASS --> N2["Number(2)"]
              classDef mono font-family:monospace
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class SEED mono
              class PASS,N1,N2 result
      - title: Second pass builds ((1 + 2) + 3)
        description: |
          `NUMBER(1) PLUS NUMBER(2)` **PLUS** **NUMBER(3)** `EOF`

          The pass carries the whole first tree as its left child. It builds `Binary(Binary(Number(1), PLUS, Number(2)), PLUS, Number(3))`.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart LR
              C["node = Binary<br/>second pass"] --> B["Binary +"]
              B --> A["Binary +"]
              B --> N3["Number(3)"]
              A --> N1["Number(1)"]
              A --> N2["Number(2)"]
              classDef mono font-family:monospace
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              class C mono
              class B,A,N1,N2,N3 result
  - title: Move the token position to the next expression
    key: synchronization-token-trace
    description: After the call stack resets, recovery discards input to the semicolon and starts a separate expression after it.
    steps:
      - title: Discard the bad token and consume the boundary
        description: |
          `NUMBER(4) PLUS` **RIGHT_PAREN** **SEMICOLON** `NUMBER(2) SEMICOLON EOF`

          `discard()` advances past `RIGHT_PAREN` without creating a node. `match(SEMICOLON)` then consumes the boundary, so `NUMBER(2)` becomes the next unread token.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart TB
              PAST["past<br/>NUMBER(4) PLUS"] --> D["discarded now<br/>RIGHT_PAREN"] --> B["boundary consumed now<br/>SEMICOLON"] --> PEEK["peek()<br/>NUMBER(2)"] --> REST["later<br/>SEMICOLON EOF"]
              classDef disc fill:#ffedd5,stroke:#ea580c,color:#111827
              classDef bound fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#111827
              classDef resume fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef none fill:#f3f4f6,stroke:#9ca3af,color:#111827
              class PAST,REST none
              class D disc
              class B bound
              class PEEK resume
  - title: Start a separate expression after the boundary
    key: synchronization-restart-trace
    description: Recovery has ended. The program driver now starts a new parse at the next unread token.
    steps:
      - title: Parse the next expression and keep only its AST
        description: |
          `NUMBER(4) PLUS RIGHT_PAREN SEMICOLON` **NUMBER(2)** **SEMICOLON** `EOF`

          A new `expression()` consumes `NUMBER(2)`. The driver consumes its semicolon and keeps `Number(2)`. The failed expression remains separate and contributes no completed AST.
        mermaid: |
          %%{init: {"flowchart": {"wrappingWidth": 520}}}%%
          flowchart TB
              PAST["past<br/>NUMBER(4) PLUS RIGHT_PAREN SEMICOLON"] --> DONE["consumed now<br/>NUMBER(2) SEMICOLON"] --> PEEK["peek()<br/>EOF"]
              BAD["first expression<br/>partial Number(4) abandoned"]
              GOOD["second expression<br/>Number(2) complete"]
              classDef resume fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827
              classDef result fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#111827
              classDef none fill:#f3f4f6,stroke:#9ca3af,color:#111827
              class PAST,PEEK,BAD none
              class DONE resume
              class GOOD result
---

A **recursive-descent parser** is a top-down parser with one function for each grammar rule. **Top down** means it begins at the start rule and asks which grammar alternative can consume the next tokens. Today you'll keep three traces side by side: the next unread token, the active parser calls, and the syntax tree built so far.

The parser below is pseudocode. It's written to be read. Every helper it calls is defined on this page. Laboratory Activity 2 is where this turns into code, since the recursive descent and the synchronization you trace today are what that laboratory asks you to implement.

You have 60 minutes for the three checkpoints. Keep each worked example beside the checkpoint it supports. You may discuss with classmates and the instructor throughout. This activity is worth 20 points. Twelve points reward parser constructions, and eight reward the reasoning behind them.

## Grammar and Parser Contract

Use this Extended Backus-Naur Form (EBNF) grammar:

```text
expression ::= term
term       ::= factor { ( PLUS | MINUS ) factor }
factor     ::= primary { ( STAR | SLASH ) primary }
primary    ::= NUMBER | LEFT_PAREN expression RIGHT_PAREN
```

The bottom three rules are Activity 4's levels under the same labels. `term` handles addition and subtraction. Below it, `factor` handles multiplication and division, while `primary` handles a number or a parenthesized expression.

A **nonterminal** is a named grammar rule such as `term`. The parser translates each rule almost literally. It turns nonterminals into same-label functions, references into calls, tokens into consuming checks, alternatives into branches, and EBNF repetitions into loops.

Start with the smallest rule. In `primary`, the `NUMBER` alternative becomes the first `if`. The parenthesized alternative consumes `LEFT_PAREN`, calls `expression()` for the nested nonterminal, and then requires `RIGHT_PAREN`. The function returns the syntax-tree node built by the alternative that matched.

`peek()` returns the next token without consuming it. `match(types...)` takes one or more token types, consumes the next token when it's any of them, and answers true or false. The three dots say the call accepts one or more types, so `match(PLUS, MINUS)` asks one question about two operators. `previous()` returns the token `match` last consumed. `consume(T)` requires and consumes type `T`. If that type isn't next, it reports an error and fails the current expression.

A token is **consumed** once the parser advances past it. The **next unread token** is the token at the parser's current position. The **call stack** is the ordered set of parser functions that have started but haven't returned. `EOF` means **end of file**. It marks the end of the token stream. These expression functions leave it unread.

*Read `term ::= factor { ( PLUS | MINUS ) factor }` as "term produces a factor followed by zero or more plus-or-minus factor pairs." Read `primary()` as "call primary."*

```text
expression():  // expression ::= term
    return term()

term():        // term ::= factor { ( PLUS | MINUS ) factor }
    node = factor()
    while match(PLUS, MINUS):
        node = Binary(node, previous(), factor())
    return node

factor():      // factor ::= primary { ( STAR | SLASH ) primary }
    node = primary()
    while match(STAR, SLASH):
        node = Binary(node, previous(), primary())
    return node

primary():     // primary ::= NUMBER | LEFT_PAREN expression RIGHT_PAREN
    if match(NUMBER): return Number(previous token)
    if match(LEFT_PAREN):
        node = expression()
        consume(RIGHT_PAREN); return Group(node)
    report an error at peek() and fail this expression
```

An **abstract syntax tree** (AST) keeps meaningful structure and omits grammar bookkeeping. We'll write `Binary(left, operator, right)`, `Number(value)`, and `Group(inner)`. A group node has one child and records that the source wrapped it in parentheses, so a printer walking the tree can put those parentheses back where the programmer wrote them.

*Read `Binary(left, operator, right)` as "a binary node with this left child, operator, and right child." Read `Group(inner)` as "a group node holding this one child."*

For this grammar, `expression()` only returns `term()`. That short function gives every caller one stable entry point for a complete expression. A later grammar can place assignment or equality between `expression` and `term` without changing `primary()` or any caller outside the parser.

### Worked Example for Checkpoint 1

*Suggested time: 28 minutes, including the worked example.*

Parse `NUMBER(4) PLUS NUMBER(5) STAR NUMBER(2) EOF`.

Begin with a fresh parser. No parser function is active. The next unread token is `NUMBER(4)`. No AST node exists. The parser enters the start rule by calling `expression()`.

Follow the frames in order. Calls, matches, failed matches, tree updates, and returns each get their own figure. The complete token stream appears under every figure heading. A bold token is consumed in that figure. When no token is bold, the parser position doesn't move.

<!-- newpage -->

<!-- diagram: parser-builds-ast-descend -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-first-match -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-first-unwind -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-right-descend -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-right-factor -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-mult -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-add -->

<!-- newpage -->

<!-- diagram: parser-builds-ast-final-returns -->

Only `match` and `consume` advance the token position. Calls and returns change the active stack, while assignments to `node` change the AST fragment. Use the same after-consumption convention in your trace.

The multiplication becomes a complete subtree before the addition can be built. `term()` asks `factor()` for its entire right operand, so `term()` must wait until `factor()` returns. The final AST is `Binary(Number(4), PLUS, Binary(Number(5), STAR, Number(2)))`.

### Checkpoint 1: Keep Three Traces (8 Points)

#### Running Token Stream

Parse this stream. The numbers carry their lexemes.

```text
NUMBER(6) MINUS NUMBER(2) STAR NUMBER(3) EOF
```

Keep this contract beside you while you trace. You don't need to flip back to the front page.

```text
expression ::= term
term       ::= factor { ( PLUS | MINUS ) factor }
factor     ::= primary { ( STAR | SLASH ) primary }
primary    ::= NUMBER | LEFT_PAREN expression RIGHT_PAREN
```

```text
expression():  // expression ::= term
    return term()

term():        // term ::= factor { ( PLUS | MINUS ) factor }
    node = factor()
    while match(PLUS, MINUS):
        node = Binary(node, previous(), factor())
    return node

factor():      // factor ::= primary { ( STAR | SLASH ) primary }
    node = primary()
    while match(STAR, SLASH):
        node = Binary(node, previous(), primary())
    return node

primary():     // primary ::= NUMBER | LEFT_PAREN expression RIGHT_PAREN
    if match(NUMBER): return Number(previous token)
    if match(LEFT_PAREN):
        node = expression()
        consume(RIGHT_PAREN); return Group(node)
    report an error at peek() and fail this expression
```

`match(types...)` consumes the next token when its type is listed and answers true. `previous()` returns the token `match` last consumed. `consume(T)` requires type `T` at `peek()` and consumes it. Only `match` and `consume` move the token position.

Use the parser contract from this activity. `term()` first calls `factor()`. Its loop combines each `PLUS` or `MINUS` right operand with the tree already saved in `node`. `factor()` does the same for each `STAR` or `SLASH` right operand after it calls `primary()`. `primary()` consumes a number or a parenthesized expression. Record the next unread token after every consumption.

*Read `NUMBER(6) MINUS NUMBER(2) STAR NUMBER(3) EOF` as "number six, minus, number two, star, number three, end of file." Read `term()` and `factor()` as "call term" and "call factor."*

**1. (Construction: 5 points)** Make one trace entry for every consumed token. Each entry must show the token's index and type, the active call stack, the AST fragment returned or extended, and the next unread token. Finish by writing the complete AST.

**2. (Explanation: 3 points)** Explain why `factor()` consumes the multiplication before the outer `term()` can finish the subtraction. Then explain why the loop in `term()` makes a chain such as `8 - 3 - 2` associate left.


## Why Left Recursion Stalls

Take `1 + 2` with this addition grammar. You'll repair the same addition rule with `PLUS` in the worked example, then apply it to subtraction in the checkpoint.

See this old rule:

```text
chain ::= chain PLUS item | item
```

A literal `chain()` picks the first alternative and calls `chain()` again before it looks for `PLUS` or `item`. Each call sees the same unread token `NUMBER(1)` and consumes nothing. The stack grows by one frame per call and never reaches `item`.

A rule is **left recursive** when its first alternative starts with the rule itself. Recursive descent can't run that rule directly because the recursive call comes before any consumption.

<!-- newpage -->

<!-- diagram: left-recursion-stall -->

<!-- newpage -->

This rewritten grammar preserves accepted token sequences. It still accepts one `item` followed by zero or more `PLUS item` pairs. The accumulator assignment preserves left-associated AST construction. It carries the tree built so far into the next loop pass as the left child.

Use this replacement rule, repairing the defect:

```text
chain ::= item { PLUS item }
```

And its corresponding pseudocode:

```text
chain():
    node = item()
    while match(PLUS):
        operator = previous()
        right = item()
        node = Binary(node, operator, right)
    return node
```

<!-- diagram: left-recursion-rewrite -->

### Worked Example for Checkpoint 2

*Suggested time: 17 minutes, including the worked example.*

For `1 + 2 + 3`, the first `item()` call returns `Number(1)`. The first loop pass consumes `PLUS` and `Number(2)` and builds `Binary(Number(1), PLUS, Number(2))`. The second pass carries that whole tree as its left child and builds `Binary(Binary(Number(1), PLUS, Number(2)), PLUS, Number(3))`. Carrying `node` forward creates left grouping.

<!-- newpage -->

<!-- diagram: left-associative-fold -->

### Checkpoint 2: Turn Recursion into Progress (6 Points)

Repair this exact left-recursive rule while preserving its subtraction chains and left grouping:

```text
sum ::= sum MINUS product | product
```

**1. (Construction: 4 points)** Rewrite `sum` in EBNF without left recursion, then sketch the corresponding parser function. Its loop must consume one operator and one right operand per iteration.

**2. (Explanation: 2 points)** Explain why your rewrite accepts the same subtraction chains and preserves left associativity. Point to the assignment that carries the previous subtree into the next iteration.

Any rewrite must preserve the sequences, terminate, and associate left.

<!-- newpage -->

## Transfer Through an Error

For this section, place the expression grammar inside a small program rule:

```text
program ::= { expression SEMICOLON } EOF
```

Each semicolon ends one expression. If that expression fails, the program driver can skip it and try the expression after the semicolon.

**Synchronization** is error recovery that brings the parser back to a position where parsing can restart. It must repair two things. First, the failed expression calls must leave the call stack. Second, the parser must advance past bad input to a known boundary. Here, that boundary is `SEMICOLON` or `EOF`.

The scanner and parser answer different questions. The scanner turns the complete source into tokens before parsing begins. It accepts `)` because that character forms a valid `RIGHT_PAREN` token. The parser can still reject the token when the grammar requires `NUMBER` or `LEFT_PAREN` at its position.

### Worked Example for Checkpoint 3

*Suggested time: 15 minutes, including the worked example.*

The scanner turns `4 + ); 2;` into `NUMBER(4) PLUS RIGHT_PAREN SEMICOLON NUMBER(2) SEMICOLON EOF`. The driver starts the first expression at `NUMBER(4)`. After `term()` consumes `PLUS`, it calls `factor()`, which calls `primary()` for the missing right operand.

This is the decision that `primary()` makes:

```text
primary():     // primary ::= NUMBER | LEFT_PAREN expression RIGHT_PAREN
    if match(NUMBER): return Number(previous token)
    if match(LEFT_PAREN):
        node = expression()
        consume(RIGHT_PAREN); return Group(node)
    report an error at peek() and fail this expression
```

At this call, `peek()` is `RIGHT_PAREN`. It isn't `NUMBER`, so the first `match` answers false without consuming it. It isn't `LEFT_PAREN` either, so the second `match` also answers false. Execution then **falls through** to the final line. Falling through means that no earlier branch returned, so the function continues with the next statement. `primary()` reports the unread `RIGHT_PAREN` and fails the expression.

That failure returns through `factor()`, `term()`, and `expression()` until control reaches the program driver. These returns clear the failed expression calls from the stack. They don't consume `RIGHT_PAREN`. The partial `Number(4)` is abandoned because it never became a complete expression.

The following figures begin at that exact state. Bold means the parser advances past that token in the figure. Orange marks discarded input. Amber marks the consumed boundary. Blue marks the next expression's input. Gray marks an abandoned partial result.

<!-- newpage -->

<!-- diagram: synchronization-token-trace -->

<!-- newpage -->

<!-- diagram: synchronization-restart-trace -->

Recovery doesn't invent a right operand or turn `)` into one. The next parse starts separately at `NUMBER(2)` and produces the only completed AST, `Number(2)`.

This language-neutral driver shows where recovery runs. `discard()` advances past one token without creating an AST node.

```text
program():
    while peek() is not EOF:
        attempt expression() followed by consume(SEMICOLON)
        if the attempt succeeds:
            keep the completed expression AST
        otherwise:
            synchronize()

synchronize():
    while peek() is neither SEMICOLON nor EOF:
        discard()
    if match(SEMICOLON):
        return to program() at the token after the boundary
    return to program() at EOF
```

At `EOF`, the driver's loop stops. It doesn't call `expression()` again. After a semicolon, the loop starts a new attempt at the next token.

### Checkpoint 3: Recover and Continue (6 Points)

#### Running Source

Recover from this source:

```text
6 * (2 + ); 9 - 1;
```

Report the unexpected token. Let the failed expression calls return to the program driver. Discard tokens before the next `SEMICOLON`, consume that boundary, and restart at the token after it. If recovery reaches `EOF`, stop instead.

**1. (Construction: 3 points)** Tokenize the input. Mark the active call stack and rejected token at the first error. Then mark the discarded tokens, the consumed boundary, and the first token of the next expression. Draw only that expression's completed AST.

**2. (Explanation: 3 points)** Explain why the scanner accepts `)` but `primary()` rejects it here. Then explain why synchronization abandons the first expression, stops at the semicolon, and resumes at `9`.
