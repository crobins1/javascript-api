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

// Simplified Image Extraction Endpoint
app.post("/extract-images", checkToken, (req, res) => {
    const { htmlContent, postId, excerpt, slug, title, featuredMedia } = req.body;

    if (!htmlContent) {
        return res.status(400).json({ error: "No HTML content provided" });
    }

    try {
        const imageDetails = [];
        
        // Use Cheerio to parse the HTML content and extract image data
        const $ = cheerio.load(htmlContent);

        // Extract image URLs from <img> tags
        $('img').each((i, img) => {
            const url = $(img).attr('src');
            const alt = $(img).attr('alt') || '';
            const title = $(img).attr('title') || '';
            const description = $(img).attr('data-description') || '';

            if (url) {
                imageDetails.push({
                    url: url,
                    title: title,
                    alt: alt,
                    description: description,
                    type: url.startsWith('data:image') ? 'base64' : 'external'
                });
            }
        });

        // Remove duplicates based on URLs
        const uniqueImageDetails = Array.from(new Set(imageDetails.map(img => img.url)))
            .map(url => imageDetails.find(img => img.url === url));

        // Respond with the extracted images and additional information
        res.json({
            postId,
            excerpt,
            slug,
            title,
            featuredMedia,
            images: uniqueImageDetails
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
