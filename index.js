// index.js
const express = require("express");
const bodyParser = require("body-parser");
const { VM } = require("vm2");

const app = express();
const PORT = process.env.PORT || 5000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

// Middleware
app.use(bodyParser.json()); // Changed to parse JSON bodies

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
  const code = req.body.code; // Expecting { "code": "your code here" }
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const vm = new VM({
      timeout: 1000, // 1 second timeout
      sandbox: {}
    });
    const result = vm.run(code);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message, trace: error.stack });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
