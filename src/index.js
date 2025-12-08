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

// 🟦 Supabase Client باستخدام Service Key
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(bodyParser.json());
app.use(cors());

/* ===========================
   🔵 API يدوي /generate
=========================== */
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.id) {
      return res.status(400).json({ error: "Order data invalid" });
    }

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `/tmp/${fileName}`;

    // 🖨️ إنشاء PDF
    await createInvoicePDF(order, filePath);

    // 📥 قراءة الملف المؤقت
    const fileData = fs.readFileSync(filePath);

    // 📤 رفع إلى Supabase
    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) throw upload.error;

    // 🔗 استخراج الرابط
    const { data: publicURL } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // 💾 تحديث الطلب
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
   📌 Webhook تلقائي /webhook
=========================== */
app.post("/webhook", async (req, res) => {
  try {
    const { record } = req.body;
    const orderId = record.id;

    // 🚫 منع التكرار
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("invoice_url")
      .eq("id", orderId)
      .single();

    if (existingOrder?.invoice_url) {
      return res.json({ message: "Invoice already exists, skipped." });
    }

    // فقط إذا كانت completed
    if (record.status !== "completed") {
      return res.json({ message: "Ignored (Order not completed)" });
    }

    // جلب كامل بيانات الطلب
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    // جلب عناصر الطلب
    const { data: items } = await supabase
      .from("order_items")
      .select(`quantity, unit_price, menu_items(name)`)
      .eq("order_id", orderId);

    // تجهيز صيغة PDF
    const formatted = {
      id: order.id,
      customer: order.guest_customer_name ?? "زبون التطبيق",
      date: order.created_at,
      items: items.map(i => ({
        name: i.menu_items?.name ?? "صنف بدون اسم",
        qty: i.quantity,
        price: Number(i.unit_price),
      })),
    };

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = `/tmp/${fileName}`;

    // إنشاء PDF
    await createInvoicePDF(formatted, filePath);

    // رفع
    const fileData = fs.readFileSync(filePath);
    const upload = await supabase.storage
      .from("invoices")
      .upload(fileName, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upload.error) throw upload.error;

    // رابط عام
    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // تحديث الطلب
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

// 🚀 تشغيل السيرفر
app.listen(5000, "0.0.0.0", () => {
  console.log("Malaky PDF Service Running on port 5000 📄🔥");
});