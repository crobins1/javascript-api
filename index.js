const express = require("express");
const bodyParser = require("body-parser");
const { VM } = require('vm2');

const app = express();
const PORT = process.env.PORT || 5000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

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

// Execute endpoint with sandboxed environment
app.post("/execute", checkToken, (req, res) => {
    const code = req.body;
    if (!code) {
        return res.status(400).json({ error: "No code provided" });
    }

    try {
        // Create a new VM instance with limited permissions
        const vm = new VM({
            timeout: 1000, // Execution timeout in milliseconds
            sandbox: {}
        });

        // Execute the code within the sandbox
        const result = vm.run(code);
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
