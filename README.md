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
        * If the number of stripes exceeds 20, they are displayed as a numerical count rather than individual stripes, preventing overflow.
        * Individual stripes (when fewer than 20) now allow horizontal scrolling if they exceed the container width, instead of wrapping.
    * Statistics Chart: View a person's history of transgressions on a smooth, interactive chart that groups events occurring in close succession.
    * Search & Sort: Easily find names on the ledger and sort them alphabetically or by the number of stripes.
    * "Inscribe Name" button is now a visually consistent square '+' button.
* **Dynamic Rules Management ("Schikko's Decrees"):**
    * Display a collapsible section for lesser decrees.
    * **Rule Search:** A dedicated search field allows filtering rules by text.
    * **Rule Editing:** Option to edit the text of an existing rule (requires "Schikko" confirmation).
    * **Conditional Text Styling:** Any text appearing after a colon (':') in a rule is automatically displayed in red.
    * **Streamlined Rule Addition:** The "Add Decree" button now directly uses the text from the rule search field as input for the new rule.
    * Move rules up and down in the list to reorder them.
    * Delete rules (requires "Schikko" confirmation).
    * All rule control buttons (Add, Edit, Hide) are consistently sized with the search field.
    * Rule action buttons (Edit, Move Up/Down, Delete) are consistently sized and aligned for better UI.
    * The "Schikko's Decrees" button has a more subtle color palette and a minimalistic downward arrow.
* **Randomizers Hub:**
    * A central hub to access different randomization tools.
    * **Name Selector/Shuffler:** Randomly picks or shuffles names loaded directly from the Firebase Punishment Ledger. The output is hidden until a shuffle or pick action is performed.
    * **Dice Roller:** A simpler dice roller that generates a random number up to a user-defined maximum value (0-50).
* **Continuous Deployment:** The project is configured to automatically deploy to Firebase Hosting whenever changes are pushed to the `main` branch on GitHub.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
* **Charting:** [Chart.js](https://www.chartjs.org/) for data visualization.
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
    * **Firestore:** As the NoSQL real-time database.
    * **Firebase Authentication:** For anonymous user sign-in.
    * **Firebase Hosting:** To serve the live web application.
* **Deployment:** [GitHub Actions](https://github.com/features/actions) for CI/CD.

---

## Project Structure

The project's code is organized in a modular way to separate concerns, making it easier to maintain and understand.


public/
├── js/
│   ├── firebase.js      # Handles all Firebase configuration and communication
│   ├── main.js          # Main application logic, state, and event handling
│   └── ui.js            # Manages all DOM rendering and UI updates
├── randomizer/
│   ├── randomizer.js    # Logic for both Name Selector/Shuffler and Dice Roller
│   └── randomizer.css   # Specific styles for the randomizer modals
├── index.html           # The main HTML file
├── style.css            # Custom styles for the ancient tome theme
└── 404.html             # Custom 404 error page


---

## Project Setup

If you wish to clone this repository and set it up with your own Firebase project, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/](https://github.com/)[YOUR_USERNAME]/[YOUR_REPOSITORY_NAME].git
    cd [YOUR_REPOSITORY_NAME]
    ```

2.  **Create a Firebase Project:**
    * Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
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

4.  **Set up Firebase Configuration using Environment Variables (Recommended for Security):**
    * **Do NOT** hardcode your Firebase configuration directly into `public/js/firebase.js`.
    * Instead, create environment variables for each piece of your Firebase config (e.g., `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, etc.).
    * **For Firebase Hosting deployments via GitHub Actions:** You would typically pass these environment variables into your build process. If Firebase Hosting doesn't directly support custom environment variables for client-side builds, you might need a small build script to inject them or manage them directly within your `firebase.js` as global variables provided by the hosting environment.

    * **Example of how your `firebase.js` *should* retrieve these (conceptual):**
        ```javascript
        // public/js/firebase.js
        // Firebase configuration (values would be injected by your hosting environment)
        const firebaseConfig = {
            apiKey: typeof __firebase_api_key !== 'undefined' ? __firebase_api_key : '',
            authDomain: typeof __firebase_auth_domain !== 'undefined' ? __firebase_auth_domain : '',
            projectId: typeof __firebase_project_id !== 'undefined' ? __firebase_project_id : '',
            storageBucket: typeof __firebase_storage_bucket !== 'undefined' ? __firebase_storage_bucket : '',
            messagingSenderId: typeof __firebase_messaging_sender_id !== 'undefined' ? __firebase_messaging_sender_id : '',
            appId: typeof __firebase_app_id !== 'undefined' ? __firebase_app_id : ''
        };
        // ... rest of your firebase.js code
        ```
    * **Note for Canvas Environment:** In the Canvas environment, the `apiKey` field in your `firebaseConfig` object will be automatically populated from a secure source. For other Firebase config values (authDomain, projectId, etc.), if the Canvas environment provides them as global variables (e.g., `__firebase_auth_domain`), you can use those. Otherwise, you may need to manually provide them or adjust your deployment strategy to inject them.

5.  **Deploy:**
    * You can deploy manually by installing the Firebase CLI (`npm install -g firebase-tools`) and running `firebase deploy`.
    * Alternatively, set up the GitHub Actions integration by following the official Firebase guide. Ensure your GitHub Actions workflow is configured to pass the necessary Firebase environment variables to your build or deployment process.
