# 💳 ParsePay  

A full-stack web application that extracts key data points from credit card statements across 5 major credit card issuers using **PDF parsing** and **regex pattern matching**.

---

## 🎯 Features  

✅ **User Authentication** — Secure JWT-based login and signup  
✅ **PDF Upload** — Upload credit card statement PDFs through a modern web interface  
✅ **Multi-Provider Support** — Parses statements from 5 major credit card providers:  
- HDFC  
- Axis  
- Kotak  
- ICICI  
- SBI  
✅ **Data Extraction** — Extracts 5 key data points:  
- Account Holder Name  
- Card Last 4 Digits + Card Brand/Variant  
- Billing Cycle (Start & End Date)  
- Payment Due Date  
- Total Balance / Minimum Due  
✅ **Secure Communication** — HTTPS support for encrypted data transmission  
✅ **Dashboard** — View all parsed statements in a clean, organized interface  

---

## 🏗️ Tech Stack  

### 🖥️ Frontend  
- React 18 – UI library  
- Tailwind CSS – Styling framework  
- Vite – Build tool  
- React Router – Client-side routing  
- Axios – HTTP client  

### ⚙️ Backend  
- Node.js – Runtime environment  
- Express.js – Web framework  
- MongoDB – Database  
- Mongoose – ODM for MongoDB  
- pdf-parse – PDF text extraction  
- JWT – Authentication  
- bcryptjs – Password hashing  
- Multer – File upload handling  

---

## 📋 Prerequisites  
- Node.js (v16 or higher)  
- npm or yarn  
- MongoDB (local or Atlas connection)  
- OpenSSL (optional, for HTTPS certificate generation)  

---

## 🚀 Installation & Setup  

### 1️⃣ Clone the Repository  
```bash
git clone <repository-url>
cd Credit
2️⃣ Backend Setup
bash
Copy code
cd backend
npm install
cp .env.example .env
Edit the .env file with your configuration:

ini
Copy code
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
PORT=5000
(Optional) Generate SSL certificate for HTTPS:

bash
Copy code
npm run generate-cert
Start the server:

bash
Copy code
npm start
Or for development (auto-reload):

bash
Copy code
npm run dev
3️⃣ Frontend Setup
bash
Copy code
cd frontend
npm install
npm run dev
The frontend will be available at 👉 http://localhost:3000

4️⃣ MongoDB Setup
Option A: Local MongoDB
Install MongoDB locally

Start MongoDB service

Update .env:

bash
Copy code
MONGODB_URI=mongodb://localhost:27017/creditcardparser
Option B: MongoDB Atlas (Cloud)
Create a MongoDB Atlas account

Create a cluster

Get your connection string

Update .env with your Atlas URI

📁 Project Structure
pgsql
Copy code
Credit/
├── backend/
│   ├── models/
│   │   ├── User.js          # User model
│   │   └── Statement.js     # Statement model
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   └── statements.js    # Statement routes
│   ├── middleware/
│   │   └── auth.js          # JWT authentication middleware
│   ├── utils/
│   │   └── pdfParser.js     # PDF parsing logic
│   ├── scripts/
│   │   └── generate-cert.js # SSL certificate generator
│   ├── uploads/             # Temporary PDF storage
│   ├── ssl/                 # SSL certificates
│   ├── server.js            # Express server
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── PrivateRoute.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── package.json
│
└── README.md
🔐 Environment Variables
Backend (.env)

env
Copy code
PORT=5000
MONGODB_URI=mongodb://localhost:27017/creditcardparser
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
📝 API Endpoints
🔑 Authentication
Method	Endpoint	Description
POST	/api/auth/signup	Register new user
POST	/api/auth/login	Login user

📄 Statements
Method	Endpoint	Description
POST	/api/statements/upload	Upload and parse PDF (requires auth)
GET	/api/statements	Get all statements (requires auth)
GET	/api/statements/:id	Get single statement (requires auth)
DELETE	/api/statements/:id	Delete statement (requires auth)

🔒 HTTPS Setup (Optional)
For local development with HTTPS:

bash
Copy code
cd backend
npm run generate-cert
Access the API at 👉 https://localhost:5000

⚠️ Self-signed certificates show a browser warning.
Click "Advanced → Proceed to localhost" to continue.

🧪 Usage
Sign Up — Create a new account at /signup

Login — Sign in at /login

Upload PDF —

Go to Dashboard

Select a credit card statement PDF

Click “Upload & Parse PDF”

View Results — Parsed data will appear below

📊 Extracted Data Points
Field	Description
Account Holder Name	Name on the credit card account
Card Last 4 Digits	Last 4 digits of the card number
Card Variant	Card type/brand (e.g., "Visa Platinum")
Billing Cycle	Start and end dates of billing period
Payment Due Date	Date by which payment must be made
Total Balance	Current outstanding balance
Minimum Due	Minimum payment amount due
