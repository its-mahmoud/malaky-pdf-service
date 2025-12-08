import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";
import writtenNumber from "written-number";

// ضبط اللغة العربية للأرقام كتابةً
writtenNumber.defaults.lang = "ar";

// 🅰️ الخط (تأكد من وجوده داخل assets/fonts)
const fontRegular = "assets/fonts/Cairo-Regular.ttf";

// 🖼️ اللوجو
const logoImage = "assets/logo/malaky.png";

export async function createInvoicePDF(order, outputPath) {
  const doc = new PDFDocument({ size: "A4", margin: 25 });
  doc.registerFont("Arabic", fontRegular);
  doc.font("Arabic");

  // ===== 🎨 خلفية =====
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f6f7f9");

  // ===== 🟥 اللوجو =====
  doc.image(logoImage, doc.page.width / 2 - 60, 30, { width: 120 });

  // ===== 📌 معلومات الطلب =====
  const boxY = 120;
  doc.roundedRect(35, boxY, doc.page.width - 70, 65, 12)
    .fill("#ffffff")
    .stroke("#dcdcdc");

  doc.fillColor("#333").fontSize(13);

  doc.text(`رقم الطلب: ${order.id ?? "-"}`, 0, boxY + 15, {
    align: "center",
    rtl: true,
  });

  doc.text(`التاريخ: ${formatDate(order.date)}`, 0, boxY + 40, {
    align: "center",
    rtl: true,
  });

  // ===== 🍗 جدول الأصناف =====
  let y = 210;

  // عناوين الأعمدة
  doc.fontSize(13).fillColor("#000");
  doc.text("الصنف", 410, y, { width: 150, align: "right", rtl: true });
  doc.text("ملاحظات", 310, y, { width: 100, align: "right", rtl: true });
  doc.text("الكمية", 230, y, { width: 80, align: "center", rtl: true });
  doc.text("السعر", 150, y, { width: 80, align: "center", rtl: true });
  doc.text("الإجمالي", 40, y, { width: 110, align: "left", rtl: true });

  y += 3;
  doc.moveTo(35, y).lineTo(doc.page.width - 35, y).stroke("#aaa");
  y += 12;

  // العناصر
  let total = 0;
  order.items.forEach((item) => {
    const rowTotal = item.qty * item.price;
    total += rowTotal;

    doc.fontSize(12).fillColor("#000");

    doc.text(item.name, 410, y, { width: 150, align: "right", rtl: true });
    doc.text(item.notes ?? "-", 310, y, { width: 100, align: "right", rtl: true });
    doc.text(item.qty, 230, y, { width: 80, align: "center", rtl: true });
    doc.text(`${item.price} ₪`, 150, y, { width: 80, align: "center", rtl: true });
    doc.text(`${rowTotal} ₪`, 40, y, { width: 110, align: "left", rtl: true });

    y += 22;
  });

  // ===== 💰 الإجمالي =====
  y += 10;
  doc.fontSize(14).fillColor("#000");
  doc.roundedRect(35, y, doc.page.width - 70, 35, 8)
    .fill("#e7ebff");

  doc.fillColor("#1a1a1a").text(`الإجمالي الكلي: ${total} ₪`, 0, y + 9, {
    align: "center",
    rtl: true,
  });

  // ===== 🧾 معلومات العميل =====
  y += 55;
  doc.fillColor("#000").fontSize(14).text("معلومات العميل", 0, y, {
    align: "right",
    rtl: true,
  });

  y += 10;
  doc.fontSize(12).fillColor("#444");
  doc.text(`الاسم: ${order.customer ?? "زبون التطبيق"}`, 0, y, { align: "right", rtl: true });
  y += 18;
  doc.text(`الهاتف: ${order.phone ?? "-"}`, 0, y, { align: "right", rtl: true });
  y += 18;
  doc.text(`العنوان: ${order.address ?? "-"}`, 0, y, { align: "right", rtl: true });

  // ===== 📌 QR Code =====
  const qrData = await QRCode.toDataURL(`order:${order.id}`);
  doc.image(qrData, 35, doc.page.height - 140, { width: 100 });

  // ===== ❤️ Footer =====
  doc.fontSize(11).fillColor("#d10000");
  doc.text("شكراً لاختياركم مطعم ملكي بروست!", 0, doc.page.height - 85, {
    align: "center",
  });
  doc.fillColor("#555").text("نتطلع لخدمتكم مرة أخرى", 0, doc.page.height - 65, {
    align: "center",
  });

  // ===== 💾 حفظ =====
  doc.pipe(fs.createWriteStream(outputPath));
  doc.end();
}

// 📆 تنسيق التاريخ
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}