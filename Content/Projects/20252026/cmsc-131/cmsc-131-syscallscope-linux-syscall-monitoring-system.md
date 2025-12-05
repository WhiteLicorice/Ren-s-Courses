---
title: SyscallScope
authors:
  - Joshua Ticot
  - Myra Verde
abstract: SyscallScope is a lightweight Linux syscall monitoring and detection system that leverages eBPF/BPFtrace and rule-based heuristics to identify suspicious behaviors such as unauthorized execution, rapid file writes, unusual memory protections, directory enumeration, and abnormal process interactions. The system provides a complete tracing pipeline from syscall collection to structured event parsing and anomaly detection. While some proposed activities, such as using external offensive tools (Nmap, Hydra), were not implemented, custom C-based simulators for getdents, connect, chmod, and rapid-write workloads enabled controlled, reproducible testing. SyscallScope meets its core objectives, demonstrating effective syscall-level attack detection with minimal performance overhead.
docs: https://drive.google.com/file/d/1YRXi0I-R5vf9iS669d1ZTBVJwnpJc9-P/view?usp=drive_link
repository: https://github.com/Hiagyl/syscallscope
thumbnail: null
tags: [cmsc-131]
published: 2025-11-29
schoolYear: 2025
---