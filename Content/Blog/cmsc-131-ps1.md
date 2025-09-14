---
title: CMSC 131 Problem Set 1
lead: CMSC 131 PS1 - IEEE-754 floating-point representation and x86 register manipulation.
published: 2025-09-15
tags: [cmsc-131]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      xUserName: 149y0CPIQsf2WavFriLBwC2tv17ElsVKz
---

This problem set covers IEEE-754 floating-point representation and x86 register manipulation. It is intended to serve as your review and pointers for the midterms. You are allowed to exhaust whatever resource you have at your disposal in answering this problem set.

## General Instructions

Answer all problems on sheets of 1-whole yellow pad paper. Copy the original items. Staple all sheets together and submit as a single document. Remember to write legibly!

**IMPORTANT: PS1 will be checked in a face-to-face session. If you are absent from said session, you will get a failing grade for this problem set (worth 100 points!). Furthermore, please review course policy regarding absences and missed quizzes or coursework.**

## Part A (20 points)

Convert the following IEEE-754 binary representations to their decimal equivalents. **Show complete solution (1pt)** and **box your final answer (1pt)**.

1. 0 10000010 01000000000000000000000
2. 1 01111110 10000000000000000000000
3. 0 10000100 10100000000000000000000
4. 1 01111100 01100000000000000000000
5. 0 10000001 11000000000000000000000
6. 1 10000000 10000000000000000000000
7. 0 01111111 01010101010101010101010
8. 1 10000011 00110000000000000000000
9. 0 10000000 00000000000000000000001
10. 1 01111101 11100000000000000000000

## Part B (20 points)

Convert the following decimal numbers to IEEE-754 32-bit binary representation. **Show complete solution (1pt)** and **box your final answer (1pt)**.

1. 12.5
2. -7.25
3. 0.1875
4. -45.0
5. 1.40625
6. -0.75
7. 68.875
8. -3.125
9. 0.0625
10. -255.5

## Part C (60 points)

Complete the following table by tracing the value of the AX register through each operation. Show the **binary representation of AX (1pt)** and the value of the **CF (1pt), ZF (1pt), and SF (1pt) flags** after each step.

| Step | Operation | AX Bits | CF | ZF | SF |
|------|-----------|---------|----|----|----| 
| — | MOV AX, 0x5A3C | 0101 1010 0011 1100 | 1 | 1 | 1 |
| 1 | SHL AL, 2 | | | | |
| 2 | SHR AH, 1 | | | | |
| 3 | ROL AX, 3 | | | | |
| 4 | ROR AL, 4 | | | | |
| 5 | AND AH, 0x0F | | | | |
| 6 | OR AL, 0x80 | | | | |
| 7 | XOR AX, 0xAAAA | | | | |
| 8 | SHL AH, 1 | | | | |
| 9 | ROL AX, 8 | | | | |
| 10 | XOR AL, 0x3C | | | | |
| 11 | TEST AH, 0x0F | | | | |
| 12 | SHR AX, 3 | | | | |
| 13 | RCL AL, 2 | | | | |
| 14 | TEST AX, 0x8000 | | | | |
| 15 | ROR AH, 6 | | | | |

---

*You may consult this x86 and amd64 [reference sheet](https://www.felixcloutier.com/x86/) for flags affected per instruction in Part C.*