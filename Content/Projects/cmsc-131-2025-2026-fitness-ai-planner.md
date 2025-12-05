---
title: Fitness AI Planner
authors:
  - Rainier RJ Espinal
  - Sherwin Paul Sabandal
abstract: This project presents the Fitness AI Planner, an intelligent offline TinyML system capable of generating personalized workout schedules on low-power embedded hardware. The system is built around a dataset of 1,800 synthetic fitness profiles, each containing key user attributes such as age, gender, BMI, and stated fitness goals. These variables were preprocessed and used to train a Decision Tree classifier in Python, enabling the model to learn how individual user characteristics correlate with appropriate workout routines. Once the model achieved reliable performance, it was exported and converted into highly optimized C++ code through the micromlgen library. This conversion allowed the classifier to run on an Arduino microcontroller with only 2 KB of RAM, demonstrating the feasibility of deploying machine-learning-based personalization on extremely resource-constrained devices. To make the system fully interactive, a lightweight physical interface was developed using an LCD display and Serial input, enabling users to enter their fitness information and immediately receive customized workout recommendations. By eliminating the need for internet connectivity or cloud-based computation, the Fitness AI Planner highlights the practical potential of TinyML for real-time health and fitness applications. It showcases how compact machine-learning models can deliver meaningful, user-specific guidance entirely offline, making intelligent fitness assistance more accessible, portable, and efficient.
docs: https://drive.google.com/file/d/1IB4uAxjalVzk4VshP5XQNro6EFNphME2/view?usp=drive_link
repository: https://github.com/itsShiii16/CMSC131-Special-Project-FitnessAI/
tags: [cmsc-131]
published: 2025-11-29
schoolYear: 2025
---