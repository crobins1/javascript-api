const express = require("express");
const bodyParser = require("body-parser");
const { VM } = require("vm2");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cheerio = require("cheerio");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECURE_TOKEN = process.env.SECURE_TOKEN;

// Middleware Setup
app.use(bodyParser.json({ limit: '50mb' }));
app.use(morgan("combined"));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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

// Enhanced Image Extraction Endpoint
app.post("/extract-images", checkToken, (req, res) => {
    const { htmlContent } = req.body;
    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim() === "") {
        return res.status(400).json({ error: "Invalid or missing data. Please provide a valid HTML string in 'htmlContent'." });
    }

    try {
        const $ = cheerio.load(htmlContent);
        const imageDetails = [];

        $('img').each((i, img) => {
            const url = $(img).attr('src');
            const alt = $(img).attr('alt') || '';
            const title = $(img).attr('title') || '';
            const width = $(img).attr('width') || '';
            const height = $(img).attr('height') || '';
            const className = $(img).attr('class') || '';

            if (url) {
                imageDetails.push({
                    url: url,
                    alt: alt,
                    title: title,
                    width: width,
                    height: height,
                    class: className,
                    type: url.startsWith('data:image') ? 'base64' : 'external'
                });
            }
        });

        // Remove duplicates based on URLs
        const uniqueImageDetails = Array.from(new Set(imageDetails.map(JSON.stringify))).map(JSON.parse);

        res.json({ images: uniqueImageDetails });
    } catch (error) {
        console.error("Extraction Error:", error);
        res.status(500).json({
            error: "Failed to extract image URLs",
            message: error.message
        });
    }
});

// Generic JavaScript Execution Endpoint
app.post("/execute", checkToken, (req, res) => {
    const { script, context } = req.body;
    if (!script) {
        return res.status(400).json({ error: "Missing required field: script" });
    }

    try {
        const vm = new VM({
            timeout: 5000, // Increased timeout to 5 seconds
            sandbox: { 
                context,
                cheerio, // Add cheerio to the sandbox for HTML parsing
                fetch: require('node-fetch') // Add fetch for HTTP requests
            }
        });

        const result = vm.run(script);
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
