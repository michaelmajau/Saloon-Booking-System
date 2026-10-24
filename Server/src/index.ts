import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./config/supabase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Salon Booking Backend is running!");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend connected successfully",
  });
});

app.get("/api/services", async (req, res) => {
  const { data, error } = await supabase
    .from("services")
    .select("service_id, service_name, price, duration_minutes");

  if (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }

  return res.json({
    success: true,
    services: data,
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});