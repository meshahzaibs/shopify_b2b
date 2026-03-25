import { shopifyQuery } from "./shopify.js";
import { buildAddress } from "../helpers/addressHelper.js";

export async function importOrders(rows) {
  console.log("🚀 Starting order import for", rows.length, "rows");
  const results = [];

  // ---------------- FETCH ALL VARIANTS ----------------
  const GET_ALL_VARIANTS = `#graphql
    query GetAllVariants($first: Int = 250, $after: String) {
      productVariants(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            lbhsku: metafield(namespace: "custom", key: "lbhsku") {
              value
            }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  async function fetchAllVariants() {
    let after = null;
    const variants = [];

    do {
      const res = await shopifyQuery(GET_ALL_VARIANTS, { first: 250, after });
      const edges = res.data.productVariants.edges ?? [];
      variants.push(...edges.map((e) => e.node));
      after = res.data.productVariants.pageInfo.hasNextPage
        ? edges.at(-1)?.cursor
        : null;
    } while (after);

    return variants;
  }

  const variants = await fetchAllVariants();
  console.log("✅ Variants loaded:", variants.length);

  // ---------------- PROCESS EACH ROW ----------------
  for (const row of rows) {
    try {
      console.log(`\n🚀 Processing order: ${row.orderno}`);

      // -------- MATCH VARIANT --------
      const matchedVariant = variants.find((v) => {
        if (!v.lbhsku?.value) return false;
        return JSON.parse(v.lbhsku.value).includes(row.lbhsku);
      });

      if (!matchedVariant) {
        console.error(`❌ Variant not found for LBHSKU: ${row.lbhsku}`);
        results.push({
          orderno: row.orderno,
          status: "FAILED",
          reason: "Variant not found",
        });
        continue;
      }

      // -------- BUILD ADDRESSES --------
      const customerEmail =
        `${row.st_fname}.${row.st_lname}.${row.st_custno}@meshahzaibs.com`.toLowerCase();

      const billingAddress = buildAddress({
        fname: row.bt_fname,
        lname: row.bt_lname,
        company: row.bt_company,
        street: row.bt_street,
        addr2: row.bt_addr2,
        addr3: row.bt_addr3,
        city: row.bt_city,
        state: row.bt_state,
        zip: row.bt_zip,
      });

      const shippingAddress = buildAddress({
        fname: row.st_fname,
        lname: row.st_lname,
        company: row.st_company,
        street: row.st_street,
        addr2: row.st_addr2,
        addr3: row.st_addr3,
        city: row.st_city,
        state: row.st_state,
        zip: row.st_zip,
      });

      // -------- FIND OR CREATE CUSTOMER --------
      const findRes = await shopifyQuery(
        `
        query ($q: String!) {
          customers(first: 1, query: $q) {
            edges { node { id } }
          }
        }
        `,
        { q: `email:${customerEmail}` },
      );

      let customerId = findRes.data.customers.edges[0]?.node.id;

      if (!customerId) {
        const createRes = await shopifyQuery(
          `#graphql
          mutation ($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer { id }
              userErrors { message }
            }
          }
          `,
          {
            input: {
              email: customerEmail,
              firstName: row.st_fname,
              lastName: row.st_lname,
              addresses: [shippingAddress, billingAddress],
            },
          },
        );
        customerId = createRes.data.customerCreate.customer.id;
      }

      // console.log(Object.keys(row));

      // console.log("row", row, row.ponumber, row.orderno);
      // return;

      // -------- CREATE DRAFT ORDER --------
      // Define which metafields you want to include
      const metafieldKeys = [
        { key: "ponumber", type: "single_line_text_field" },
        { key: "orderno", type: "single_line_text_field" },
        { key: "vendorsku", type: "single_line_text_field" },
        { key: "lbhsku", type: "single_line_text_field" },
        { key: "kitco_rate", type: "single_line_text_field" },
        { key: "kitco_gold", type: "single_line_text_field" },
        { key: "ordercomments", type: "multi_line_text_field" },
        { key: "customization", type: "multi_line_text_field" },
      ];

      // Build metafields array, skipping empty or undefined values
      const metafields = metafieldKeys
        .map(({ key, type }) => {
          const value = row[key];
          if (value !== undefined && value !== null && value !== "") {
            return {
              namespace: "custom",
              key,
              type,
              value,
            };
          }
          return null; // skip empty
        })
        .filter(Boolean); // remove nulls

      const parsedTags = row.tags
        ? row.tags
            .split(",") // split by comma
            .map((tag) => tag.trim()) // remove spaces
            .filter((tag) => tag) // remove empty values
        : [];

      const draftOrderMutation = `#graphql
          mutation ($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder { id }
              userErrors { message }
            }
          }
        `;

      const draftInput = {
        input: {
          customerId,
          shippingAddress,
          billingAddress,
          lineItems: [
            {
              variantId: matchedVariant.id,
              quantity: Number(row.qty),
              priceOverride: { amount: row.price, currencyCode: "USD" },
            },
          ],
          metafields,
          tags: [...parsedTags, "imported"],
        },
      };

      // Create draft order with filtered metafields
      const draftRes = await shopifyQuery(draftOrderMutation, draftInput);

      const draftId = draftRes.data.draftOrderCreate.draftOrder.id;

      // -------- COMPLETE DRAFT ORDER --------
      const completeRes = await shopifyQuery(
        `#graphql
        mutation ($id: ID!) {
          draftOrderComplete(id: $id, paymentPending: true) {
            draftOrder { id }
            userErrors { field message }
          }
        }
        `,
        { id: draftId },
      );

      if (completeRes.data.draftOrderComplete.userErrors.length > 0) {
        console.error(
          "❌ Draft completion errors:",
          completeRes.data.draftOrderComplete.userErrors,
        );
      }
      console.log("✅ Draft completed! Draft ID:", draftId);

      // -------- FETCH REAL ORDER --------
      const orderRes = await shopifyQuery(
        `#graphql
        query ($id: ID!) {
          draftOrder(id: $id) {
            order { id name }
            metafields(first: 50) { edges { node { namespace key value type } } }
          }
        }
        `,
        { id: draftId },
      );

      const draftOrder = orderRes.data.draftOrder;
      const realOrder = draftOrder?.order;

      console.log(
        "📦 Draft metafields:",
        draftOrder.metafields?.edges?.map((e) => ({
          key: e.node.key,
          value: e.node.value,
        })),
      );

      if (!realOrder) {
        console.error("❌ Real order not found after draft completion.");
        results.push({
          orderno: row.orderno,
          status: "FAILED",
          reason: "Real order not found",
        });
        continue;
      }

      console.log("🎉 Real Order created:", realOrder.name, realOrder.id);

      // -------- COPY METAFIELDS --------
      if (draftOrder.metafields?.edges?.length > 0) {
        // Define the metafields you want to set
        const metafieldsTemplate = [
          { key: "ponumber", type: "single_line_text_field" },
          { key: "orderno", type: "single_line_text_field" },
          { key: "vendorsku", type: "single_line_text_field" },
          { key: "lbhsku", type: "single_line_text_field" },
          { key: "kitco_rate", type: "single_line_text_field" },
          { key: "kitco_gold", type: "single_line_text_field" },
          { key: "ordercomments", type: "multi_line_text_field" },
          { key: "customization", type: "multi_line_text_field" },
        ];

        // Build the actual metafields array, skipping empty/undefined values
        const metafields = metafieldsTemplate
          .map(({ key, type }) => {
            const value = row[key];
            if (value !== undefined && value !== null && value !== "") {
              return {
                ownerId: realOrder.id,
                namespace: "custom",
                key,
                type,
                value,
              };
            }
            return null; // skip if empty
          })
          .filter(Boolean); // remove nulls

        // Call Shopify mutation only with the filtered metafields
        const metafieldRes = await shopifyQuery(
          `#graphql
            mutation ($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key }
                userErrors { field message }
              }
            }
          `,
          { metafields },
        );

        if (metafieldRes.data.metafieldsSet.userErrors.length > 0) {
          console.error(
            "❌ Metafield errors:",
            metafieldRes.data.metafieldsSet.userErrors,
          );
        } else {
          console.log("✅ Metafields saved on real order");
        }
      }

      results.push({ orderno: row.orderno, status: "SUCCESS", draftId });
    } catch (err) {
      console.error(`❌ Order ${row.orderno} failed:`, err.message);
      results.push({
        orderno: row.orderno,
        status: "FAILED",
        error: err.message,
      });
    }
  }

  console.log("✅ All orders processed");
  return results;
}
