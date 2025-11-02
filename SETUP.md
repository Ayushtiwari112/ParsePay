# Quick Setup Guide

## Step-by-Step Installation

### 1. Prerequisites Check
Make sure you have installed:
- [ ] Node.js (v16+) - [Download](https://nodejs.org/)
- [ ] MongoDB - [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file (use your preferred text editor)
# Update these values:
# MONGODB_URI=mongodb://localhost:27017/creditcardparser
# JWT_SECRET=your_random_secret_key_here

# (Optional) Generate HTTPS certificate
npm run generate-cert

# Start backend server
npm start
# Or for development: npm run dev
```

Backend should now be running on `http://localhost:5000` (or HTTPS on port 5000 if certificates are configured)

### 3. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend should now be running on `http://localhost:3000`

### 4. Test the Application

1. Open your browser to `http://localhost:3000`
2. Click "create a new account" to sign up
3. After signing up, you'll be redirected to the dashboard
4. Upload a credit card statement PDF
5. View the parsed results!

## Common Issues & Solutions

### Issue: MongoDB connection fails
**Solution**: 
- If using local MongoDB, make sure the MongoDB service is running
- If using MongoDB Atlas, verify your connection string and whitelist your IP address

### Issue: Port already in use
**Solution**: 
- Change the PORT in backend/.env file
- Or kill the process using the port:
  - Windows: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`
  - Mac/Linux: `lsof -ti:5000 | xargs kill`

### Issue: npm install fails
**Solution**:
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and package-lock.json, then reinstall
- Make sure you have the latest npm version: `npm install -g npm@latest`

### Issue: PDF parsing fails
**Solution**:
- Ensure the PDF is from a supported provider (Chase, Amex, Citi, Capital One, Bank of America)
- Verify the PDF is not corrupted
- Check browser console for error messages

## Next Steps

- Review the main README.md for detailed documentation
- Check the API endpoints for integration options
- Customize the parser regex patterns in `backend/utils/pdfParser.js` if needed

## Getting Help

If you encounter issues:
1. Check the error messages in the console/terminal
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that MongoDB is running and accessible

