# The Schikko Rules Ledger

This is a simple, collaborative web application styled to look like a page from an ancient tome. It displays a set of rules and features an interactive "Ledger of Punishments" where users can add names and assign "punishment stripes" to them in real-time.

All data is stored and synced live using Google's Firebase, and the project is set up for automatic deployment via GitHub Actions.

---

## Features

* **Ancient Tome Aesthetic:** Uses custom fonts and CSS to create an immersive, old-world feel.
* **Real-time Database:** Built with Firebase Firestore, allowing multiple users to see updates instantly without refreshing the page.
* **Secure Schikko Role (Admin):**
    * A "Set Schikko" button allows a user to claim the role by providing an email address once per year.
    * The system instantly generates a unique password and **displays it directly in a pop-up alert** to the new Schikko. This password is not shown again.
    * A "Schikko Login" button allows the designated Schikko to authenticate for the current session.
    * **Protected Actions:** Once logged in, the Schikko can perform administrative tasks such as adding/removing people, managing stripes, and editing the Decrees. Executing punishments from the Oracle's Judgement is also a protected action.
    * **Guest View:** Unauthenticated users have a read-only view of the ledger and rules. The UI automatically hides all administrative controls for guests, who can only self-report transgressions using the "Pour Liquid" (🍺) button.
    * The Schikko role is automatically reset annually by a scheduled Cloud Function.
* **The Scribe's Logbook:**
    * An easily accessible logbook (📖 icon) that displays a real-time feed of all significant actions taken within the application.
    * Logs are kept for 30 days, with older entries being automatically deleted by a daily scheduled function.
    * Features robust search, sorting (by date), and filtering (by action type, or by actor like Schikko/Guest) capabilities for easy review of past events.
* **Google Calendar Integration:**
    * Displays the next upcoming event from a public Google Calendar.
    * A "Full Agenda" button opens a popup with all upcoming events.
    * An "Edit Calendar Link" button allows easy updating of the calendar's public iCal URL, which is stored in Firestore.
* **Enhanced Ledger Functionality:**
    * Full CRUD (Create, Read, Update, Delete) functionality for names on the ledger, protected by Schikko authentication.
    * **Improved Punishment Tracking:** Add or remove punishment stripes for each person.
        * Every 5th stripe is subtly marked in black.
        * If the number of stripes exceeds a dynamic threshold, they are displayed as a numerical count to prevent UI overflow.
    * **Statistics Chart:** View a person's history of transgressions on a smooth, interactive chart.
    * **Search & Sort:** Easily find names on the ledger and sort them alphabetically or by the number of stripes.
    * **Footer Information:** The footer displays the current Schikko's name and when their reign expires, adding to the lore.
* **Dynamic Rules Management ("Schikko's Decrees"):**
    * Display a collapsible section for lesser decrees.
    * **Rule Editing:** The Schikko can edit the text of an existing rule, reorder rules, and delete them.
* **Randomizers Hub:**
    * A central hub to access different randomization tools.
    * **Name Selector/Shuffler:** Randomly picks or shuffles names loaded directly from the Punishment Ledger.
    * **Dice Roller:** A dice roller that can be used for manual rolls or by the Oracle.
    * **Oracle's Judgement (Gemini AI):** Users can describe a transgression in natural language. A backend function calls the Google Gemini API to return a thematic consequence. A logged-in Schikko can then execute the suggested punishment with a single click.
* **Continuous Deployment:** The project is configured to automatically deploy to Firebase Hosting whenever changes are pushed to the `main` branch on GitHub.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
* **Calendar Parsing:** [ical.js](https://github.com/mozilla-comm/ical.js)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
* **Charting:** [Chart.js](https://www.chartjs.org/) for data visualization.
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
    * **Cloud Functions for Firebase:** For server-side logic, including scheduled functions and secure API calls.
    * **Firestore:** As the NoSQL real-time database.
    * **Firebase Authentication:** For anonymous user sign-in.
    * **Firebase Hosting:** To serve the live web application.
* **Artificial Intelligence:** [Google AI (Gemini API)](https://ai.google.dev/gemini-api/docs)
* **Deployment:** [GitHub Actions](https://github.com/features/actions) for CI/CD.

---

## Project Structure

The project's code is organized to separate the frontend (`public`) from the backend (`functions`).


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
    * **Upgrade to the Blaze Plan:** To use Cloud Functions (including scheduled functions), you must upgrade your project to the "Blaze (Pay-as-you-go)" plan.
    * Inside your project, go to **Build > Firestore Database** and create a database in **Production mode**.
    * Go to **Build > Authentication**, select the **Sign-in method** tab, and **enable** the **Anonymous** provider.

3.  **Configure Firestore Rules:**
    * In the **Firestore Database** section, go to the **Rules** tab and paste the following, then publish:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Punishments and Rules can be read and written by any authenticated user
        match /punishments/{docId} {
          allow read, write: if request.auth != null;
        }
        match /rules/{docId} {
          allow read, write: if request.auth != null;
        }

        // Activity logs can be created and read by any authenticated user.
        // They cannot be updated or deleted from the client to preserve the audit trail.
        match /activity_log/{logId} {
          allow get, list: if request.auth != null;
          allow create: if request.auth != null;
          allow update, delete: if false;
        }

        // Config is read-only for clients and only writable by backend functions
        match /config/{docId} {
            allow read: if request.auth != null;
            allow write: if false;
        }
      }
    }
    ```

4.  **Set up Google Calendar:**
    * Create a Google Calendar that you want to use for the agenda.
    * Make the calendar public and get the "Secret address in iCal format".
    * Once the application is running, a logged-in Schikko can click the "Edit Calendar Link" button (✎) and paste this URL.

5.  **Set up Backend Functions:**
    * **Initialize Functions:** In your local project root, run `firebase init functions` and select JavaScript.
    * **Install Dependencies:** Navigate to the new `functions` directory (`cd functions`) and run `npm install`.
    * **Get Gemini API Key:** Go to [Google AI Studio](https://aistudio.google.com/) to create and copy your API key.

6.  **Configure Secrets and IAM Permissions:**
    * **Set API Key Secret:** In your project root, run the following command, pasting your Gemini API key:
        ```bash
        firebase functions:config:set gemini.key="YOUR_API_KEY_HERE"
        ```
    * **Configure IAM for Deployments:** For CI/CD, create a service account and download its JSON key. In the Google Cloud IAM console, grant this service account the following roles:
        * `Cloud Functions Admin`
        * `Firebase Hosting Admin`
        * `Service Account User`
        * `API Keys Viewer`
        * `Service Usage Consumer`
        * **`Cloud Scheduler Admin`** (for the annual reset function)

7.  **Configure GitHub Secrets for CI/CD:**
    * In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
    * Add a repository secret named `FIREBASE_SERVICE_ACCOUNT_SCHIKKO_RULES` and paste the entire content of your service account's JSON key file.
    * Add secrets for your Firebase config values (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.) to be used by the workflows.

8.  **Deploy:**
    * You can deploy manually by installing the Firebase CLI (`npm install -g firebase-tools`) and running `firebase deploy`.
    * The GitHub Actions will automatically deploy changes pushed to `main`.

9.  **First-Time Schikko Setup (Post-Deploy):**
    * Open the deployed web application. Click the "Set Schikko" button.
    * Enter an email address. A pop-up alert will immediately display the generated password.
    * **IMPORTANT**: The password is only shown once. Ensure you save it securely. The user who claims the role is responsible for sharing it if needed.
