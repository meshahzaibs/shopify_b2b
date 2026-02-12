import { shopifyQuery } from "./shopify.js"; // your existing helpers

export async function importOrders(rows) {
  // const results = [];

  // for (const row of rows) {
  //   try {
  //     // Skip rows without SKU
  //     if (!row.lbhsku) {
  //       results.push({ sku: null, status: "Skipped", reason: "No SKU" });
  //       continue;
  //     }

  //     // Get Shopify variant ID from SKU
  //     const variantId = await getVariantGidBySku(row.lbhsku);

  //     if (!variantId) {
  //       results.push({
  //         sku: row.lbhsku,
  //         status: "Failed",
  //         reason: "Variant not found",
  //       });
  //       continue;
  //     }

  //     // Prepare Shopify order input
  //     const mutation = `mutation orderCreate($input: OrderCreateInput!) {
  //       orderCreate(input: $input) {
  //         order { name }
  //         userErrors { message }
  //       }
  //     }`;

  //     const variables = {
  //       input: {
  //         email: `${row.st_fname}.${row.st_lname}@test.com`.toLowerCase(),
  //         lineItems: [
  //           { variantId, quantity: parseInt(row.qty, 10), price: row.price },
  //         ],
  //         shippingAddress: {
  //           firstName: row.st_fname,
  //           lastName: row.st_lname,
  //           address1: row.st_street,
  //           address2: row.st_addr2 || "",
  //           city: row.st_city,
  //           province: row.st_state,
  //           zip: row.st_zip,
  //           country: "United States",
  //         },
  //         note: row.ordercomments || "",
  //       },
  //     };

  //     const response = await shopifyQuery(mutation, variables);

  //     if (response.data.orderCreate.userErrors.length > 0) {
  //       results.push({
  //         sku: row.lbhsku,
  //         status: "Error",
  //         error: response.data.orderCreate.userErrors
  //           .map((e) => e.message)
  //           .join(", "),
  //       });
  //     } else {
  //       results.push({
  //         sku: row.lbhsku,
  //         status: "Success",
  //         orderName: response.data.orderCreate.order.name,
  //       });
  //     }
  //   } catch (err) {
  //     results.push({ sku: row.lbhsku, status: "Failed", error: err.message });
  //   }
  // }

  return rows; // return once all rows processed
}
