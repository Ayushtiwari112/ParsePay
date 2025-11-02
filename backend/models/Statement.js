const mongoose = require('mongoose');

const statementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank'],
    required: true
  },
  extractedData: {
    accountHolderName: String,
    cardLast4: String,
    cardVariant: String,
    billingCycleStart: Date,
    billingCycleEnd: Date,
    paymentDueDate: Date,
    totalBalance: String,
    minimumDue: String
  },
  rawText: {
    type: String,
    select: false // Don't include in queries by default (can be large)
  },
  parsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Statement', statementSchema);

