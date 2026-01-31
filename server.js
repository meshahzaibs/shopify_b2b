import express from "express";
import multer from "multer";
import axios from "axios";
import csv from "csv-parser";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { TestConnection } from "./src/services/testConnection.js";

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

// --- CORE LOGIC: SKU TO VARIANT ID ---
async function getVariantGidBySku(sku) {
  const query = `query($q: String!) { productVariants(first: 1, query: $q) { edges { node { id } } } }`;
  const res = await shopifyQuery(query, { q: `sku:${sku}` });
  return res.data.productVariants.edges[0]?.node.id;
}

// --- API ENDPOINT: CSV IMPORT ---
app.post("/api/import", upload.single("file"), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", async (row) => {
      [cite_start]; // Mapping your CSV [cite: 1, 2]
      if (!row.lbhsku) return;

      try {
        const variantId = await getVariantGidBySku(row.lbhsku);
        const mutation = `mutation orderCreate($input: OrderCreateInput!) {
                    orderCreate(input: $input) {
                        order { name }
                        userErrors { message }
                    }
                }`;

        const variables = {
          input: {
            email: `${row.st_fname}.${row.st_lname}@test.com`.toLowerCase(),
            lineItems: [
              { variantId, quantity: parseInt(row.qty), price: row.price },
            ],
            shippingAddress: {
              firstName: row.st_fname,
              lastName: row.st_lname,
              address1: row.st_street,
              city: row.st_city,
              province: row.st_state,
              zip: row.st_zip,
              country: "United States",
            },
          },
        };

        const response = await shopifyQuery(mutation, variables);
        results.push({
          sku: row.lbhsku,
          status: response.data.orderCreate.order ? "Success" : "Error",
        });
      } catch (err) {
        results.push({ sku: row.lbhsku, status: "Failed", error: err.message });
      }
    })
    .on("end", () => {
      res.json({ message: "Import Processed", results });
    });
});

app.listen(process.env.PORT, () =>
  console.log(`Test Lab running at http://localhost:${process.env.PORT}`),
);

app.get("/api/testconnection", async (req, res) => {
  const result = await TestConnection.createSampleOrder();

  res.json("result");
});
