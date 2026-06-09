# White-Label School Distribution & Deployment Playbook

This document provides complete instructions for deploying, branding, and selling a brand new, isolated instance of the **BITC Student and Teacher Portal** to another school or educational institution.

---

## 1. Absolute Isolation of Private Data

A core feature of this platform's architecture is that **no school database data is hardcoded in the codebase**. 
All active students, grades, timetables, classes, notifications, chat lines, fee configurations, and logs exist exclusively in the **Google Firebase Cloud Firestore** database.

Therefore, when you export this codebase and connect it to a **new, blank Firebase project**:
- The platform automatically starts with **zero records** (100% empty state).
- There is **no risk** of leaking student or financial records from the original school.
- The new school starts with a pristine database ready to set up their custom classes, assign teachers, register students, and mark attendance.

---

## 2. Playbook: Customizing Branding & School Identity

Before presenting the portal to a new client (school), you will want to replace the branding components in the source code.

### A. School Logo & Assets
Replace the public graphics with the new school's logos:
- `/public/` directory: Replace file images such as default icons or logo assets. We recommend matching the transparent background formats and filenames.

### B. App Title & Browser Tab Name
1. Open **`/index.html`** and change the `<title>` tag content to the new school’s name:
   ```html
   <title>New School Portal Title</title>
   ```
2. Open **`/metadata.json`** and change the `"name"` and `"description"` attributes to reflect the new client details:
   ```json
   {
     "name": "New School Portal",
     "description": "Student and teacher collaboration system."
   }
   ```

### C. Color Customizations (Tailwind Theme)
If the school requires a custom color scheme (e.g., Green/Gold or Royal Blue/Slate) to match their official brand guide:
- Open **`/src/index.css`** or look for CSS variable overrides at the top of the theme settings. Tailwind CSS utility classes are utilized throughout the pages, allowing you to quickly modify any background (`bg-indigo-650` to `bg-emerald-600`, etc.) to match the brand palette.

---

## 3. Playbook: Deployment & Database Activation

To get the app fully operational for the new school, you will connect it to a clean database of its own.

### Step 1: Export Code from AI Studio
1. Open the user **Settings** menu inside Google AI Studio's workspace.
2. Select **Export to ZIP** to download the clean codebase. Or, link it to your personal **GitHub repository** to manage multiple customer branches.

### Step 2: Establish a Free Firebase Account
1. Open the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Name the project after the new school (e.g., `excellence-academy-portal`).
3. Turn on **Firestore Database** in the left sidebar menu (select "Start in Test mode" or production mode depending on your launch timeline).
4. Turn on **Authentication** and activate the **Email/Password** provider option found under Sign-in Methods.

### Step 3: Run the Schema Blueprint
Provide the security guidelines and permissions to ensure only validated roles can access admin views:
- Copy the security configuration rules directly from your local `/firestore.rules` and paste them into the "Rules" tab of the new Firestore console.
- Copy `/storage.rules` to the "Rules" tab of the Firebase Storage console to secure media uploads (like student badges or assignment documents).

### Step 4: Inject Configuration Credentials
Once your new Firebase project is registered:
1. Register a web application inside the project settings to get your configuration object.
2. Generate an environment configuration file (**`.env`**) in the root directory loaded with your new keys:
   ```env
   VITE_FIREBASE_API_KEY=your_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   VITE_FIREBASE_PROJECT_ID=your_project_id_here
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
   VITE_FIREBASE_APP_ID=your_app_id_here
   ```

---

## 4. Playbook: Adding the Initial School Administrator

Since the database is 100% empty, you must create the very first "Super Admin" account for the school so they can log in and start registering students:

1. Launch your portal locally (`npm run dev`) or on your deployment host.
2. Navigate to the **Public Registration Portal** or sign-up menu and create a new account using the principal’s or IT manager's email address.
3. Open your clean **Firebase Firestore Console**, go the `users` collection, select the newly registered document for that email, and modify their role parameter value:
   ```json
   "role": "admin"
   ```
4. On refresh, their account will instantly gain full **Super Admin permissions**, enabling them to add classes, register teachers/students, and customize school settings.

---

## 5. Deployment Options for Clients

You can host and sell this web application using any of the following standard production platforms:
- **Render / Vercel / Netlify**: Connect your GitHub repository for automatic CD/CI deployments on a custom domain (e.g. `portal.newschool.ac.ke`).
- **Cloud Run / Docker**: Suitable for high-scale enterprise configurations or specialized database configurations.
