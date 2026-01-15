# Ren's Courses

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222222?style=for-the-badge&logo=github&logoColor=white)](https://whitelicorice.github.io/Ren-s-Courses/)
[![Netlify](https://img.shields.io/badge/Netlify-Mirror-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://renscourses.netlify.app)
[![Shortlink](https://img.shields.io/badge/Shortlink-bit.ly%2Frenscourses-EE6123?style=for-the-badge&logo=bitly&logoColor=white)](https://bit.ly/renscourses)

This repository hosts a headless Learning Management System designed for courses I handle under the **University of the Philippines Visayas, Division of Physical Sciences and Mathematics, BS in Computer Science curriculum.**

---

### Legal Notice & License

**All material is strictly copyrighted. All rights reserved.**

This project is **NOT free to clone, fork, or distribute.** The source code and course materials are provided on GitHub for **reference and educational purposes only**.

* View the detailed **[LICENSE](./LICENSE.md)** for a more in-depth read on permitted usage.
* **Some modules and related services (e.g., Grades Viewer) are closed-source by design** and are intentionally excluded from this repository.

---

### Roadmap by Module

* [x] Course Site: Modernize the UX of the core LMS module.
* [x] Submission Bin: Let students submit their deliverables on the course site itself, instead of email.
* [x] Grades Viewer: Let students view their grades in real-time.
* [x] Site Mirror: deploy a live mirror on Netlify for redundancy.
* [x] Booking System: Let students book appointments in advance.
* [x] Mailing List: Email those enrolled in each course (on a per course basis) as frontmatter is released.
* [x] PWA Integration: Allow the course site to be installed on machines as an application.
* [x] Calendar: Let students view upcoming events and deadlines. For instructors, allow dynamic scheduling of events.
* [ ] Calendar Local Holidays: Look for an API that serves local holidays.
* [ ] Calendar Custom Events: Provide an API for defining custom events on the calendar beyond holidays and frontmatter.
* [ ] Search system: somehow integrate a search engine that parses generic frontmatter.

---

### Notes

* Since the Course Site module runs entirely on CRON jobs and the BlazorStatic engine, updating of deadlines and release of upcoming materials may be delayed by a few minutes. In exchange, the course site is very, *very* fast and loads almost instantly even on slow networks. There is *zero lag*, versus other similar course sites built using heavyweight frameworks like React, Angular, Laravel, etc.

* Headless architecture allows swapping in and out of modules, providing infinite flexibility versus monolithic frameworks like Moodle.

* The Grades Viewer module utilizes an L2 and L1 cache for speedy grade lookups. However, this means that cached grade sheets may be stale versus their live counterparts until the cache expires: 15 minutes for L1 and 60 minutes for L2. This is insignificant in practice as the live sheets are rarely updated...

* The Submission Bin module runs on an external Google Forms, but it works as intended, and is sufficient for my purposes. Perhaps I will hoist this off to a proper web module in the future. However, no free-forever solution exists for independent developers. As the issue is simply UI, then this probably won't be addressed.

* A proper Dashboard will probably be never implemented due to architecture constraints. Instead, all managerial tasks will have to be done programmatically (I do not like Dashboards, anyway).
