import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { createInvoicePDF } from "./pdf.js";
import cors from "cors";
import fs from "fs";
import path from "path";

dotenv.config();

// ⚠️ استخدم مفتاح SERVICE ROLE
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 📌 API - لإنشاء ورفع فاتورة PDF
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.id) {
      return res.status(400).json({ error: "Order data invalid" });
    }

    const fileName = `invoice-${order.id}.pdf`;
    const filePath = path.resolve(`./invoices/${fileName}`);

    // 📍 1) إنشاء ملف PDF
    await createInvoicePDF(order, filePath);

    // 📍 2) قراءة الملف من السيرفر
    const fileData = fs.readFileSync(filePath);

    // 📍 3) رفع الفاتورة إلى Supabase Storage
    const upload = await supabase.storage
      .from("invoices") // اسم الباكت
      .upload(`invoices/${fileName}`, fileData, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upload.error) {
      console.log("Upload Error:", upload.error);
      return res.status(500).json({ error: "Upload failed" });
    }

    // 📍 4) استخراج الرابط العام للفاتورة
    const { data: publicURL } = supabase.storage
      .from("invoices")
      .getPublicUrl(`invoices/${fileName}`);

    // 📍 5) حفظ رابط الفاتورة داخل جدول orders
    await supabase
      .from("orders")
      .update({ invoice_url: publicURL.publicUrl })
      .eq("id", order.id);

    // 📌 رد على داشبورد
    res.json({
      message: "Invoice created & uploaded successfully! 🚀",
      pdf_url: publicURL.publicUrl,
      order_id: order.id,
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to create or upload PDF" });
  }
});

// 🚀 تشغيل السيرفر
app.listen(5000, "0.0.0.0", () => {
  console.log("Malaky PDF Service Running on port 5000 📄🔥");
});
