import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const { SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;

// 1. Get Access Token (Client Credentials Grant - 2026 Standard)
export async function getAccessToken() {
  // 1. Ensure the shop URL is clean (no https://)
  const cleanShop = process.env.SHOPIFY_SHOP.replace("https://", "").replace(
    "/",
    "",
  );
  const url = `https://${cleanShop}/admin/oauth/access_token`;

  // 2. Use URLSearchParams for application/x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append("client_id", process.env.SHOPIFY_CLIENT_ID);
  params.append("client_secret", process.env.SHOPIFY_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");
  params.append("scopes", process.env.SHOPIFY_SCOPES || "");
  try {
    const response = await axios.post(url, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data.access_token;
  } catch (error) {
    if (error.response) {
      // This will tell you EXACTLY why Shopify said no (e.g., "invalid_client" or "shop_not_permitted")
      console.error("Shopify OAuth Error Details:", error.response.data);
      throw new Error(
        `Shopify Auth Failed: ${error.response.data.error_description || error.response.data.error}`,
      );
    }
    throw error;
  }
}

// 2. Generic GraphQL Requester
export async function shopifyQuery(query, variables = {}) {
  const token = await getAccessToken();
  const url = `https://${SHOPIFY_SHOP}/admin/api/2026-01/graphql.json`;

  const response = await axios({
    url,
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    // Axios handles object-to-JSON conversion automatically
    data: { query, variables },
  });

  // Return the full body so the service can check for BOTH .data and .errors
  return response.data;
}
