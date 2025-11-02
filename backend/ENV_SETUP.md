# Environment Variables Setup

Create a `.env` file in the `backend` directory with the following variables:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/creditcardparser
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

## Variable Descriptions:

- **PORT**: The port number for the backend server (default: 5000)
- **MONGODB_URI**: MongoDB connection string
  - Local: `mongodb://localhost:27017/creditcardparser`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/creditcardparser`
- **JWT_SECRET**: A secure random string used for signing JWT tokens
  - Generate one using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **NODE_ENV**: Environment mode (development/production)

## Quick Setup:

1. Copy this file content
2. Create a new file named `.env` in the backend directory
3. Paste and update the values as needed

