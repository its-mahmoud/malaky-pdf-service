import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";

// 🟦 الخطوط (تأكد من وجود Cairo-Regular.ttf)
const fontRegular = "assets/fonts/Cairo-Regular.ttf";

// 🟥 اللوجو (بدون كتابة تحته)
const logoImage = "assets/logo/malaky.png";

export async function createInvoicePDF(order, outputPath) {
  const doc = new PDFDocument({ size: "A4", margin: 30 });
  doc.registerFont("Arabic", fontRegular);

  // ===== 🌤 خلفية بيضاء-رمادية (Soft Gray) =====
  doc.rect(0, 0, doc.page.width, doc.page.height)
    .fill("#f7f7f7");

  // ===== 🟥 رأس الفاتورة =====
  doc.image(logoImage, doc.page.width / 2 - 70, 20, { width: 140 });

  // ===== 🔢 معلومات رقم الطلب والتاريخ =====
  doc.fillColor("#000").font("Arabic").fontSize(13);

  doc.roundedRect(40, 120, doc.page.width - 80, 70, 10)
    .fill("#ffffff")
    .stroke("#dddddd");

  doc.fillColor("#444").fontSize(14);
  doc.text(`رقم الطلب: ${order.id}`, 60, 135, { align: "right" });
  doc.text(`التاريخ: ${formatDate(order.date)}`, 60, 160, { align: "right" });

  // ===== 🍗 جدول الأصناف =====
  let yPos = 220;
  doc.fontSize(14).fillColor("#000");

  doc.text("الصنف", 430, yPos);
  doc.text("الكمية", 250, yPos);
  doc.text("السعر", 130, yPos);
  yPos += 5;

  doc.moveTo(40, yPos).lineTo(doc.page.width - 40, yPos).stroke("#999");
  yPos += 15;

  let total = 0;
  order.items.forEach((item) => {
    doc.text(item.name, 420, yPos, { width: 180, align: "right" });
    doc.text(item.qty, 260, yPos, { width: 40, align: "center" });
    doc.text(`${item.price} ₪`, 120, yPos, { width: 80, align: "center" });

    total += item.qty * item.price;
    yPos += 25;
  });

  // ===== 💰 الإجمالي =====
  yPos += 10;
  doc.fontSize(16).fillColor("#000");
  doc.text(`الإجمالي الكلي: ${total} ₪`, 40, yPos, { align: "right" });

  // ===== 🔢 المبلغ كتابة =====
  yPos += 25;
  doc.fontSize(12).fillColor("#444");
  doc.text(`المبلغ كتابةً: ${convertNumberToArabicWords(total)} شيكل`, 40, yPos, {
    align: "right",
  });

  // ===== 📌 QR Code =====
  const qrData = await QRCode.toDataURL(`order:${order.id}`);
  doc.image(qrData, 50, doc.page.height - 190, { width: 100 });

  // ===== 🧾 Footer =====
  doc.fontSize(12).fillColor("#444");
  doc.text("شكراً لاختياركم مطعم ملكي بروست 🍗👑", 0, doc.page.height - 70, {
    align: "center",
  });
  doc.text("للـسـؤالـت: 1700250250", 0, doc.page.height - 50, {
    align: "center",
  });

  // ===== 💾 حفظ الملف =====
  doc.pipe(fs.createWriteStream(outputPath));
  doc.end();
}


// =============================
// 🔢 تحويل الأرقام إلى كتابة
// =============================
function convertNumberToArabicWords(num) {
  const n = require("number-to-words");
  const words = n.toWords(num);
  return words.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// =============================
// 📆 تنسيق التاريخ
// =============================
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
