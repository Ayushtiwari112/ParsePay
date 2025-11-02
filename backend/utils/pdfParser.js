const pdfParse = require('pdf-parse');

// Provider detection patterns
const detectProvider = (text) => {
  const textUpper = text.toUpperCase();
  
  // CRITICAL: Check for HDFC FIRST before any other provider
  // HDFC Bank statements have distinctive patterns
  
  // Check 1: Direct HDFC mentions (highest priority)
  if (textUpper.includes('HDFC BANK CREDIT') || 
      textUpper.includes('HDFC BANK') ||
      textUpper.includes('STATEMENT FOR HDFC') ||
      (textUpper.includes('HDFC') && (textUpper.includes('CREDIT CARD') || textUpper.includes('CREDIT CARDS')))) {
    console.log('HDFC detected via direct mention');
    return 'HDFC Bank';
  }
  
  // Check 2: HDFC GSTIN pattern
  if (textUpper.includes('33AAACH2702H2Z6') || 
      (textUpper.includes('HDFC') && textUpper.includes('GSTIN'))) {
    console.log('HDFC detected via GSTIN');
    return 'HDFC Bank';
  }

  // Only now check other providers AFTER confirming it's not HDFC
  // Prefer Axis when the text contains explicit Axis mentions (includes Flipkart co-branding)
  if (textUpper.includes('AXIS BANK') || textUpper.includes('AXIS') || textUpper.includes('FLIPKART')) {
    return 'Axis Bank';
  }

  if (textUpper.includes('STATE BANK') || textUpper.includes('SBI') || textUpper.includes('STATE BANK OF INDIA')) {
    return 'SBI';
  } else if (textUpper.includes('ICICI')) {
    return 'ICICI Bank';
  } else if (textUpper.includes('KOTAK') || textUpper.includes('KOTAK MAHINDRA')) {
    return 'Kotak Bank';
  }

  return null;
};

