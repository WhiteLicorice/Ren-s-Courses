---
title: CMSC 131 - Lab 0
lead: Creating a developer environment for NASM on Windows with VSCode.
published: 2025-07-21
tags: [cmsc-131]
authors:
    - name: "Rene Andre Bedonia Jocsing"
      gitHubUserName: "WhiteLicorice"
      xUserName: null
---

# A NASM Development Environment

CMSC 131 is often the first foray of a CS student into the (ugly) domain of command line usage, workflow orchestration, and low-level programming. To alleviate frustration, the instructor has taken the liberty of diving into the abyss and charting a course.

The following steps require patience, a strict adherence to instructions, and a stable internet connection.

The goal is to prepare a developer environment for NASM X86 on Windows using VSCode, in preparation for the lab exercises that follow.

> If you do not wish to use a Windows environment for the course, you may look into WSL, Linux, or DOSBox. But these methods will not be covered here.

---

## 💾 Installing NASM for Windows

1. Go to the [NASM](https://www.nasm.us/) website.
2. Download the stable build by clicking on `stable` and navigating to the `/pub/nasm/releasebuilds/2.16.03/win64` directory.
3. Select the installer for download.
4. Run the installer and take note of where NASM is being installed on your system.
5. Go to your PATH (Edit the system environment variables).
6. Under `User Variables`, select `Path` and then `Edit`.
7. Select `New` then `Browse`.
8. Navigate to the directory from #4 (default should be at `C:\Users\User\AppData\Local\bin\NASM`).
9. To verify installation, open a fresh command line and input:
   ```bash
   nasm -v
   ```
   You should see output like:
   ```
   NASM version 2.16.03 compiled on Apr 17 2024
   ```
10. Done.

---

## 🛠️ Installing GCC for Windows

1. Go to the [MinGW-64](https://www.mingw-w64.org/) website.
2. Open the `Getting Started` directory and select `MSYS2 (GCC)`.
3. Follow the instructions on the MSYS2 website up to **Step 5**. This will install MSYS2 and update the core system libraries.
4. Once you see the MSYS2 terminal, **close** it, then go back to the page in #2.
5. From here, follow the instructions on the aforementioned page. Additionally, install the:
   ```bash
   pacman -S mingw-w64-i686-toolchain
   ```
6. Verify that `gcc` is visible to Windows. Open a fresh command line and run:
   ```bash
   gcc -v
   gcc -where
   ```
   If you find another (stray) GCC installation, edit your PATH so that `C:/msys64/mingw32/bin/gcc.exe` comes **first**.
7. If `gcc -v` shows a 64-bit toolchain, double-check you're using the 32-bit variant (`mingw-w64-i686-toolchain`).
8. Done.

---

## 📂 Fetching Paul Carter's Library for NASM

1. Go to the [pcasm](https://pacman128.github.io/pcasm/) website.
2. Scroll down to the **Example Code** section.
3. Select **MS C Examples** and download the ZIP archive.
4. Extract the archive into a folder called `pc_asm`.
5. Done.

---

## 🔧 Prepping VSCode for NASM Development

1. Open up **VSCode**.
2. Under the `Extensions` tab, search for `NASM`.
3. Install the **NASM X86 Assembly Language** extension.
4. Go to the `pc_asm` folder from earlier.
5. Create a `.vscode` folder inside it.
6. Inside `.vscode`, create a `tasks.json` file.
7. Paste in the following:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "NASM Assemble (32-bit)",
      "type": "shell",
      "command": "nasm",
      "args": [
        "-f", "win32",
        "${file}",
        "-o", "${fileDirname}/${fileBasenameNoExtension}.obj"
      ],
      "group": "build"
    },
    {
      "label": "GCC Compile Driver (32-bit)",
      "type": "shell",
      "command": "C:/msys64/mingw32/bin/gcc.exe",
      "args": [
        "-m32", "-c",
        "${fileDirname}/driver.c",
        "-o", "${fileDirname}/driver.o"
      ],
      "group": "build"
    },
    {
      "label": "GCC Link (32-bit Console)",
      "type": "shell",
      "command": "C:/msys64/mingw32/bin/gcc.exe",
      "args": [
        "-m32",
        "${fileDirname}/${fileBasenameNoExtension}.obj",
        "${fileDirname}/asm_io.obj",
        "${fileDirname}/driver.o",
        "-o", "${fileDirname}/${fileBasenameNoExtension}.exe",
        "--%",
        "-Wl,-subsystem,console"
      ],
      "group": "build",
      "dependsOn": [
        "NASM Assemble (32-bit)",
        "GCC Compile Driver (32-bit)"
      ]
    },
    {
      "label": "Run Program",
      "type": "shell",
      "command": "${fileDirname}/${fileBasenameNoExtension}.exe",
      "group": "test"
    },
    {
      "label": "Build & Run",
      "dependsOrder": "sequence",
      "dependsOn": [
        "GCC Link (32-bit Console)",
        "Run Program"
      ],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

8. Save the file.
9. Open any `.asm` file (e.g. `first.asm`) and press `Ctrl + Shift + B`.
10. You should see the program build and run.
11. Done.

---

## 🏋️ Skeleton for Future Lab Exercises

1. In the `pc_asm` folder, create a subfolder named `skeleton`.
2. Extract the following files from the Paul Carter archive into this folder:
   - `asm_io.asm`
   - `asm_io.inc`
   - `asm_io.obj`
   - `cdecl.h`
   - `driver.c`
   - `skel.asm`
3. In the future, you may rename `skel.asm` to `lab0.asm`, `lab1.asm`, etc., for each lab.
4. Open the `.asm` file in VSCode.
5. This is how an introductory "Hello World" program looks like in assembly:
```nasm
;
; file: skel.asm
; This file is a skeleton that can be used to start assembly programs.
;

%include "asm_io.inc"

segment .data
;
; initialized data is put in the data segment here
;
hello_msg db "Hello, world!", 0    ; null-terminated string for printing


segment .bss
;
; uninitialized data is put in the bss segment
;


segment .text
        global  _asm_main
_asm_main:
        enter   0,0               ; setup routine
        pusha

;
; code is put in the text segment. Do not modify the code before
; or after this comment.
;

        mov     eax, hello_msg    ; store the address of the "Hello, world!" string in the eax register
        call    print_string      ; print "Hello, world!"

        call print_nl             ; prints out a new line
        call print_nl             ; prints out a new line

;
; return to C driver. Do not modify the code
; after this comment.
;
        popa
        mov     eax, 0            ; return back to C
        leave                     
        ret

```
5. Once the contents of your `skel.asm` match the code above, press `Ctrl + Shift + B` to build and run.
6. You should see `Hello, world!` printed.
7. Done.

---

## 📤 For Submission

1. Zip up your `skeleton` folder and take a screenshot of your terminal showing `Hello, world!` output.
2. Submit the archive.
3. (Bonus points!) Create a GitHub repo from your `skeleton` folder and submit the link instead.
4. Done.
