import express from "express";
import bodyParser from "body-parser";
import { createInvoicePDF } from "./pdf.js";
import cors from "cors";


const app = express();
app.use(bodyParser.json());
app.use(cors());

// 📌 استقبال الطلب
app.post("/generate", async (req, res) => {
  try {
    const order = req.body;
    const fileName = `invoice-${order.id}.pdf`;

    await createInvoicePDF(order, `./invoices/${fileName}`);

    res.json({
      message: "PDF created successfully!",
      file: fileName,
    });
  } catch (err) {
    console.log("Error:", err);
    res.status(500).json({ error: "Failed to create PDF" });
  }
});

// 🚀 تشغيل السيرفر
app.listen(5000, "0.0.0.0", () => {
  console.log("Malaky PDF Service Running on port 5000 📄🔥");
});

