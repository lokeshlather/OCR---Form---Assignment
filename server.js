// server.js (OCR.Space API backend - Base64 version)

require("dotenv").config();
console.log("Loaded API Key:", process.env.OCR_API_KEY ? "✅ Present" : "❌ Missing");

const express = require("express");
const multer = require("multer");

const fs = require("fs");
const cors = require("cors");
const FormData = require("form-data");

// node-fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const port = 5000;

app.use(cors());

// Configure file upload
const upload = multer({ dest: "uploads/" });

// OCR endpoint
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const apiKey = process.env.OCR_API_KEY; 

    // Read uploaded file as base64
    const base64Image = fs.readFileSync(req.file.path, { encoding: "base64" });

    const formData = new FormData();
    formData.append("apikey", apiKey);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "true");
    formData.append("OCREngine", "2");

    // send base64 instead of file stream
    formData.append("base64Image", `data:image/jpeg;base64,${base64Image}`);

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    const data = await response.json();
    console.log("OCR API response:", JSON.stringify(data, null, 2));

    const text =
      data.ParsedResults && data.ParsedResults[0]
        ? data.ParsedResults[0].ParsedText
        : "";

    res.json({ text });

  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ error: "OCR failed" });
  } finally {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});