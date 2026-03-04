import fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { shopifyQuery } from "./shopify.js";

/* ------------------------------------------
   STEP 1: Get Shopify Order ID from Name
-------------------------------------------*/
async function fetchOrderIdByName(orderName) {
  const query = `
    query ($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const res = await shopifyQuery(query, {
    query: `name:${orderName.replace("#", "")}`,
  });

  return res.data.orders.edges[0]?.node.id || null;
}

/* ------------------------------------------
   STEP 2: Fetch Your Specific Metafields
-------------------------------------------*/
async function fetchOrderMetafields(orderId) {
  const query = `
   query GetOrderMetafieldsById($orderId: ID!) {
      order(id: $orderId) {
         id
         name

         ponumber: metafield(namespace: "custom", key: "ponumber") { jsonValue }
         orderno: metafield(namespace: "custom", key: "orderno") { jsonValue }
         vendorsku: metafield(namespace: "custom", key: "vendorsku") { jsonValue }
         lbhsku: metafield(namespace: "custom", key: "lbhsku") { jsonValue }
         kitco_rate: metafield(namespace: "custom", key: "kitco_rate") { jsonValue }
         kitco_gold: metafield(namespace: "custom", key: "kitco_gold") { jsonValue }
         ordercomments: metafield(namespace: "custom", key: "ordercomments") { jsonValue }
         customization: metafield(namespace: "custom", key: "customization") { jsonValue }

      }
   }
`;

  const res = await shopifyQuery(query, { orderId });
  const order = res.data.order;

  if (!order) return {};

  const keys = [
    "ponumber",
    "orderno",
    "vendorsku",
    "lbhsku",
    "kitco_rate",
    "kitco_gold",
    "ordercomments",
    "customization",
  ];

  const metafields = {};

  keys.forEach((key) => {
    metafields[key] = order[key]?.jsonValue ?? "";
  });

  return metafields;
}

/* ------------------------------------------
   STEP 3: Main Merge Function
-------------------------------------------*/
export async function processShopifyExport(inputPath, outputPath) {
  const rows = [];

  // Read CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`🚀 Loaded ${rows.length} rows`);

  // Process each row
  for (let row of rows) {
    if (!row.Name) continue;

    try {
      console.log(`Processing ${row.Name}`);

      // 1️⃣ Get real Shopify ID
      const orderId = await fetchOrderIdByName(row.Name);

      if (!orderId) {
        console.warn(`❌ Order not found: ${row.Name}`);
        continue;
      }

      // 2️⃣ Get metafields
      const metafields = await fetchOrderMetafields(orderId);

      // 3️⃣ Merge into original row
      Object.assign(row, metafields);

      console.log(`✅ Merged metafields for ${row.Name}`);
    } catch (err) {
      console.error(`❌ Error processing ${row.Name}:`, err.message);
    }
  }

  /* ------------------------------------------
     STEP 4: Write Merged CSV
  -------------------------------------------*/
  const headers = Object.keys(rows[0] || {}).map((key) => ({
    id: key,
    title: key,
  }));

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: headers,
  });

  await csvWriter.writeRecords(rows);

  console.log(`🎉 Merged CSV saved to ${outputPath}`);
}
