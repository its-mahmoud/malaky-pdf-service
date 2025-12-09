import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { createInvoicePDF } from "./pdf.js";
import cors from "cors";
import fs from "fs";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// 🟦 Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const localMode = process.env.NODE_ENV !== "production";

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use("/invoices", express.static("./invoices"));


/* ===========================
   🔵 Manual API: /generate
=========================== */
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;

    if (!order || !order.id) {
      return res.status(400).json({ error: "Order data invalid" });
    }

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `./invoices/${fileName}`;

    // 🖨️ Generate PDF locally
    await createInvoicePDF(order, filePath);

    // 🔵 Development Mode → Save locally ONLY
    if (localMode) {
      return res.json({
        message: "Invoice generated locally (DEV MODE)",
        pdf_path: filePath,
        order_id: order.id,
      });
    }

    // 📥 Read file
    const fileData = fs.readFileSync(filePath);

    // 📤 Upload to Supabase Storage
    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    const { data: publicURL } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    await supabase
      .from("orders")
      .update({ invoice_url: publicURL.publicUrl })
      .eq("id", order.id);

    res.json({
      message: "Invoice created & uploaded successfully! 🚀",
      pdf_url: publicURL.publicUrl,
      order_id: order.id,
    });

  } catch (err) {
    console.error("❌ Manual PDF Error:", err);
    res.status(500).json({ error: "Failed to create PDF" });
  }
});



/* ===========================
   📌 Webhook: /webhook
=========================== */
app.post("/webhook", async (req, res) => {
  try {
    const { record } = req.body;
    const orderId = record.id;

    if (record.status !== "completed") {
      return res.json({ message: "Ignored (Order not completed)" });
    }

    const fileName = `invoice-${orderId}.pdf`;
    const filePath = `./invoices/${fileName}`;

    // 🖨️ Generate temporary data
    const formatted = {
      id: record.id,
      customer: record.guest_customer_name ?? "زبون التطبيق",
      date: record.created_at,
      phone: record.guest_phone ?? "-",
      address: record.user_address_id ? record.user_address_id.toString() : "-",
      items: [], // You can fetch items if needed in dev mode
    };

    // 🖨️ Generate PDF locally
    await createInvoicePDF(formatted, filePath);

    // 🔵 Development Mode → Save locally ONLY
    if (localMode) {
      return res.json({
        message: "Invoice generated locally (DEV MODE)",
        pdf_path: filePath,
        order_id: orderId,
      });
    }

    // --- Production Mode ----

    const fileData = fs.readFileSync(filePath);

    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    await supabase
      .from("orders")
      .update({ invoice_url: urlData.publicUrl })
      .eq("id", orderId);

    res.json({
      message: "Invoice created automatically 🚀",
      pdf_url: urlData.publicUrl,
      order_id: orderId,
    });

  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});


// 🚀 Server Listen
app.listen(5000, "0.0.0.0", () => {
  console.log("Malaky PDF Service Running on port 5000 📄🔥");
});
