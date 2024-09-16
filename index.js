// index.js
const express = require("express");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

// Apply rate limiting to all requests
app.use(limiter);

// Middleware to parse text/plain bodies
app.use(bodyParser.text({ type: "text/plain" }));

// Function to check token
const checkToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (token === SECURE_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Execute endpoint
app.post("/execute", checkToken, (req, res) => {
  const code = req.body;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    // Execute the code using eval
    const result = eval(code);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message, trace: error.stack });
  }
});

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
