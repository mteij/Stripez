# The Schikko Rules Ledger

> An ancient tome for a modern age. A real-time, collaborative web application for tracking rules, decrees, and, of course, punishments.

![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)

---

## Features

* **Ancient Tome Aesthetic:** Uses custom fonts and CSS to create an immersive, old-world feel.
* **Real-time Database:** Built with Firebase Firestore, allowing multiple users to see updates instantly without refreshing the page.
* **Secure Schikko Role (Admin):** A password-protected role for the designated "Schikko" to perform administrative tasks, reset annually by a scheduled Cloud Function.
* **The Scribe's Logbook:** An accessible, real-time logbook with search and filtering that records all significant actions for the last 30 days.
* **Google Calendar Integration:** Displays upcoming events from a public Google Calendar.
* **Enhanced Ledger Functionality:** Full CRUD for the punishment ledger, including statistics charts, searching, and sorting.
* **Dynamic Decrees:** The Schikko can manage a list of lesser rules with full editing and reordering capabilities.
* **Oracle's Judgement (Gemini AI):** A natural language interface to the Google Gemini API that suggests thematic consequences for transgressions.
* **Continuous Deployment:** Automatic deployments to Firebase Hosting via GitHub Actions on pushes to `main`.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via Play CDN for development)
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
    * **Cloud Functions for Firebase**
    * **Firestore**
    * **Firebase Authentication** (Anonymous)
    * **Firebase Hosting**
* **Artificial Intelligence:** [Google AI (Gemini API)](https://ai.google.dev/gemini-api/docs)
* **Deployment:** [GitHub Actions](https://github.com/features/actions) for CI/CD.

---

## 🚀 Getting Started

This repository contains the full source code for the Schikko Rules Ledger. While the live version is operational, you are welcome to clone this project and set up your own instance.

**For detailed setup and installation instructions, please see the [Official Project Wiki](https://github.com/MichielEijpe/schikko-rules/wiki).**