import express from "express";
import multer from "multer";
import axios from "axios";
import csv from "csv-parser";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { TestConnection } from "./services/testConnection.js";

import { importOrders } from "./services/orderService.js";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static("public"));

// --- 2026 API AUTHENTICATION ---
async function getAccessToken() {
  const url = `https://${process.env.SHOPIFY_SHOP}/admin/oauth/access_token`;
  const res = await axios.post(url, {
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  return res.data.access_token;
}

async function shopifyQuery(query, variables = {}) {
  const token = await getAccessToken();
  const res = await axios({
    url: `https://${process.env.SHOPIFY_SHOP}/admin/api/2026-01/graphql.json`,
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    data: { query, variables },
  });
  return res.data;
}

// --- API ENDPOINT: CSV IMPORT ---
app.post("/api/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const rows = [];

    fs.createReadStream(req.file.path)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header
              .normalize("NFKC") // fix Excel unicode junk
              .replace(/[\u200B-\u200D\uFEFF]/g, "")
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_"), // spaces → _
        }),
      )
      .on("data", (row) => {
        rows.push(row); // collect all rows
      })
      .on("end", async () => {
        try {
          // Send all rows to importOrders service
          const results = await importOrders(rows);

          // Delete uploaded file after processing
          fs.unlinkSync(req.file.path);

          // Respond with all processed results
          res.json({ message: "CSV processed successfully", results });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error importing orders", error: err.message });
        }
      })
      .on("error", (err) => {
        res.status(500).json({ message: "CSV Read Error", error: err.message });
      });
  } catch (err) {
    res.status(500).json({ message: "Unexpected error", error: err.message });
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Test Lab running at http://localhost:${process.env.PORT}`),
);

app.get("/api/testconnection", async (req, res) => {
  const result = await TestConnection.testDraftToOrder();

  res.json(result);
});
