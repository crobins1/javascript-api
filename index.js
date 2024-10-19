const express = require("express");
const bodyParser = require("body-parser");
const { VM } = require("vm2");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cheerio = require("cheerio"); // Import cheerio for HTML parsing
require("dotenv").config();

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

// Updated Image Extraction Endpoint
app.post("/extract-images", checkToken, (req, res) => {
    const { htmlContent, elementorData } = req.body;

    // Enhanced error handling for debugging
    if (!htmlContent && !elementorData) {
        return res.status(400).json({ error: "Invalid or missing data. Please provide 'htmlContent' and/or 'elementorData'." });
    }

    const imageDetails = [];

    // Extract images from HTML content if available
    if (htmlContent && typeof htmlContent === "string") {
        try {
            const $ = cheerio.load(htmlContent);

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
        } catch (error) {
            console.error("HTML Extraction Error:", error);
            return res.status(500).json({
                error: "Failed to extract images from HTML content",
                message: error.message
            });
        }
    }

    // Extract images from Elementor JSON data if available
    if (elementorData && typeof elementorData === "string") {
        try {
            const data = JSON.parse(elementorData);

            const extractImagesFromElements = (elements) => {
                elements.forEach(element => {
                    if (element.settings && element.settings.background_image && element.settings.background_image.url) {
                        imageDetails.push({
                            url: element.settings.background_image.url,
                            title: element.settings.background_image.alt || '',
                            alt: element.settings.background_image.alt || '',
                            description: element.settings.background_image.description || '',
                            type: 'external'
                        });
                    }

                    // If there are nested elements, extract from them as well
                    if (element.elements && Array.isArray(element.elements)) {
                        extractImagesFromElements(element.elements);
                    }
                });
            };

            if (Array.isArray(data)) {
                extractImagesFromElements(data);
            }
        } catch (error) {
            console.error("Elementor Data Extraction Error:", error);
            return res.status(500).json({
                error: "Failed to extract images from Elementor data",
                message: error.message
            });
        }
    }

    // Remove duplicates based on URLs
    const uniqueImageDetails = Array.from(new Set(imageDetails.map(JSON.stringify))).map(JSON.parse);

    console.log("Extracted image details:", uniqueImageDetails); // Debug log

    // Respond with the list of unique images with details
    res.json({ images: uniqueImageDetails });
});

// Generic JavaScript Execution Endpoint for Make.com
app.post("/execute", checkToken, (req, res) => {
    const { script, context, postId, excerpt, slug, title, featuredMedia } = req.body;

    if (!script) {
        return res.status(400).json({ error: "Missing required field: script" });
    }

    try {
        // Create a new VM instance with default options
        const vm = new VM({
            timeout: 1000, // Timeout for script execution (1 second)
            sandbox: { context, postId, excerpt, slug, title, featuredMedia } // Provide any additional context variables here
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
