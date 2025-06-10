# The Schikko Rules Ledger

This is a simple, collaborative web application styled to look like a page from an ancient tome. It displays a set of rules and features an interactive "Ledger of Punishments" where users can add names and assign "punishment stripes" to them in real-time.

All data is stored and synced live using Google's Firebase, and the project is set up for automatic deployment via GitHub Actions.

---

## Features

* **Ancient Tome Aesthetic:** Uses custom fonts and CSS to create an immersive, old-world feel.
* **Real-time Database:** Built with Firebase Firestore, allowing multiple users to see updates instantly without refreshing the page.
* **Enhanced Ledger Functionality:**
    * Full CRUD (Create, Read, Update, Delete) functionality for names on the ledger.
    * **Improved Punishment Tracking:** Add or remove punishment stripes for each person.
        * Every 5th stripe (excluding the very last stripe for a person) is now subtly marked in black.
        * If the number of stripes exceeds a set threshold, they are displayed as a numerical count rather than individual stripes, preventing overflow.
        * Individual stripes allow horizontal scrolling if they exceed the container width, instead of wrapping.
    * Statistics Chart: View a person's history of transgressions on a smooth, interactive chart that groups events occurring in close succession.
    * Search & Sort: Easily find names on the ledger and sort them alphabetically or by the number of stripes.
* **Dynamic Rules Management ("Schikko's Decrees"):**
    * Display a collapsible section for lesser decrees.
    * **Rule Search:** A dedicated search field allows filtering rules by text.
    * **Rule Editing:** Option to edit the text of an existing rule (requires "Schikko" confirmation).
    * **Conditional Text Styling:** Any text appearing after a colon (':') in a rule is automatically displayed in red.
    * **Streamlined Rule Addition:** The "Add Decree" button now directly uses the text from the rule search field as input for the new rule.
    * Move rules up and down in the list to reorder them.
    * Delete rules (requires "Schikko" confirmation).
    * Rule action buttons (Edit, Move Up/Down, Delete) are consistently sized and aligned for better UI.
* **Randomizers Hub:**
    * A central hub to access different randomization tools.
    * **Name Selector/Shuffler:** Randomly picks or shuffles names loaded directly from the Firebase Punishment Ledger.
    * **Dice Roller:** A simpler dice roller that generates a random number up to a user-defined maximum value.
    * **Oracle's Judgement (Gemini AI):** A new option in the hub where users can describe a transgression in natural language. A backend function securely calls the Google Gemini API to analyze the situation against the current rules and returns a thematic, AI-generated consequence.
* **Continuous Deployment:** The project is configured to automatically deploy to Firebase Hosting whenever changes are pushed to the `main` branch on GitHub.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
* **Charting:** [Chart.js](https://www.chartjs.org/) for data visualization.
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
    * **Cloud Functions for Firebase:** For server-side logic to securely call external APIs.
    * **Firestore:** As the NoSQL real-time database.
    * **Firebase Authentication:** For anonymous user sign-in.
    * **Firebase Hosting:** To serve the live web application.
* **Artificial Intelligence:** [Google AI (Gemini API)](https://ai.google.dev/gemini-api/docs)
* **Deployment:** [GitHub Actions](https://github.com/features/actions) for CI/CD.

---

## Project Structure

The project's code is organized to separate the frontend (`public`) from the backend (`functions`).

.
├── functions/
│   ├── node_modules/
│   ├── index.js         # Backend logic for the Gemini Oracle
│   └── package.json
├── public/
│   ├── js/
│   │   ├── firebase.js
│   │   ├── main.js
│   │   └── ui.js
│   ├── randomizer/
│   │   ├── randomizer.js
│   │   └── randomizer.css
│   ├── index.html
│   ├── style.css
│   └── 404.html
├── .github/
│   └── workflows/       # GitHub Actions for CI/CD
├── .firebaserc
├── firebase.json
└── README.md


---

## Project Setup

If you wish to clone this repository and set it up with your own Firebase project, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/MichielEijpe/schikko-rules.git](https://github.com/MichielEijpe/schikko-rules.git)
    cd schikko-rules
    ```

2.  **Create a Firebase Project:**
    * Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    * **Upgrade to the Blaze Plan:** To use Cloud Functions, you must upgrade your project to the "Blaze (Pay-as-you-go)" plan. This is required to enable the necessary APIs.
    * Inside your project, go to **Build > Firestore Database** and create a database in **Production mode**.
    * Go to **Build > Authentication**, select the **Sign-in method** tab, and **enable** the **Anonymous** provider.

3.  **Configure Firestore Rules:**
    * In the **Firestore Database** section, go to the **Rules** tab and paste the following, then publish:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /punishments/{docId} {
          allow read, write: if request.auth != null;
        }
        match /rules/{docId} {
          allow read, write: if request.auth != null;
        }
      }
    }
    ```

4.  **Set up Backend Functions:**
    * **Initialize Functions:** In your local project root, run `firebase init functions` and select JavaScript.
    * **Install Dependencies:** Navigate to the new `functions` directory (`cd functions`) and run `npm install @google/generative-ai`.
    * **Get Gemini API Key:** Go to [Google AI Studio](https://aistudio.google.com/) to create and copy your API key.

5.  **Configure Secrets and IAM Permissions:**
    * **Set API Key Secret:** In your project root, run the following command, pasting your Gemini API key:
        ```bash
        firebase functions:config:set gemini.key="YOUR_API_KEY_HERE"
        ```
    * **Configure IAM for Deployments:** For CI/CD, create a service account and download its JSON key. In the Google Cloud IAM console, grant this service account the following roles:
        * `Cloud Functions Developer`
        * `Firebase Hosting Admin`
        * `Service Account User`
        * `Firebase Extensions Viewer`
        * `API Keys Viewer`
        * `Service Usage Consumer`

6.  **Configure GitHub Secrets for CI/CD:**
    * In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
    * Add a repository secret named `FIREBASE_SERVICE_ACCOUNT_SCHIKKO_RULES` and paste the entire content of your service account's JSON key file.
    * Add secrets for your Firebase config values (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.) to be used by the workflows.

7.  **Deploy:**
    * You can deploy manually by installing the Firebase CLI (`npm install -g firebase-tools`) and running `firebase deploy`.
    * Alternatively, the GitHub Actions will now automatically deploy whenever changes are pushed to `main` or a pull request is created/updated, with your Firebase credentials securely injected.
