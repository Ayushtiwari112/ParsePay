# Project Structure Overview

```
Credit/
│
├── backend/                          # Node.js + Express Backend
│   ├── middleware/
│   │   └── auth.js                  # JWT authentication middleware
│   ├── models/
│   │   ├── User.js                  # User mongoose model
│   │   └── Statement.js             # Statement mongoose model
│   ├── routes/
│   │   ├── auth.js                  # Authentication routes (signup/login)
│   │   └── statements.js            # Statement routes (upload/get/delete)
│   ├── utils/
│   │   └── pdfParser.js             # PDF parsing logic with regex patterns
│   ├── scripts/
│   │   └── generate-cert.js         # SSL certificate generator
│   ├── uploads/                     # Temporary PDF storage (auto-created)
│   ├── ssl/                         # SSL certificates (optional, auto-created)
│   ├── server.js                    # Express server entry point
│   ├── package.json                 # Backend dependencies
│   ├── .gitignore                   # Backend gitignore
│   └── ENV_SETUP.md                 # Environment variables guide
│
├── frontend/                         # React + Tailwind Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx            # Login component
│   │   │   ├── Signup.jsx           # Signup component
│   │   │   ├── Dashboard.jsx        # Main dashboard with upload & results
│   │   │   └── PrivateRoute.jsx     # Protected route wrapper
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Authentication context provider
│   │   ├── App.jsx                  # Main app component with routing
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # Tailwind CSS imports
│   ├── index.html                   # HTML template
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.js               # Vite configuration
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   ├── postcss.config.js            # PostCSS configuration
│   └── .gitignore                   # Frontend gitignore
│
├── README.md                         # Main project documentation
├── SETUP.md                          # Quick setup guide
├── PROJECT_STRUCTURE.md              # This file
└── .gitignore                        # Root gitignore

```

## Key Files Explained

### Backend

- **server.js**: Main Express server with MongoDB connection and HTTPS setup
- **models/User.js**: User schema with password hashing
- **models/Statement.js**: Statement schema storing parsed PDF data
- **routes/auth.js**: Handles user registration and authentication
- **routes/statements.js**: Handles PDF upload, parsing, and CRUD operations
- **utils/pdfParser.js**: Core parsing logic with regex patterns for 5 providers
- **middleware/auth.js**: JWT token verification middleware

### Frontend

- **App.jsx**: Main app with React Router setup
- **components/Dashboard.jsx**: Main interface for uploading PDFs and viewing results
- **components/Login.jsx & Signup.jsx**: Authentication UI components
- **context/AuthContext.jsx**: Global authentication state management

## Data Flow

1. User uploads PDF → Frontend sends to `/api/statements/upload`
2. Backend receives PDF → Extracts text using `pdf-parse`
3. Detects provider → Routes to appropriate parser function
4. Regex extraction → Parses key data points
5. Saves to MongoDB → Returns extracted data
6. Frontend displays → Shows parsed results in dashboard

## Security Features

- JWT tokens for authentication
- Password hashing with bcryptjs
- HTTPS support (optional, for local dev)
- Protected API routes with auth middleware
- File upload validation (PDF only, size limits)