// HDFC Bank Parser
const parseHDFC = (text) => {
  const data = {};

  // Account Holder Name - HDFC format: "Name:" or "Account Holder:" followed by full name
  // Match uppercase or mixed-case names with spaces
  const nameMatch = text.match(/(?:Name|Account\s+Holder|Cardholder)[\s:]+([A-Z][A-Z\s]{2,}?)(?:\s*(?:Email|Address|\n|$))/i) ||
                    text.match(/(?:Name|Account\s+Holder|Cardholder)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (nameMatch) {
    data.accountHolderName = nameMatch[1].trim();
  }

  // Card Last 4 digits - keep existing multi-stage approach
  let cardMatch = null;
  cardMatch = text.match(/X{3,4}\s*(\d{4})(?:\s|$|AAN|Statement|Credit|Limit)/i);
  if (!cardMatch) {
    const cardNoSection = text.match(/Card\s+No\s*:?\s*([^\n]{10,50}?)(?:\s*(?:AAN|Statement|Date|$|\n))/i);
    if (cardNoSection) {
      const cardText = cardNoSection[1];
      const maskedPattern = cardText.match(/\d{4}\s+\d{1,2}X{1,2}\s+X{2,4}\s*(\d{4})/i);
      if (maskedPattern && maskedPattern[1]) {
        data.cardLast4 = maskedPattern[1];
        cardMatch = { 1: maskedPattern[1] };
      } else {
        const noSpacePattern = cardText.match(/X{3,4}(\d{4})/i);
        if (noSpacePattern && noSpacePattern[1]) {
          data.cardLast4 = noSpacePattern[1];
          cardMatch = { 1: noSpacePattern[1] };
        }
      }
    }
  }
  if (!cardMatch) {
    const cardContext = text.match(/Card\s+No[:\s]*[\d\sX]{15,60}/i);
    if (cardContext) {
      const last4Match = cardContext[0].match(/X{3,4}\s*(\d{4})/i);
      if (last4Match && last4Match[1]) {
        data.cardLast4 = last4Match[1];
        cardMatch = { 1: last4Match[1] };
      }
    }
  }
  if (!cardMatch) {
    const cardNoLine = text.match(/Card\s+No[:\s]+([^\n]{10,50})/i);
    if (cardNoLine) {
      const all4Digits = cardNoLine[1].match(/\d{4}/g);
      if (all4Digits && all4Digits.length >= 2) {
        data.cardLast4 = all4Digits[all4Digits.length - 1];
        cardMatch = { 1: all4Digits[all4Digits.length - 1] };
      }
    }
  }
  if (cardMatch && !data.cardLast4) {
    data.cardLast4 = cardMatch[1];
  }

  // Card Variant - HDFC Bank Credit Card
  if (text.match(/HDFC\s+Bank\s+Credit\s+Card/i)) {
    const variantMatch = text.match(/(?:Regalia|Diners|Club|MoneyBack|Platinum|Titanium|Freedom|Millennia|IndianOil|Business)/i);
    if (variantMatch) {
      data.cardVariant = `HDFC Bank ${variantMatch[0]}`;
    } else {
      data.cardVariant = 'HDFC Bank Credit Card';
    }
  }

  // Helper to parse DD/MM/YYYY style dates into Date objects (robust to 2-digit years)
  const parseDMY = (dstr) => {
    const parts = dstr.split(/[\/\-\.]*/).map(s => parseInt(s, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    let [day, month, year] = parts;
    month = month - 1;
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  };

  // Helper to parse amounts like "83,794.00" or "Rs. 83,794.00" and detect Dr/Cr
  const parseAmount = (s) => {
    if (!s) return null;
    const isDr = /\bDr\b/i.test(s);
    const num = String(s).replace(/[^0-9.\-,]/g, '');
    if (!num) return null;
    const cleaned = num.replace(/,/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : { val, isDr };
  };

  // Statement Date
  const statementDateMatch = text.match(/Statement\s+Date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);

  // Attempt to capture Payment Due Date + Total Dues + Minimum Amount Due from the header table (strong signal)
  // New strategy: scan lines for a header-like line containing Payment / Total / Minimum then inspect the following lines for date + two amounts
  let headerCaptured = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && !headerCaptured; i++) {
    const l = lines[i] || '';
    if (/payment\s*due/i.test(l) && /total\s*(?:dues|due|amount)/i.test(l) && /minimum/i.test(l)) {
      const next = ((lines[i+1] || '') + ' ' + (lines[i+2] || '')).trim();
      const vals = next.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}).{0,80}?([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?).{0,80}?([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?)/i);
      if (vals) {
        const parsedDue = parseDMY(vals[1]);
        if (parsedDue) data.paymentDueDate = parsedDue;
        const totParsed = parseAmount(vals[2]);
        const minParsed = parseAmount(vals[3]);
        if (totParsed) {
          data.totalBalance = (totParsed.val).toFixed(2);
          if (totParsed.isDr) data.totalBalanceIsDr = true;
        }
        if (minParsed) {
          data.minimumDue = (minParsed.val).toFixed(2);
          if (minParsed.isDr) data.minimumDueIsDr = true;
        }
        headerCaptured = true;
        break;
      }
    }
  }

  // Also handle case where header and values are on the same (possibly long) line without explicit newline
  if (!headerCaptured) {
    const inlineHeader = text.match(/Payment\s*Due\s*Date[\s:\-\s]*.*?Total\s*(?:Dues|Due|Amount)[\s:\-\s]*.*?Minimum\s*(?:Amount\s*)?Due[\s:]*([\s\S]{0,200})/i);
    if (inlineHeader && inlineHeader[1]) {
      const vals = inlineHeader[1].match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}).{0,80}?([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?).{0,80}?([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?)/i);
      if (vals) {
        const parsedDue = parseDMY(vals[1]);
        if (parsedDue) data.paymentDueDate = parsedDue;
        const totParsed = parseAmount(vals[2]);
        const minParsed = parseAmount(vals[3]);
        if (totParsed) {
          data.totalBalance = (totParsed.val).toFixed(2);
          if (totParsed.isDr) data.totalBalanceIsDr = true;
        }
        if (minParsed) {
          data.minimumDue = (minParsed.val).toFixed(2);
          if (minParsed.isDr) data.minimumDueIsDr = true;
        }
        headerCaptured = true;
      }
    }
  }

  // Fallback: older headerRowMatch positional capture (kept for resilience) — only run if not captured above
  if (!headerCaptured) {
    const headerRowMatch = text.match(/Payment\s+Due\s+Date[\s\S]{0,120}?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{0,80}?([\d,]+\.?\d{0,2})[\s\S]{0,80}?([\d,]+\.?\d{0,2})/i);
    if (headerRowMatch) {
      const parsedDue = parseDMY(headerRowMatch[1]);
      if (parsedDue) data.paymentDueDate = parsedDue;
      if (!data.totalBalance && headerRowMatch[2]) {
        const tot = parseAmount(headerRowMatch[2]);
        if (tot) data.totalBalance = (tot.val).toFixed(2);
      }
      if (!data.minimumDue && headerRowMatch[3]) {
        const min = parseAmount(headerRowMatch[3]);
        if (min) data.minimumDue = (min.val).toFixed(2);
      }
    }
  }

  // Billing Cycle - prefer explicit 'Billing Cycle' section first
  let billingCycleMatch = null;
  const billingBlockMatch = text.match(/Billing\s+Cycle[\s\S]{0,200}/i);
  if (billingBlockMatch) {
    const block = billingBlockMatch[0];
    const fromTo = block.match(/From\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{0,80}?To\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (fromTo) {
      billingCycleMatch = { 1: fromTo[1], 2: fromTo[2] };
    }
  }

  // If not found, fallback to previous heuristics
  if (!billingCycleMatch) {
    billingCycleMatch = text.match(/From[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{1,50}To[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  }

  if (!billingCycleMatch) {
    const billingSection = text.match(/Billing\s+Cycle[\s:]*\n?From[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{1,50}To[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (billingSection) billingCycleMatch = { 1: billingSection[1], 2: billingSection[2] };
  }

  if (!billingCycleMatch) {
    const fromContextMatch = text.match(/(?:Billing\s+Cycle[\s:]*)?From[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{0,200}?To[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (fromContextMatch) billingCycleMatch = { 1: fromContextMatch[1], 2: fromContextMatch[2] };
  }

  if (billingCycleMatch) {
    const start = parseDMY(billingCycleMatch[1]);
    const end = parseDMY(billingCycleMatch[2]);
    if (start) data.billingCycleStart = start;
    if (end) data.billingCycleEnd = end;
  } else if (statementDateMatch) {
    // Fallback: use statement date as end, start = one month before (preserve day)
    const stmt = parseDMY(statementDateMatch[1]);
    if (stmt) {
      const endDate = new Date(stmt.getTime());
      const startDate = new Date(stmt.getTime());
      startDate.setMonth(startDate.getMonth() - 1);
      // If month subtraction yields an invalid day (e.g., 31 -> shorter month), JS will roll forward; normalize by setting date to 1 then adjusting
      if (startDate.getDate() !== stmt.getDate()) {
        // try a safer fallback: subtract 30 days
        startDate.setTime(stmt.getTime() - (30 * 24 * 60 * 60 * 1000));
      }
      data.billingCycleStart = startDate;
      data.billingCycleEnd = endDate;

      // Try to refine using transaction dates only if they clearly fall inside reasonable bounds
      const transactionDates = (text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [])
        .map(d => parseDMY(d))
        .filter(d => d instanceof Date && !isNaN(d));
      if (transactionDates.length > 0) {
        transactionDates.sort((a, b) => a - b);
        // Accept refinement only if earliest and latest are within ~60 days of each other
        const earliest = transactionDates[0];
        const latest = transactionDates[transactionDates.length - 1];
        if ((latest - earliest) / (24 * 60 * 60 * 1000) <= 90) {
          data.billingCycleStart = earliest;
          data.billingCycleEnd = latest;
        }
      }
    }
  }

  // Payment Due Date - robust extraction (try multiple nearby patterns)
  let dueMatch = text.match(/Payment\s+Due\s+Date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (!dueMatch) dueMatch = text.match(/Payment\s+Due\s+Date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (!dueMatch) {
    const dueSection = text.match(/Payment\s+Due\s+Date[:\s]*([^\n]{0,40})/i);
    if (dueSection) {
      const dateMatch = dueSection[1].match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      if (dateMatch) dueMatch = { 1: dateMatch[1] };
    }
  }
  if (dueMatch) {
    const parsed = parseDMY(dueMatch[1]);
    if (parsed) data.paymentDueDate = parsed;
  }

  // Total Balance (Total Dues) - gather all matches and pick the most plausible one
  const totalDuesRegex = /Total\s+Dues[:\s]*([^\n]{0,60})/gi;
  const totalCandidates = [];
  let m;
  while ((m = totalDuesRegex.exec(text)) !== null) {
    const snippet = m[1];
    const amountMatch = snippet.match(/([\d,]+\.?\d{0,2})/);
    if (amountMatch) {
      const amtObj = parseAmount(amountMatch[1]);
      totalCandidates.push({ amt: amtObj ? amtObj.val : null, index: m.index, snippet, raw: amountMatch[1] });
    }
  }

  // If none found, try a looser match (sometimes header separated)
  if (totalCandidates.length === 0) {
    const loose = text.match(/Total\s+Dues[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
    if (loose && loose[1]) {
      const amtObj = parseAmount(loose[1]);
      if (amtObj) totalCandidates.push({ amt: amtObj.val, index: loose.index || 0, snippet: loose[0], raw: loose[1] });
    }
  }

  // Choose candidate: prefer one whose surrounding context includes 'Payment Due Date' or 'Statement for HDFC'
  let chosenTotal = null;
  if (totalCandidates.length > 0) {
    for (const c of totalCandidates) {
      const ctxStart = Math.max(0, c.index - 100);
      const ctx = text.substring(ctxStart, c.index + 120).toUpperCase();
      if (ctx.includes('PAYMENT DUE DATE') || ctx.includes('STATEMENT FOR HDFC')) {
        chosenTotal = c; break;
      }
    }
    if (!chosenTotal) {
      // fallback: pick the largest amount (Total Dues should generally be the larger number)
      totalCandidates.sort((a, b) => (b.amt || 0) - (a.amt || 0));
      chosenTotal = totalCandidates[0];
    }
  }

  if (chosenTotal && chosenTotal.amt != null) {
    // Do not overwrite if already set by headerRowMatch or explicit label
    if (!data.totalBalance) {
      data.totalBalance = (chosenTotal.amt).toFixed(2);
    }
  }

  // Minimum Amount Due - similar strategy
  const minDueRegex = /Minimum\s+Amount\s+Due[:\s]*([^\n]{0,60})/gi;
  const minCandidates = [];
  while ((m = minDueRegex.exec(text)) !== null) {
    const snippet = m[1];
    const amountMatch = snippet.match(/([\d,]+\.?\d{0,2})/);
    if (amountMatch) {
      const amtObj = parseAmount(amountMatch[1]);
      minCandidates.push({ amt: amtObj ? amtObj.val : null, index: m.index, snippet, raw: amountMatch[1] });
    }
  }
  if (minCandidates.length === 0) {
    const looseMin = text.match(/Minimum\s+Amount\s+Due[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
    if (looseMin && looseMin[1]) {
      const amtObj = parseAmount(looseMin[1]);
      if (amtObj) minCandidates.push({ amt: amtObj.val, index: looseMin.index || 0, snippet: looseMin[0], raw: looseMin[1] });
    }
  }

  let chosenMin = null;
  if (minCandidates.length > 0) {
    // prefer the one near the chosen total or near 'Payment Due Date'
    if (chosenTotal) {
      minCandidates.sort((a, b) => Math.abs(a.index - chosenTotal.index) - Math.abs(b.index - chosenTotal.index));
      chosenMin = minCandidates[0];
    } else {
      for (const c of minCandidates) {
        const ctxStart = Math.max(0, c.index - 100);
        const ctx = text.substring(ctxStart, c.index + 120).toUpperCase();
        if (ctx.includes('PAYMENT DUE DATE') || ctx.includes('STATEMENT FOR HDFC')) { chosenMin = c; break; }
      }
      if (!chosenMin) {
        // fallback: pick smallest positive amount (minimum due should be smaller than total)
        minCandidates.sort((a, b) => (a.amt || 0) - (b.amt || 0));
        chosenMin = minCandidates[0];
      }
    }
  }

  if (chosenMin && chosenMin.amt != null) {
    // Do not overwrite if already set by headerRowMatch or explicit label
    if (!data.minimumDue) {
      data.minimumDue = (chosenMin.amt).toFixed(2);
    }
  }

  return data;
};

// SBI Parser
const parseSBI = (text) => {
  const data = {};
  const nameMatch = text.match(/(?:Name|Account\s+Holder|Cardholder)[\s:]+([A-Z][A-Z\s]{2,}?)/i) || text.match(/(?:Name|Cardholder)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (nameMatch) data.accountHolderName = nameMatch[1].trim();

  const cardMatch = text.match(/(?:Card\s+No[:\s]*|ending in|Last\s+4)[\s:]*X{0,4}\s*(\d{4})/i);
  if (cardMatch) data.cardLast4 = cardMatch[1];

  const cycleMatch = text.match(/(?:Statement\s+period|Billing\s+period|Billing\s+Cycle)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\-–to]{1,6}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (cycleMatch) { data.billingCycleStart = new Date(cycleMatch[1]); data.billingCycleEnd = new Date(cycleMatch[2]); }

  const dueMatch = text.match(/(?:Payment\s+Due|Due\s+Date)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dueMatch) data.paymentDueDate = new Date(dueMatch[1]);

  const balanceMatch = text.match(/(?:Total\s+Dues|Total\s+Amount|Total\s+Balance|Current\s+Balance)[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
  if (balanceMatch) data.totalBalance = balanceMatch[1].replace(/,/g, '');

  const minMatch = text.match(/(?:Minimum\s+Amount\s+Due|Minimum\s+Due|Min\s+Due)[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
  if (minMatch) data.minimumDue = minMatch[1].replace(/,/g, '');

  data.cardVariant = 'SBI Credit Card';
  return data;
};

// ICICI Parser
const parseICICI = (text) => {
  const data = {};
  const nameMatch = text.match(/(?:Name|Account\s+Holder|Cardholder)[\s:]+([A-Z][A-Z\s]{2,}?)/i) || text.match(/(?:Name|Cardholder)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (nameMatch) data.accountHolderName = nameMatch[1].trim();

  const cardMatch = text.match(/(?:Card\s+No[:\s]*|ending in|Last\s+4)[\s:]*X{0,4}\s*(\d{4})/i);
  if (cardMatch) data.cardLast4 = cardMatch[1];

  const cycleMatch = text.match(/(?:Statement\s+period|Billing\s+period|Billing\s+Cycle)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\-–to]{1,6}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (cycleMatch) { data.billingCycleStart = new Date(cycleMatch[1]); data.billingCycleEnd = new Date(cycleMatch[2]); }

  const dueMatch = text.match(/(?:Payment\s+Due|Due\s+Date)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dueMatch) data.paymentDueDate = new Date(dueMatch[1]);

  const balanceMatch = text.match(/(?:Total\s+Dues|Total\s+Amount|Total\s+Balance|Current\s+Balance)[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
  if (balanceMatch) data.totalBalance = balanceMatch[1].replace(/,/g, '');

  const minMatch = text.match(/(?:Minimum\s+Amount\s+Due|Minimum\s+Due|Min\s+Due)[:\s]*[Rs\.\s]*([\d,]+\.?\d{0,2})/i);
  if (minMatch) data.minimumDue = minMatch[1].replace(/,/g, '');

  data.cardVariant = 'ICICI Credit Card';
  return data;
};

// Axis Bank Parser
const parseAxis = (text) => {
  const data = {};

  // local helpers
  const parseDMYLocal = (dstr) => {
    if (!dstr) return null;
    const parts = dstr.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
    if (!parts) return null;
    const p = parts[1].split(/[\/\-\.]/).map(s => parseInt(s, 10));
    if (p.length !== 3 || p.some(isNaN)) return null;
    let [day, month, year] = p; month = month - 1; if (year < 100) year += 2000; return new Date(year, month, day);
  };
  const parseAmtLocal = (s) => {
    if (!s) return null;
    const raw = String(s);
    const isDr = /\bDr\b/i.test(raw);
    const num = raw.replace(/[^0-9.\-,]/g, '');
    if (!num) return null;
    const cleaned = num.replace(/,/g, '');
    const v = parseFloat(cleaned);
    if (isNaN(v)) return null;
    return { val: v, isDr };
  };

  // Prefer PAYMENT SUMMARY block to reduce false matches
  const paymentBlockMatch = text.match(/PAYMENT\s+SUMMARY[\s\S]{0,400}(?=(?:ACCOUNT\s+SUMMARY|TRANSACTION\s+DETAILS|$))/i);
  const block = paymentBlockMatch ? paymentBlockMatch[0] : text;

  // Account Holder - try explicit label first, then fallback to first line if it's a name
  const accMatch = text.match(/Account\s+Holder[:\s]+([A-Z][A-Za-z\s\.]{2,})/i) || text.match(/Name[:\s]+([A-Z][A-Za-z\s\.]{2,})/i);
  if (accMatch) data.accountHolderName = accMatch[1].trim();
  if (!data.accountHolderName) {
    const firstLine = (text.split(/\r?\n/).find(l => l && l.trim().length > 0) || '').trim();
    if (/^[A-Z][A-Z\s\.]{3,60}$/.test(firstLine)) data.accountHolderName = firstLine;
  }

  // Card Last 4 digits - robust patterns
  let cardMatch = block.match(/Card\s*(?:No|Number)[:\s]*([0-9\*X\s-]{6,})/i) || text.match(/(\d{6}\*+\d{4}|\d{4}\*{2,}\d{4}|\d{4}\s*\*+\s*\d{4}|ending in\s*(\d{4})|Last\s+4\s*[:\s]*(\d{4}))/i);
  if (cardMatch) {
    const cm = cardMatch[1] || cardMatch[0];
    const last4 = (cm.match(/(\d{4})\s*$/) || cm.match(/(\d{4})/));
    if (last4) data.cardLast4 = last4[1];
  }

  // Special handling: PAYMENT SUMMARY layout where Statement Period and Payment Due Date are on one line
  const lines = text.split(/\r?\n/);
  const pmIndex = lines.findIndex(l => /PAYMENT\s*SUMMARY/i.test(l));
  if (pmIndex !== -1) {
    // search next few lines for a line with date range and then an amount line
    for (let j = pmIndex; j < Math.min(lines.length, pmIndex + 8); j++) {
      const dateLine = lines[j] || '';
      const rangeMatch = dateLine.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*[-–]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      if (rangeMatch) {
        // set billing cycle
        const s = parseDMYLocal(rangeMatch[1]);
        const e = parseDMYLocal(rangeMatch[2]);
        if (s) data.billingCycleStart = s;
        if (e) data.billingCycleEnd = e;

        // amounts are often on the next line
        const amtLine = (lines[j+1] || '').trim();
        // match amounts with optional Dr/Cr; this handles cases like "15,564.03   Dr1,320.00   Dr"
        const amtRegex = /([₹Rs\.\s]*[\d,]+\.?\d{2})(?:\s*(Dr|Cr))?/ig;
        const found = [];
        let mm;
        while ((mm = amtRegex.exec(amtLine)) !== null) {
          found.push({ raw: mm[1], suffix: mm[2] });
        }
        // if no amounts in amtLine, try the same on the dateLine (sometimes they are on same line)
        if (found.length === 0) {
          while ((mm = amtRegex.exec(dateLine)) !== null) {
            found.push({ raw: mm[1], suffix: mm[2] });
          }
        }
        if (found.length >= 1) {
          const p = parseAmtLocal(found[0].raw);
          if (p) { data.totalBalance = p.val.toFixed(2); if (p.isDr) data.totalBalanceIsDr = true; }
        }
        if (found.length >= 2) {
          const p2 = parseAmtLocal(found[1].raw);
          if (p2) { data.minimumDue = p2.val.toFixed(2); if (p2.isDr) data.minimumDueIsDr = true; }
        }

        break; // stop after processing first range found
      }
    }
  }

  // Total Payment Due (fallbacks)
  if (!data.totalBalance) {
    const totalMatch = block.match(/Total\s+Payment\s+Due[:\s]*([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?)/i) || text.match(/Total\s+Payment\s+Due[:\s]*([₹Rs\.\s]*[\d,]+\.?\d{0,2})/i);
    if (totalMatch) {
      const parsed = parseAmtLocal(totalMatch[1]); if (parsed) { data.totalBalance = parsed.val.toFixed(2); if (parsed.isDr) data.totalBalanceIsDr = true; }
    }
  }
  if (!data.minimumDue) {
    const minMatch = block.match(/Minimum\s+Payment\s+Due[:\s]*([₹Rs\.\s]*[\d,]+\.?\d{0,2}(?:\s*(?:Dr|Cr))?)/i) || text.match(/Minimum\s+Payment\s+Due[:\s]*([₹Rs\.\s]*[\d,]+\.?\d{0,2})/i);
    if (minMatch) { const parsed = parseAmtLocal(minMatch[1]); if (parsed) { data.minimumDue = parsed.val.toFixed(2); if (parsed.isDr) data.minimumDueIsDr = true; } }
  }

  // Payment Due Date fallback
  if (!data.paymentDueDate) {
    const dueMatch = block.match(/Payment\s+Due\s+Date[:\s]*([\d\/\-\.]{6,20})/i) || text.match(/Payment\s+Due[:\s]*([\d\/\-\.]{6,20})/i);
    if (dueMatch) { const pd = parseDMYLocal(dueMatch[1]); if (pd) data.paymentDueDate = pd; }
  }

  // Ensure cardLast4 present via looser search
  if (!data.cardLast4) {
    const anyCard = text.match(/(\d{6}\*+\d{4}|\d{4}\*{2,}\d{4}|\d{4}\s*\*+\s*\d{4}|Card\s*No[:\s]*([0-9\*X\s-]{6,}))/i);
    if (anyCard) { const cm = anyCard[1] || anyCard[0]; const last4 = (cm.match(/(\d{4})\s*$/) || cm.match(/(\d{4})/)); if (last4) data.cardLast4 = last4[1]; }
  }

  // Card variant: if the document contains HDFC explicitly prefer HDFC label, otherwise Axis
  if (/HDFC\s+BANK/i.test(text) || /HDFC\b/i.test(text)) {
    data.cardVariant = 'HDFC Bank Credit Card';
  } else {
    data.cardVariant = data.cardVariant || 'Axis Bank Credit Card';
  }

  return data;
};

// Kotak Bank Parser
const parseKotak = (text) => {
  const data = {};
  const parseDMYLocal = (dstr) => {
    if (!dstr) return null;
    const parts = dstr.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
    if (!parts) return null;
    const p = parts[1].split(/[\/\-\.]/).map(s => parseInt(s, 10));
    if (p.length !== 3 || p.some(isNaN)) return null;
    let [day, month, year] = p; month = month - 1; if (year < 100) year += 2000; return new Date(year, month, day);
  };
  const parseAmtLocal = (s) => {
    if (!s) return null;
    const num = String(s).replace(/[^0-9.\-]/g, '');
    if (!num) return null;
    const v = parseFloat(num.replace(/,/g, ''));
    return isNaN(v) ? null : v.toFixed(2);
  };

  // Try to focus on PAYMENT SUMMARY or PAYMENT section
  const paymentBlockMatch = text.match(/PAYMENT[\s\S]{0,400}(?=(?:ACCOUNT|TRANSACTION|STATEMENT|$))/i);
  const block = paymentBlockMatch ? paymentBlockMatch[0] : text;

  // Card Last 4
  let cardMatch = block.match(/Card\s*(?:No|Number)[:\s]*([0-9\*X\s-]{6,})/i) || text.match(/(\d{6}\*+\d{4}|\d{4}\*{2,}\d{4}|\d{4}\s*\*+\s*\d{4})/i);
  if (cardMatch) {
    const cm = cardMatch[1] || cardMatch[0];
    const last4 = (cm.match(/(\d{4})\s*$/) || cm.match(/(\d{4})/));
    if (last4) data.cardLast4 = last4[1];
  }

  // Total / Amount Due
  const totalMatch = block.match(/(?:Total\s+Payment\s+Due|Amount\s+Due|Total\s+Amount\s+Due|Total\s+Due)[:\s]*([\d,]+\.?\d{0,2})/i);
  if (totalMatch) {
    const v = parseAmtLocal(totalMatch[1]);
    if (v) data.totalBalance = v;
  }

  // Minimum Due
  const minMatch = block.match(/(?:Minimum\s+Payment\s+Due|Minimum\s+Amount\s+Due|Minimum\s+Due|Min\s+Due)[:\s]*([\d,]+\.?\d{0,2})/i);
  if (minMatch) {
    const v = parseAmtLocal(minMatch[1]);
    if (v) data.minimumDue = v;
  }

  // Statement Period
  const stmtMatch = block.match(/Statement\s+Period[:\s]*([\d\/\-\.]+)\s*(?:-|to|\u2013)\s*([\d\/\-\.]+)/i) || block.match(/Statement\s+Period[:\s]*([^\n]+)/i);
  if (stmtMatch) {
    if (stmtMatch[1] && stmtMatch[2]) {
      const s = parseDMYLocal(stmtMatch[1]); const e = parseDMYLocal(stmtMatch[2]); if (s) data.billingCycleStart = s; if (e) data.billingCycleEnd = e;
    } else {
      const two = (stmtMatch[1]||'').match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}).*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
      if (two) { const s = parseDMYLocal(two[1]); const e = parseDMYLocal(two[2]); if (s) data.billingCycleStart = s; if (e) data.billingCycleEnd = e; }
    }
  }

  // Payment Due Date
  const dueMatch = block.match(/Payment\s+Due\s+Date[:\s]*([\d\/\-\.]{6,20})/i) || text.match(/Payment\s+Due[:\s]*([\d\/\-\.]{6,20})/i);
  if (dueMatch) { const pd = parseDMYLocal(dueMatch[1]); if (pd) data.paymentDueDate = pd; }

  // Fallbacks
  if (!data.totalBalance) {
    const loose = text.match(/(?:Amount\s+Due|Total\s+Due|Total\s+Payment\s+Due)[:\s]*([\d,]+\.?\d{0,2})/i);
    if (loose) { const v = parseAmtLocal(loose[1]); if (v) data.totalBalance = v; }
  }
  if (!data.minimumDue) {
    const looseMin = text.match(/(?:Minimum\s+Payment\s+Due|Minimum\s+Amount\s+Due|Min\s+Due)[:\s]*([\d,]+\.?\d{0,2})/i);
    if (looseMin) { const v = parseAmtLocal(looseMin[1]); if (v) data.minimumDue = v; }
  }
  if (!data.cardLast4) {
    const anyCard = text.match(/(\d{6}\*+\d{4}|\d{4}\*{2,}\d{4}|\d{4}\s*\*+\s*\d{4}|Card\s*No[:\s]*([0-9\*X\s-]{6,}))/i);
    if (anyCard) { const cm = anyCard[1] || anyCard[0]; const last4 = (cm.match(/(\d{4})\s*$/) || cm.match(/(\d{4})/)); if (last4) data.cardLast4 = last4[1]; }
  }

  data.cardVariant = 'Kotak Bank Credit Card';
  return data;
};

// Main Parser Function
const ParsePay = async (buffer) => {
  try {
    // Extract text from PDF
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    
    // Debug: Save full text to file for analysis
    const fs = require('fs');
    const path = require('path');
    const debugPath = path.join(__dirname, '../../debug_pdf_text.txt');
    fs.writeFileSync(debugPath, text);
    console.log('=== Full PDF text saved to:', debugPath, '===');
    
    // Debug: Log first 500 chars to see what we're working with
    console.log('=== PDF TEXT EXTRACTED (first 500 chars) ===');
    console.log(text.substring(0, 500));
    console.log('=== END EXTRACTED TEXT ===\n');
    
    // Detect provider
    const provider = detectProvider(text);
    console.log('=== DETECTED PROVIDER ===', provider);
    
    if (!provider) {
      // Show what was found in the text for debugging
      const textUpper = text.toUpperCase();
      const foundBanks = [];
      if (textUpper.includes('HDFC')) foundBanks.push('HDFC');
      if (textUpper.includes('CHASE')) foundBanks.push('CHASE');
      if (textUpper.includes('AMEX') || textUpper.includes('AMERICAN EXPRESS')) foundBanks.push('AMEX');
      if (textUpper.includes('CITI')) foundBanks.push('CITI');
      if (textUpper.includes('CAPITAL ONE')) foundBanks.push('CAPITAL ONE');
      if (textUpper.includes('BANK OF AMERICA')) foundBanks.push('BANK OF AMERICA');
      
      throw new Error(`Unable to detect credit card provider. Found keywords: ${foundBanks.join(', ')}. Supported providers: HDFC Bank, Chase, American Express, Citi, Capital One, Bank of America`);
    }
    
    // Parse based on provider
    let extractedData = {};
    switch (provider) {
      case 'HDFC Bank':
        extractedData = parseHDFC(text);
        break;
      case 'SBI':
        extractedData = parseSBI(text);
        break;
      case 'ICICI Bank':
        extractedData = parseICICI(text);
        break;
      case 'Axis Bank':
        extractedData = parseAxis(text);
        break;
      case 'Kotak Bank':
        extractedData = parseKotak(text);
        break;
      default:
        throw new Error('Unsupported provider');
    }
    
    console.log('=== EXTRACTED DATA ===', JSON.stringify(extractedData, null, 2));
    
    // For HDFC, add additional debug logging
    if (provider === 'HDFC Bank') {
      console.log('=== HDFC PARSING DEBUG ===');
      console.log('Card No section:', text.match(/Card\s+No[^\n]{0,50}/i)?.[0]);
      console.log('Billing Cycle section:', text.match(/Billing\s+Cycle[\s\S]{0,100}/i)?.[0]);
      console.log('From To section:', text.match(/From[\s:]+[\d\/\s\-\.]+To[\s:]+[\d\/\s\-\.]+/i)?.[0]);
      console.log('Payment Due Date section:', text.match(/Payment\s+Due\s+Date[^\n]{0,50}/i)?.[0]);
      console.log('Total Dues section:', text.match(/Total\s+Dues[^\n]{0,50}/i)?.[0]);
      console.log('Minimum Amount Due section:', text.match(/Minimum\s+Amount\s+Due[^\n]{0,50}/i)?.[0]);
    }
    
    return {
      provider,
      extractedData,
      rawText: text
    };
  } catch (error) {
    console.error('=== PDF PARSING ERROR ===', error);
    throw new Error(`PDF parsing error: ${error.message}`);
  }
};

module.exports = { ParsePay };

