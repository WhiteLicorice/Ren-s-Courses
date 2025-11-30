---
title: YARA-Monster
authors:
  - Dale Louize Almonia
  - Stefan Niedes
abstract: This project presents the development and evaluation of a lightweight pattern-based malware detection system implemented in C++ using the YARA rule module. The scanner performs static analysis of executable files through recursive directory traversal, matching binary content against predefined signature rulesets to identify potentially malicious software. Core features include automated file system scanning, YARA C API integration for rule compilation and pattern matching, and structured reporting in JSON and CSV formats. Custom YARA rules were developed for malware families based on flagged API imports and behavioral characteristics extracted through static analysis tools. The system was validated against a corpus of 3,090 files, demonstrating practical detection capabilities while highlighting the importance of rule tuning to balance sensitivity and specificity. Performance metrics indicate scan completion times below 20 seconds for the test dataset, with detection accuracy dependent on rule comprehensiveness and signature specificity. The project successfully integrates cybersecurity principles with system programming, providing a functional foundation for signature-based malware detection suitable for educational and small-scale security analysis environments. The source code, documentation, and deployment artifacts are publicly available on GitHub, enabling reproducibility and extension by future researchers.
docs: https://drive.google.com/file/d/1A9RMn_XzvLmvTXFiSnbigfp4YLIOr8fp/view?usp=drive_link
repository: https://github.com/stepanmonster/CMSC-131-YARA_Monster
thumbnail: null
tags: [cmsc-131]
published: 2025-11-29
---