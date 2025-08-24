---
title: Creating a Kotlin Development Environment
lead: Setting up a development environment for Kotlin programming, with Git for version control.
published: 2025-08-23
tags: [cmsc-124, cmsc-124-lab, kotlin, git, github, cmsc-124-lab-0]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      xUserName: 1YBKzxHefD1Y647dN7Q6i4NgC_mmsht1Y
---

As preparation for the laboratory of CMSC 124, the following steps must be accomplished. **Remember to take a screenshot of each task you accomplish for later submission.**

---

## Part A: Git & GitHub Setup

Version control is fundamental to modern software development. Git tracks changes in your code, while GitHub provides cloud-based repository hosting and collaboration features.

### Installing Git

1. Visit the official Git [download page](https://git-scm.com/downloads).
2. Download the appropriate installer for your operating system.
3. Run the installer with default settings.
4. Verify installation by opening a terminal and running:

```bash
git --version
```

You should see output similar to:
```bash
git version 2.45.0
```

### Configuring Git

Configure your identity for commit tracking:

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

### Creating and Integrating a GitHub Account

1. Go to [GitHub](https://github.com) and create an account.
2. Verify your email address through the confirmation link.
3. If you are using Visual Studio Code, you may login to GitHub within the IDE.
4. This will greatly simplify Git and Github usage in the future.
5. Otherwise, if you prefer using the commandline, there are plenty of well-written guides on the internet.
6. Test your setup by creating a GitHub repository, then using either your IDE or your commandline to interact with it.

---

## Part B: Kotlin Development Environment

### Installing Java Development Kit (JDK)

Kotlin runs on the Java Virtual Machine, requiring a JDK installation (but don't worry, we won't be using the Eclipse IDE in this course).

1. Visit [Eclipse Temurin](https://adoptium.net/) (recommended) or [Oracle JDK](https://www.oracle.com/java/technologies/downloads/).
2. Download the LTS version.
3. Install with default settings.
4. Verify installation:

```bash
java -version
javac -version
```

Expected output format:
```bash
openjdk version "17.0.2" 2022-01-18
OpenJDK Runtime Environment Temurin-17.0.2+8 (build 17.0.2+8)
OpenJDK 64-Bit Server VM Temurin-17.0.2+8 (build 17.0.2+8, mixed mode)
```

### Installing IntelliJ IDEA

IntelliJ IDEA provides excellent Kotlin support with intelligent code completion, debugging, and project management. You may choose to use another IDE of your choice (such as Visual Studio Code), but these IDEs provide lackluster support for Kotlin.

1. Visit [JetBrains IntelliJ IDEA](https://www.jetbrains.com/idea/).
2. Choose the free Community Edition.
3. Download and install with default settings.
4. Launch IntelliJ IDEA and complete the initial setup wizard.
5. Install the Kotlin plugin if not already included (it should be pre-installed!).
6. Optionally, disable some intensive plugins under the AI section to gain a massive performance boost for low-power devices.

### Installing Kotlin Command Line Compiler

For direct compilation and scripting:

1. Visit [Kotlin releases](https://kotlinlang.org/docs/command-line.html).
2. Download the latest ZIP file.
3. Extract to a permanent location (e.g., `C:\kotlin`).
4. Add the `bin` directory to your system PATH.
5. Verify installation:

```bash
kotlin -version
kotlinc -version
```

---

## Part C: Kotlin Koans

Kotlin Koans are interactive exercises designed to familiarize you with Kotlin syntax and idioms. Since you are already familiar with Python from CMSC 11 and Java from CMSC 22, these exercises should serve well as an introduction to the langauge.

### Setting up Kotlin Koans

1. Visit [Kotlin Koans online](https://play.kotlinlang.org/koans) for a browser-based experience.
2. Alternatively, visit the [Kotlin Koans repository](https://github.com/Kotlin/kotlin-koans-edu) for instructions on how to run it within the IntelliJ IDEA.

### Doing Kotlin Koans

Work through the following sections in Kotlin Koans. You may consult the [Kotlin documentation](https://kotlinlang.org/docs/home.html) while you are doing the tasks.

- **Introduction**
- **Classes**
- **Conventions**
- **Collections**

Doing the rest of the sections in Kotlin Koans will not be necessary for our lab activities in CMSC 124, but feel free to expand your skills.

---

*See the laboratory manual for submission instructions.*