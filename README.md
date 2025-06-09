# The Schikko Rules Ledger

This is a simple, collaborative web application styled to look like a page from an ancient tome. It displays a set of rules and features an interactive "Ledger of Punishments" where users can add names and assign "punishment stripes" to them in real-time.

All data is stored and synced live using Google's Firebase, and the project is set up for automatic deployment via GitHub Actions.

---

## Features

* **Ancient Tome Aesthetic:** Uses custom fonts and CSS to create an immersive, old-world feel.
* **Real-time Database:** Built with Firebase Firestore, allowing multiple users to see updates instantly without refreshing the page.
* **Add Transgressors:** Users can inscribe new names onto the ledger.
* **Add Punishment Stripes:** A simple click adds a "stripe" to any name on the list.
* **Continuous Deployment:** The project is configured to automatically deploy to Firebase Hosting whenever changes are pushed to the `main` branch on GitHub.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ESM)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
* **Backend & Database:** [Google Firebase](https://firebase.google.com/)
    * **Firestore:** As the NoSQL real-time database.
    * **Firebase Authentication:** For anonymous user sign-in.
    * **Firebase Hosting:** To serve the live web application.
* **Deployment:** [GitHub Actions](https://github.com/features/actions) for CI/CD.

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
      }
    }
    ```

4.  **Get Firebase Config:**
    * In your Firebase project settings, add a new **Web App**.
    * Firebase will provide you with a `firebaseConfig` object. Copy it.

5.  **Add Config to `app.js`:**
    * Open the `app.js` file.
    * Paste your copied `firebaseConfig` object into the placeholder at the top of the file.

6.  **Deploy:**
    * You can deploy manually by installing the Firebase CLI (`npm install -g firebase-tools`) and running `firebase deploy`.
    * Alternatively, set up the GitHub Actions integration by following the official Firebase guide.
