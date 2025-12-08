import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { createInvoicePDF } from "./pdf.js";
import cors from "cors";
import fs from "fs";
import path from "path";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
// 🟦 Supabase Client باستخدام Service Key
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(bodyParser.json());
app.use(cors());

/* ===========================
   🔵 API اختباري يدوي 
   /generate
=========================== */
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.id)
      return res.status(400).json({ error: "Order data invalid" });

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = path.resolve(`./invoices/${fileName}`);

    await createInvoicePDF(order, filePath);

    const fileData = fs.readFileSync(filePath);

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

    await supabase.from("orders")
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
   📌 Webhook تلقائي من Supabase
   /webhook
=========================== */
app.post("/webhook", async (req, res) => {
  // 🚫 امنع إنشاء فاتورة ثانية لنفس الطلب
if (record.invoice_url !== null && record.invoice_url !== "") {
  return res.json({ message: "Invoice already exists, skipped." });
}

  try {
    const { record } = req.body; // Supabase sends { record: {...} }
    const orderId = record.id;

    // فقط إذا كانت الحالة completed
    if (record.status !== "completed") {
      return res.json({ message: "Ignored (Order not completed)" });
    }

    // 🟦 1) جلب بيانات الطلب
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    // 🟨 2) جلب عناصر الطلب
    const { data: items } = await supabase
  .from("order_items")
  .select(`
    quantity,
    unit_price,
    menu_items (name)
  `)
  .eq("order_id", orderId);

    // 🧾 3) تجهيز صيغة PDF
    const formatted = {
  id: order.id,
  customer: order.guest_customer_name ?? "زبون التطبيق",
  date: order.created_at,
  items: items.map(i => ({
    name: i.menu_items?.name ?? "صنف بدون اسم",
    qty: i.quantity,
    price: Number(i.unit_price)
  }))
};

    // 🖨️ 4) إنشاء PDF
    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `./invoices/${fileName}`;
    await createInvoicePDF(formatted, filePath);

    // 📤 5) رفع PDF
    const fileData = fs.readFileSync(filePath);
    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    // 🔗 6) استخراج الرابط
    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // 💾 7) تحديث الطلب
    await supabase.from("orders")
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


// 🚀 تشغيل السيرفر
app.listen(5000, "0.0.0.0", () => {
  console.log("Malaky PDF Service Running on port 5000 📄🔥");
});
