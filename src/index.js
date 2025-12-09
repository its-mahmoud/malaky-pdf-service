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

const app = express();
app.use(bodyParser.json());
app.use(cors());

/* ===========================
   🔵 Manual API: /generate
=========================== */
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;

    if (!order || !order.id) {
      return res.status(400).json({ error: "Order data invalid" });
    }

    // 🔎 Prevent duplicate
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("invoice_url")
      .eq("id", order.id)
      .single();

    if (existingOrder?.invoice_url) {
      return res.json({
        message: "Invoice already exists, skipped.",
        pdf_url: existingOrder.invoice_url,
      });
    }

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `/tmp/${fileName}`;

    // 🖨️ Generate PDF
    await createInvoicePDF(order, filePath);

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

    // 🔗 Get public URL
    const { data: publicURL } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // 💾 Update order with invoice_url
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

    // 🚫 Ignore if not completed
    if (record.status !== "completed") {
      return res.json({ message: "Ignored (Order not completed)" });
    }

    // 🚫 Prevent duplicate
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("invoice_url")
      .eq("id", orderId)
      .single();

    if (existingOrder?.invoice_url) {
      return res.json({ message: "Invoice already exists, skipped." });
    }

    // 📌 Get order details
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    // 📌 Get order items
    const { data: items } = await supabase
      .from("order_items")
      .select(`quantity, unit_price, menu_items(name)`)
      .eq("order_id", orderId);

    // Format data for PDF
    const formatted = {
      id: order.id,
      customer: order.guest_customer_name ?? "زبون التطبيق",
      date: order.created_at,
      phone: order.guest_phone ?? "-",
      address: order.user_address_id ? order.user_address_id.toString() : "-",
      items: items.map(i => ({
        name: i.menu_items?.name ?? "صنف بدون اسم",
        qty: i.quantity,
        price: Number(i.unit_price),
      })),
    };

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `/tmp/${fileName}`;

    // 🖨️ Generate PDF
    await createInvoicePDF(formatted, filePath);

    // 📥 Read file
    const fileData = fs.readFileSync(filePath);

    // 📤 Upload to Supabase
    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    // 🔗 Public URL
    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // 💾 Update order
    await supabase
      .from("orders")
      .update({ invoice_url: urlData.publicUrl })
      .eq("id", order.id);

    res.json({
      message: "Invoice created automatically 🚀",
      pdf_url: urlData.publicUrl,
      order_id: order.id,
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
