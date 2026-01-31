import express from "express";
import { OrderService } from "./services/orderService.js";
import { TestConnection } from "./services/testConnection.js";

const app = express();
app.use(express.json());

// API Route to see orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await OrderService.getRecentOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook Route: Real-time order management
app.post("/api/webhooks/orders/create", (req, res) => {
  const order = req.body;
  console.log(`🚀 New Order Received: ${order.name}`);
  // Add your custom logic here (e.g., send SMS, update DB)
  res.status(200).send("OK");
});

app.get("/api/testconnection", async (req, res) => {
  const result = await TestConnection.createSampleOrder();

  res.json("result");
});

export default app;
