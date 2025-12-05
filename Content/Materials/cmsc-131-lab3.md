---
title: Packet Transfer in Networking
subtitle: CMSC 131 Lab 3
lead: Endianness concepts through network packet simulation.
published: 2025-09-15
tags: [cmsc-131]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      nickname: "Ren"
downloadLink: https://drive.google.com/file/d/18yR2Q0OjQrSR6_3_XlbU0K8q_Smk9v2P/view?usp=drive_link
---

This laboratory assignment explores endianness concepts through network packet simulation. You will implement a program that demonstrates proper conversion techniques for cross-architecture network communication.

## Learning Objectives

By the end of this laboratory exercise, students should be able to:

- Understand little endian (x86) vs big endian (network) byte ordering
- Implement byte-swapping functions using NASM instructions
- Apply proper endianness handling in network protocols
- Use bit manipulation instructions for data conversion
- Apply shifts and masks in bit-level manipulation

## Task

Create a program that simulates network packet transmission between different architectures:

1. Prompt the user for a "network packet" with header fields (source IP, destination IP, port numbers, packet length)
2. Display the packet in x86 little endian format
3. Convert the packet to network big endian format for "transmission"
4. Simulate receiving the packet and converting back to little endian

## Packet Structure

For example, a network packet should contain these fields:

- **Source IP**: 192.168.1.100 (32-bit in fixed-point representation)
- **Destination IP**: 10.0.0.1 (32-bit in fixed-point representation) 
- **Source Port**: 8080 (16-bit in fixed-point representation)
- **Destination Port**: 80 (16-bit in fixed-point representation)
- **Packet Length**: 1024 (32-bit)

## Implementation Details

- Display **hex values** to clearly show byte ordering
- For optimal speed, the network should **only store and persist values through registers — this means no reserved memory or storage variables are allowed!**
- For educational purposes, the network should **implement endian conversion through an algorithm of choice, instead of using the `xchg`, `bswap`, or any other macro-like instructions!**
- You may use the `dump_regs` macro to show the values in registers as hex
- Use provided I/O functions for display

### Expected Output

```
Input the source IP: 1921681000
Input the destination IP: 10001
Input the source port: 8080
Input the destination port: 80
Input the packet length in bits: 1024
Received Little Endian Packet!
Register Dump # 1
EAX = 00000400 EBX = 00501F90 ECX = 00000400 EDX = 00001F90        
ESI = 728A8668 EDI = 00002711 EBP = 007FFEC8 ESP = 007FFEA8        
EIP = 0031157B FLAGS = 0206                PF
Converting to Big Endian...
Register Dump # 2
EAX = 00040000 EBX = 901F5000 ECX = 00040000 EDX = 0000728A        
ESI = 68868A72 EDI = 11270000 EBP = 007FFEC8 ESP = 007FFEA8        
EIP = 0031159A FLAGS = 0216             AF PF
Sent Big Endian Packet!
.....
.....
.....
Received Big Endian Packet!
Converting to Little Endian...
Register Dump # 3
EAX = 00000400 EBX = 00501F90 ECX = 00000400 EDX = 00006886        
ESI = 728A8668 EDI = 00002711 EBP = 007FFEC8 ESP = 007FFEA8        
EIP = 00311618 FLAGS = 0216             AF PF
```

*EDX and ECX are unused in the implementation (by preference). However, note the EBP, ESP, EIP, and FLAGS registers are used internally by the network and should not handle packets!*

### Starter Code

No starter code template is provided for this exercise. *You can do it!*

### Testing

Verify your implementation handles:
- Correct round-trip conversion (original = final)
- Proper byte ordering in network format
- Various IP addresses and port combinations

## Laboratory Defense

The instructor will be available during scheduled laboratory hours in the assigned room for defense or consultation. You will be catered to at a first-come first-served basis. It is mandatory to present your code, answer inquiries, and perform live programming if the instructor deems it necessary to further check your understanding.

If a laboratory defense for an activity fails to be conducted within **one month** of its assignment, the instructor will be forced to give a failing grade. Scoring will be done during the laboratory defense (no defense, no grade policy). Extensions may be granted due to extraordinary circumstances, but ultimately remains up to the judgment of the instructor.

## Academic Honesty

The usage of Large Language Models (e.g. ChatGPT, Claude, Deepseek, etc.) to generate code is considered cheating. As cheating is against the university's code of ethics, it is subject to failure in the course and harsh disciplinary action.

---

# Rubric for Programming Exercises (50 pts)

| **Criteria (10 Points Each)** | **Excellent (9-10)** | **Good (6-8)** | **Fair (3-5)** | **Poor (0-2)** |
|---|---|---|---|---|
| **Program Correctness** | Program executes correctly with no syntax or runtime errors, meets/exceeds specifications, and displays correct output | Program executes and outputs with minor errors, yet meets specifications | Program executes and outputs with major errors, yet somehow meets specifications | Program does not execute or does not meet specs |
| **Logical Design** | Program is logically well-designed with excellent structure and flow | Program has slight logic errors that do not significantly affect the results | Program has significant logic errors affecting functionality | Program logic is fundamentally incorrect |
| **Code Mastery** | Programmer demonstrates excellent mastery over the program's code | Programmer demonstrates adequate mastery over the program's code | Programmer demonstrates fair mastery over the program's code | Programmer demonstrates poor mastery over the program's code |
| **Engineering Standards** | Program is stylistically well designed from an engineering standpoint | Slight inappropriate design choices (i.e., poor variable names, improper indentation) | Severe inappropriate design choices (i.e., code repetition, redundancy) | Program is poorly written |
| **Documentation*** | Program is well-documented: comments exist for clarity, not redundancy | Missing one required comment or some redundant comments | Missing two or more required comments or many redundant comments | Most documentation missing or most documentation is redundant |

***Remember: "Code tells you how, comments tell you why."** — Jeff Atwood, co-founder of Stack Overflow and Discourse

---

*See the [laboratory manual](https://drive.google.com/file/d/18yR2Q0OjQrSR6_3_XlbU0K8q_Smk9v2P/view?usp=drive_link) for submission requirements.*