import { shopifyQuery } from "./shopify.js";

export const OrderService = {
  // Fetch latest orders with details
  async getRecentOrders() {
    const query = `
      query getOrders($first: Int) {
        orders(first: $first, reverse: true) {
          edges {
            node {
              id
              name
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              lineItems(first: 5) {
                edges { node { title quantity } }
              }
            }
          }
        }
      }
    `;
    return await shopifyQuery(query, { first: 10 });
  },
};
