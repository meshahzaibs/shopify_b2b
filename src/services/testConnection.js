import { shopifyQuery } from "./shopify.js";

export const TestConnection = {
  async testDraftToOrder() {
    // GraphQL query to get all variants
    const GET_ALL_VARIANTS = `#graphql
      query GetAllVariants($first: Int = 250, $after: String) {
        productVariants(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              sku
              title
              product {
                id
                title
              }
              lbhsku: metafield(namespace: "custom", key: "lbhsku") {
                value
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    // Function to fetch all variants using pagination
    async function getAllVariants(shopifyQuery) {
      const first = 250; // max per request
      let after = null;
      let allVariants = [];

      do {
        const variables = { first, after };
        const response = await shopifyQuery(GET_ALL_VARIANTS, variables);

        const edges = response.data.productVariants.edges ?? [];
        allVariants = allVariants.concat(edges.map((e) => e.node));

        const lastEdge = edges[edges.length - 1];
        after =
          response.data.productVariants.pageInfo.hasNextPage && lastEdge
            ? lastEdge.cursor
            : null;
      } while (after);

      return allVariants;
    }

    // Usage example:
    const variants = await getAllVariants(shopifyQuery);
    console.log("Total variants fetched:", variants.length);

    const targetSku = "sku01";
    // Filter variants where lbhsku contains the target SKU
    const matchedVariants = variants.filter((variant) => {
      if (!variant.lbhsku || !variant.lbhsku.value) return false;
      const skuArray = JSON.parse(variant.lbhsku.value); // convert JSON string to array
      return skuArray.includes(targetSku);
    });

    console.log("matchedVariants ->", matchedVariants);

    // Ensure at least one matched variant
    if (!matchedVariants.length) {
      console.error("❌ No variant found matching the target SKU:", targetSku);
      return;
    }

    console.log(`variantIds`, matchedVariants[0].id);

    // return ("test", matchedVariants[0].id);

    // create a customer

    const customerInput = {
      email: "testcustomer3@mshahzaib.com",
      firstName: "John3",
      lastName: "Doe",
      phone: "+923000000008",
    };

    const FIND_CUSTOMER = `
      query getCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
            }
          }
        }
      }
    `;

    const findRes = await shopifyQuery(FIND_CUSTOMER, {
      query: `email:${customerInput.email}`,
    });

    let customerId = null;

    if (findRes.data.customers.edges.length > 0) {
      customerId = findRes.data.customers.edges[0].node.id;
      console.log("Existing customer found:", customerId);
    } else {
      const CREATE_CUSTOMER = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
              firstName
              lastName
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const customerVariables = {
        input: {
          email: customerInput.email,
          firstName: customerInput.firstName,
          lastName: customerInput.lastName,
          phone: customerInput.phone,
          emailMarketingConsent: {
            marketingState: "NOT_SUBSCRIBED",
            marketingOptInLevel: "SINGLE_OPT_IN",
          },
        },
      };
      const customerRes = await shopifyQuery(
        CREATE_CUSTOMER,
        customerVariables,
      );
      const customerData = customerRes?.data?.customerCreate;

      if (customerData.userErrors.length) {
        console.error("❌ Customer create error:", customerData.userErrors);
        return;
      }

      customerId = customerData.customer.id;
      console.log("👤 Customer created:", customerId);
    }

    // 1️ CREATE DRAFT ORDER
    const createDraftMutation = `mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            metafields(first: 10) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                  quantity
                  priceOverride {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const draftVariables = {
      input: {
        customerId: customerId,
        metafields: [
          {
            namespace: "custom",
            key: "ponumber",
            type: "single_line_text_field",
            value: "PO-10556901",
          },
          {
            namespace: "custom",
            key: "orderno",
            type: "single_line_text_field",
            value: "PO-dfwddd",
          },
          {
            namespace: "custom",
            key: "lbhsku",
            type: "single_line_text_field",
            value: "PO-dddwddd",
          },
          {
            namespace: "custom",
            key: "Kitco_rate",
            type: "single_line_text_field",
            value: "PO-ddd342d",
          },
          {
            namespace: "custom",
            key: "kitco_gold",
            type: "single_line_text_field",
            value: "PO-ddedd",
          },
          {
            namespace: "custom",
            key: "ordercomments",
            type: "multi_line_text_field",
            value: "PO-ddsssdd",
          },
          {
            namespace: "custom",
            key: "customization",
            type: "multi_line_text_field",
            value: "dwdw wdwd",
          },
        ],
        lineItems: [
          {
            variantId: matchedVariants[0].id,
            quantity: 1,
            // requiresShipping: true,
            priceOverride: {
              amount: "50.00",
              currencyCode: "USD",
            },
          },
        ],
        note: "API test draft order",
      },
    };

    const draftRes = await shopifyQuery(createDraftMutation, draftVariables);
    const draftData = draftRes?.data?.draftOrderCreate;

    if (!draftData || draftData.userErrors.length > 0) {
      console.error("❌ Draft error:", draftData?.userErrors);
      return;
    }

    const draftId = draftData.draftOrder.id;
    console.log("📝 Draft created:", draftData.draftOrder.name, draftId);

    // 2 COMPLETE DRAFT ORDER
    const completeMutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder { id }
          userErrors { field message }
        }
      }
    `;
    const completeRes = await shopifyQuery(completeMutation, { id: draftId });
    const completeData = completeRes?.data?.draftOrderComplete;

    if (!completeData || completeData.userErrors.length > 0) {
      console.error("❌ Complete error:", completeData?.userErrors);
      return;
    }
    console.log("✅ Draft completed! Draft ID:", completeData.draftOrder.id);

    // 3 FETCH REAL ORDER ID
    const orderQuery = `
      query draftOrderQuery($id: ID!) {
        draftOrder(id: $id) {
          order { id name }
          metafields(first: 10) {
            edges { node { namespace key value type } }
          }
        }
      }
    `;
    const orderRes = await shopifyQuery(orderQuery, { id: draftId });
    const draftOrder = orderRes?.data?.draftOrder;
    const realOrder = draftOrder?.order;

    if (!realOrder) {
      console.error("❌ Real order not found after draft completion.");
      return;
    }

    console.log("🎉 Real Order created:", realOrder.name, realOrder.id);

    // 4️ COPY DRAFT METAFIELDS TO REAL ORDER
    if (draftOrder.metafields?.edges?.length > 0) {
      const metafieldNodes = draftOrder.metafields.edges.map((e) => e.node);
      const metafieldsInput = metafieldNodes.map((mf) => ({
        ownerId: realOrder.id,
        namespace: mf.namespace,
        key: mf.key,
        type: mf.type,
        value: mf.value,
      }));

      const setMetafieldsMutation = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id namespace key value }
            userErrors { field message }
          }
        }
      `;

      const metafieldRes = await shopifyQuery(setMetafieldsMutation, {
        metafields: metafieldsInput,
      });

      if (metafieldRes.data.metafieldsSet.userErrors.length > 0) {
        console.error(
          "❌ Error setting metafields on real order:",
          metafieldRes.data.metafieldsSet.userErrors,
        );
      } else {
        console.log("✅ Metafields copied to real order!");
      }
    }
  },
};
