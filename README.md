# SplitWise — Local Group Expense Tracker ⚖️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/iIluminatixy/Expense-Tracker/actions)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/iIluminatixy/Expense-Tracker/releases)

SplitWise is a 100% local, client-side group expense tracker that prioritizes privacy and ease of use. All your data—groups, members, expenses, and settlements—is securely stored directly in your browser's local storage. No server, no accounts, just pure, private expense tracking.

## Features ✨

*   **Local First, Private Always:** 🔒 All data is stored securely in your browser's local storage. No server required, ensuring maximum privacy.
*   **Intuitive Interface:** A clean, modern UI built with Tailwind CSS and thoughtful UX design for effortless expense management.
*   **Multiple Expense Splitting:** Supports splitting expenses equally, by exact amounts, percentages, or shares (ratios).
*   **Dynamic Balance Calculation:** Real-time calculation of balances and a simplified settlement plan to minimize cash flow.
*   **Member Management:** Add, edit, and manage group members with profile pictures and customizable initial badges.
*   **Offline Functionality:** Works entirely offline. You can close the browser or refresh the page, and your data remains intact.
*   **Data Export:** Easily export your expense data into **PDF** or **CSV** formats for record-keeping or analysis.
*   **JSON Backup & Restore:** Full backup and restore capability using JSON files for complete data portability across devices or browsers.
*   **Responsive Design:** Adapts seamlessly to various screen sizes, from desktops to mobile devices.
*   **Celebration Animation:** Enjoy a confetti animation when debts are settled up!

## Tech Stack 💻

*   **Frontend:** HTML, CSS (Tailwind CSS), JavaScript
*   **Backend (Optional):** Django, Django REST Framework (for potential future API features or different deployment options)
*   **Libraries:** jsPDF, autoTable, canvas-confetti

## Project Structure 📁

```
Expense-Tracker/
├── backend/
│   ├── api/
│   │   ├── migrations/
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── ... (other Django app files)
│   ├── expense_tracker/
│   │   ├── settings.py
│   │   └── urls.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── calculator.js
│   │   ├── export.js
│   │   ├── sample-data.js
│   │   ├── store.js
│   │   ├── add-expense.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── group.js
│   │   └── profile.js
│   ├── index.html
│   ├── dashboard.html
│   ├── group.html
│   ├── add-expense.html
│   ├── settlement.html
│   └── profile.html
└── README.md
```

## Installation 🚀

