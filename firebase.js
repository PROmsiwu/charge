import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMHxHqIrZIWfaSaXvFoNCwFUjQF-gK6qM",
  authDomain: "project-fe025bb5-b1cc-4b8f-93e.firebaseapp.com",
  databaseURL: "https://project-fe025bb5-b1cc-4b8f-93e-default-rtdb.firebaseio.com",
  projectId: "project-fe025bb5-b1cc-4b8f-93e",
  storageBucket: "project-fe025bb5-b1cc-4b8f-93e.firebasestorage.app",
  messagingSenderId: "148069353954",
  appId: "1:148069353954:web:4aa7fa2fa496e66f93d1bb",
  measurementId: "G-GEGGSM5DPB"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database };
