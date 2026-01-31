import { shopifyQuery } from "./shopify.js";

export const TestConnection = {
  /**
   * Creates a simple test draft order to verify API connectivity and Scopes.
   * Can be triggered via a simple browser refresh on a GET route.
   */
  async createSampleOrder() {
    const mutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Hardcoded test data - no CSV needed for this connection test
    const variables = {
      input: {
        note: "API Connection Test - Jan 2026",
        lineItems: [
          {
            title: "Test Connection Product",
            originalUnitPrice: "1.00", // Required as String
            quantity: 1,
          },
        ],
        tags: ["api-test", "node-js-app"],
      },
    };

    try {
      console.log("📡 Sending test mutation to Shopify...");
      const response = await shopifyQuery(mutation, variables);

      console.log("📨 Response received from Shopify:", response);

      // --- CRITICAL ERROR HANDLING ---

      // 1. Check if the shopifyQuery itself failed/timed out
      if (!response) {
        throw new Error(
          "No response from shopifyQuery. Check shopify.js configuration.",
        );
      }

      // 2. Check for Top-Level GraphQL Errors (Auth, Throttling, Syntax)
      if (response.errors) {
        const authError = response.errors.find((e) =>
          e.message.includes("Access denied"),
        );
        const errorMessage = authError
          ? "❌ ACCESS DENIED: Check if your token has 'write_draft_orders' scope."
          : `❌ GraphQL Error: ${response.errors[0].message}`;

        console.error(errorMessage);
        return {
          success: false,
          message: errorMessage,
          details: response.errors,
        };
      }

      // 3. Extract the Mutation Result
      const result = response.data?.draftOrderCreate;

      if (!result) {
        throw new Error(
          "Malformed response: draftOrderCreate missing from data.",
        );
      }

      // 4. Check for User/Validation Errors (Bad data types)
      if (result.userErrors && result.userErrors.length > 0) {
        console.error("❌ Shopify Validation Errors:", result.userErrors);
        return {
          success: false,
          message: "Validation Failed",
          errors: result.userErrors,
        };
      }

      // 5. Success
      const orderName = result.draftOrder.name;
      console.log(`✅ Success! Created Test Order: ${orderName}`);

      return {
        success: true,
        message: `Order ${orderName} created successfully!`,
        orderId: result.draftOrder.id,
      };
    } catch (error) {
      const crashMsg = `❌ Connection Crash: ${error.message}`;
      console.error(crashMsg);
      return { success: false, message: crashMsg };
    }
  },
};
