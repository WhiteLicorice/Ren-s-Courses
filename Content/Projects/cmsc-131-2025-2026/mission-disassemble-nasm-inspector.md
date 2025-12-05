---
title: Mission Disassemble
authors:
  - Junel Arellano
abstract: Understanding low-level machine architecture is a fundamental requirement for computer science students, yet the cognitive bridge between high-level source code and raw binary execution remains opaque. While industry-standard tools like IDA Pro and Ghidra offer powerful disassembly capabilities, their steep learning curves and feature complexity often hinder novice learners from grasping the core concepts of instruction decoding. This project addresses this educational gap by presenting "MISSION DISASSEMBLE," a lightweight, transparent disassembler designed specifically for inspecting and analyzing x86-64 NASM (Netwide Assembler) binaries. The system is architected using Python 3 and employs a linear sweep algorithm to parse variable-length x86-64 instruction sets. Technical implementation relies on a custom SQLite opcode database integrated with a bitwise decoding engine capable of handling complex addressing modes, including ModR/M and SIB bytes. Key features include a user-friendly graphical user interface (GUI) that visualizes memory addresses alongside raw hex bytes, a syntax highlighter for NASM directives, and a statistical analyzer that generates reports on register usage and instruction distribution. Validation procedures involved a reverse-engineering test where binaries compiled from known NASM source code were disassembled and compared against the original source. Results demonstrate that the tool achieves 100% decoding accuracy for the supported instruction set, correctly identifying opcodes, operands, and immediate values. The outcome is a fully portable, standalone executable compiled via PyInstaller, which significantly lowers the barrier to entry for students. This project proves that custom-built inspection tools can serve as effective, accessible educational aids in the field of systems programming.
docs: https://drive.google.com/file/d/1_xSF_IjuM8t6UHoaY9_VSy9pyFJ75tnm/view?usp=drive_link
repository: https://github.com/Junel-A/Mission-Disassemble
thumbnail: null
tags: [cmsc-131]
published: 2025-11-29
schoolYear: 2025
---