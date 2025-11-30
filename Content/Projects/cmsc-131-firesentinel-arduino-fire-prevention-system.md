---
title: FireSentinel
authors:
  - Eryl Joseph Aspera
  - Antonio Gabriel Salmon
abstract: This project presents an Automatic Fire Detection, Extinguishing, and Alert System that integrates real-time flame sensing with automated suppression and GSM-based emergency notification. The system employs an infrared flame sensor for fire detection, a dual-servo mechanism for directional scanning and nozzle aiming, and a relay-controlled 12 V water pump for targeted fire suppression. Upon flame detection, the Arduino Uno microcontroller simultaneously activates the GSM module to transmit SMS alerts to registered recipients, enabling remote monitoring and emergency response. The servo-driven scanning mechanism sweeps from 0° to 180° to locate the strongest flame signal; however, the water nozzle is mechanically restricted to operate only within a 90° range directly in front of the system, ensuring controlled and stable spray direction during extinguishment. Once the flame coordinates are determined, the nozzle automatically positions itself within this allowable range for precise suppression. System testing demonstrated accurate flame detection within a 24 cm range with response times under 2 seconds, consistent pump activation via relay control, and reliable SMS transmission through cellular networks. This autonomous fire-response system provides a cost-effective solution for residential and commercial fire safety applications, combining sensor-driven detection with automated suppression to minimize response time and property damage.
docs: https://drive.google.com/file/d/1e-sUXnRcAHDYGfDRNNQ564YkvmNvJVAU/view?usp=drive_link
repository: https://github.com/g4biruu/cmsc131_st_firesentinel
thumbnail: null
tags: [cmsc-131]
published: 2025-11-29
---