import { shopifyQuery } from "./shopify.js";

export const TestConnection = {
  async createSampleOrder() {
    // 1. Correct Mutation for Real Orders
    const mutation = `
      mutation orderCreate($order: OrderCreateOrderInput!) {
        orderCreate(order: $order) {
          order {
            id
            name
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // 2. Variables correctly formatted with Strings for prices
    const variables = {
      // order: {
      //   // 1. Set top-level order currency to USD
      //   currency: "USD",
      //   financialStatus: "PENDING",
      //   metafields: [
      //     {
      //       namespace: "custom",
      //       key: "ponumber",
      //       type: "single_line_text_field",
      //       value: "PO-10556901",
      //     },
      //   ],
      //   lineItems: [
      //     {
      //       // Real Product
      //       variantId: "gid://shopify/ProductVariant/44803689971862",
      //       quantity: 1,
      //       requiresShipping: true,
      //       // priceSet: {
      //       //   shopMoney: {
      //       //     amount: "70",
      //       //     currencyCode: "USD", // 2. Match line item currency
      //       //   },
      //       // },
      //     },
      //     // {
      //     //   // Custom Line Item
      //     //   title: "Custom Test Item",
      //     //   quantity: 1,
      //     //   requiresShipping: true,
      //     //   priceSet: {
      //     //     shopMoney: {
      //     //       amount: "10.00",
      //     //       currencyCode: "USD", // 3. Match custom item currency
      //     //     },
      //     //   },
      //     // },
      //   ],
      //   // transactions: [
      //   //   {
      //   //     kind: "SALE",
      //   //     status: "SUCCESS",
      //   //     amountSet: {
      //   //       shopMoney: {
      //   //         amount: "70", // Total (74.99 + 10.00)
      //   //         currencyCode: "USD", // 4. Match transaction currency
      //   //       },
      //   //     },
      //   //   },
      //   // ],
      // },

      order: {
        currency: "USD",
        financialStatus: "PENDING",

        lineItems: [
          {
            variantId: "gid://shopify/ProductVariant/44803689971862",
            quantity: 1,
            requiresShipping: true,
            fulfillmentService: "manual",
          },
        ],
      },
    };

    try {
      console.log("📡 Attempting to create a REAL order via orderCreate...");

      const response = await shopifyQuery(mutation, variables);

      // Extract result safely based on your helper returning response.data.data
      const result = response.orderCreate || response.data?.orderCreate;

      if (!result) {
        console.error("❌ No data returned. Check shopifyQuery helper.");
        return { success: false };
      }

      if (result.userErrors && result.userErrors.length > 0) {
        console.error(
          "❌ Shopify User Errors:",
          JSON.stringify(result.userErrors, null, 2),
        );
        return { success: false, errors: result.userErrors };
      }

      console.log(`✅ Success! Real Order Created: ${result.order.name}`);
      return { success: true, order: result.order };
    } catch (error) {
      console.error("❌ API Execution Error:", error.message);
      return { success: false, message: error.message };
    }
  },
};