This project is designed to run entirely in the browser using local storage, so there's **no server-side installation required** for core functionality.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/iIluminatixy/Expense-Tracker.git
    cd Expense-Tracker
    ```

2.  **Open in Browser:**
    Simply open the `frontend/index.html` file in your web browser. No further setup is needed!

    Alternatively, you can use a simple local HTTP server (like `live-server` via npm or Python's `http.server`) to serve the `frontend` directory.

    **Optional: Running the Backend (Django)**
    If you wish to run the Django backend (e.g., for testing API endpoints or future development):

    1.  **Create a Virtual Environment:**
        ```bash
        python -m venv venv
        source venv/bin/activate  # On Windows use `venv\Scripts\activate`
        ```
    2.  **Install Dependencies:**
        ```bash
        pip install -r backend/requirements.txt
        ```
    3.  **Configure Database:**
        Update `backend/expense_tracker/settings.py` with your MySQL credentials or set `USE_SQLITE=True` to use SQLite.
    4.  **Run Migrations:**
        ```bash
        cd backend
        python manage.py makemigrations
        python manage.py migrate
        ```
    5.  **Start the Development Server:**
        ```bash
        python manage.py runserver
        ```

## Usage 💡

SplitWise is designed for seamless group expense management directly in your browser:

1.  **Access the App:** Open `frontend/index.html` in your browser.
2.  **Create/Join Groups:**
    *   Click **`+ New Group`** to create a new expense group.
    *   Or, if you have existing groups in local storage, they will appear automatically.
3.  **Add Members:** Within a group, click **`+ Add Member`** and enter the username of an existing SplitWise user.
4.  **Add Expenses:**
    *   Navigate to the **`Expenses`** tab or click **`+ Add Expense`** from the overview page.
    *   Fill in the expense details: title, amount, date, who paid, and how it should be split.
    *   Choose the **split type** (Equal, Exact Amount, Percentage, Shares) and specify the details for each member.
5.  **View Balances:** Go to the **`Balances`** tab to see:
    *   Each member's net balance (how much they owe or are owed).
    *   A simplified settlement plan showing the minimum number of transfers to clear all debts.
6.  **Record Settlements:** Use the **`✓ Record Settlement`** button to log payments made between members.
7.  **Export Data:** From any group view, use the **`Export`** dropdown to download reports as **CSV** or **PDF**.
8.  **Backup & Restore:** Navigate to the **`Settings`** tab to **`Export JSON Backup`** or **`Import Backup File`** to manage your data.

## How to Use 🛠️

SplitWise is perfect for managing shared expenses for:

*   **Group Trips:** Easily track costs for hotels, activities, and meals during vacations with friends or family.
*   **Roommate Expenses:** Keep track of shared rent, utilities, and grocery bills.
*   **Shared Household Costs:** Manage expenses for common household items or services.
*   **Any Shared Spending:** When you need a simple, private way to track who owes whom.

Simply open the `index.html` file and start adding groups and expenses. All data is saved locally, so you can use it offline and are always in control of your financial data. ✨

## API Reference (Backend - Optional) ⚙️

The backend is built with Django and provides RESTful API endpoints for managing groups, members, expenses, and settlements. These are primarily used by the frontend JavaScript files (`api.js`, etc.) when running in a connected environment, but can also be interacted with directly.

**Key Endpoints (prefixed with `/api/`)**:

*   **Auth:**
    *   `POST /auth/register/`: Register a new user.
    *   `POST /auth/login/`: Log in and receive JWT tokens.
    *   `POST /auth/refresh/`: Refresh JWT access token.
    *   `GET /auth/me/`: Get current logged-in user details.
    *   `GET/PATCH /auth/profile/`: View or update user profile (bio, avatar).
*   **Groups:**
    *   `GET /groups/`: List all groups the user belongs to.
    *   `POST /groups/`: Create a new group.
    *   `GET /groups/{group_id}/`: Get details for a specific group.
    *   `POST /groups/{group_id}/members/`: Add a member to a group.
*   **Expenses:**
    *   `GET /groups/{group_id}/expenses/`: List expenses for a group.
    *   `POST /groups/{group_id}/expenses/`: Add a new expense.
    *   `GET /expenses/{expense_id}/`: Get details of a specific expense.
*   **Settlements:**
    *   `GET /groups/{group_id}/settlements/`: Get balance summary and settlement plan.
    *   `POST /splits/{split_id}/settle/`: Mark a specific split as settled.
*   **Exports:**
    *   `GET /groups/{pk}/export/csv/`: Export group expenses as CSV.
    *   `GET /groups/{pk}/export/pdf/`: Export group expenses as PDF.

*Note: The default setup allows all origins (`CORS_ALLOW_ALL_ORIGINS = True`) for easy development.* 

## Contributing 🤝

Contributions are welcome! Please feel free to:

*   Fork the repository.
*   Create a new branch (`git checkout -b feature/your-feature`).
*   Make your changes.
*   Commit your changes (`git commit -am 'Add some feature'`).
*   Push to the branch (`git push origin feature/your-feature`).
*   Open a Pull Request.

Issues and feature requests are also welcome. Please open an issue on GitHub.

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Important Links 🔗

*   **Live Demo:** [https://iIluminatixy.github.io/Expense-Tracker/frontend/index.html](https://iIluminatixy.github.io/Expense-Tracker/frontend/index.html)
*   **GitHub Repository:** [https://github.com/iIluminatixy/Expense-Tracker](https://github.com/iIluminatixy/Expense-Tracker)

## Footer 

© 2023 Expense-Tracker | [Repository](https://github.com/iIluminatixy/Expense-Tracker) | Developed by [iIluminatixy](https://github.com/iIluminatixy)

--- Fork this repository, give it a ⭐️, and watch it or open an issue if you have questions!
