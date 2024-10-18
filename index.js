const express = require("express");
const bodyParser = require("body-parser");
const { VM } = require("vm2"); // Import vm2 for sandboxed execution
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

// Middleware Setup
app.use(bodyParser.json()); // Parse JSON bodies
app.use(morgan("combined")); // HTTP request logging

// Rate Limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

// Authorization Middleware
const checkToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (token === SECURE_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
};

// Health Check Endpoint
app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

// Image Extraction Endpoint
app.post("/extract-images", checkToken, (req, res) => {
    const elementorData = req.body;

    if (!elementorData) {
        return res.status(400).json({ error: "No data provided" });
    }

    try {
        // Validate that the data is an array
        if (!Array.isArray(elementorData)) {
            throw new Error("Invalid data format: Expected an array");
        }

        // Recursive function to extract image URLs
        const extractImageUrls = (elements, externalUrls = [], base64Urls = []) => {
            elements.forEach(element => {
                if (element.settings) {
                    // Check for background_image.url
                    if (element.settings.background_image && element.settings.background_image.url) {
                        const url = element.settings.background_image.url;
                        if (isBase64(url)) {
                            base64Urls.push(url);
                        } else {
                            externalUrls.push(url);
                        }
                    }

                    // Check for image.url in widgets
                    if (element.settings.image && element.settings.image.url) {
                        const url = element.settings.image.url;
                        if (isBase64(url)) {
                            base64Urls.push(url);
                        } else {
                            externalUrls.push(url);
                        }
                    }
                }

                // If the element has child elements, recurse
                if (element.elements && Array.isArray(element.elements)) {
                    extractImageUrls(element.elements, externalUrls, base64Urls);
                }
            });

            return { externalUrls, base64Urls };
        };

        // Helper function to check if a string is a base64 data URI
        const isBase64 = (str) => /^data:image\/[a-zA-Z]+;base64,/.test(str);

        // Extract image URLs
        const { externalUrls, base64Urls } = extractImageUrls(elementorData);

        // Remove duplicates
        const uniqueExternalUrls = [...new Set(externalUrls)];
        const uniqueBase64Urls = [...new Set(base64Urls)];

        // Respond with the extracted URLs
        res.json({
            externalImageUrls: uniqueExternalUrls,
            base64ImageUrls: uniqueBase64Urls
        });
    } catch (error) {
        console.error("Extraction Error:", error);
        res.status(500).json({
            error: "Failed to extract image URLs",
            message: error.message
        });
    }
});

// Generic JavaScript Execution Endpoint for Make.com
app.post("/execute", checkToken, (req, res) => {
    const { script, context } = req.body;

    if (!script) {
        return res.status(400).json({ error: "Missing required field: script" });
    }

    try {
        // Create a new VM instance with default options
        const vm = new VM({
            timeout: 1000, // Timeout for script execution (1 second)
            sandbox: { context } // Provide any additional context variables here
        });

        // Execute the script in a sandboxed environment
        const result = vm.run(script);

        // Respond with the result of the script execution
        res.json({ result });
    } catch (error) {
        console.error("Execution Error:", error);
        res.status(500).json({
            error: "Failed to execute script",
            message: error.message
        });
    }
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
