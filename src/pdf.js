// مسار: src/pdf.js
import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";

const fontRegular = "assets/fonts/Cairo-Regular.ttf";
const logoImage = "assets/logo/malaky.png";

// الدالة الرئيسية
export async function createInvoicePDF(order, outputPath) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });

  doc.registerFont("Arabic", fontRegular);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // خلفية خفيفة
  doc.rect(0, 0, pageWidth, pageHeight).fill("#f3f4f6");

  // كارد أبيض في المنتصف
  const cardX = 32;
  const cardY = 32;
  const cardWidth = pageWidth - cardX * 2;
  const cardHeight = pageHeight - cardY * 2;

  doc
    .fillColor("#ffffff")
    .roundedRect(cardX, cardY, cardWidth, cardHeight, 14)
    .fill();

  // نبدأ نرسم فوق الكارد
  doc.font("Arabic");
  let y = cardY + 20;

  // ======= الهيدر + اللوجو =======
  doc.image(logoImage, pageWidth / 2 - 60, y, { width: 120 });
  y += 80;

  // ======= صندوق رقم الطلب + التاريخ =======
  const infoX = cardX + 18;
  const infoWidth = cardWidth - 36;
  const infoHeight = 60;

  doc
    .lineWidth(1)
    .roundedRect(infoX, y, infoWidth, infoHeight, 10)
    .stroke("#e5e7eb");

  doc
    .fontSize(11)
    .fillColor("#6b7280")
    .text("رقم الطلب:", infoX + 16, y + 12, {
      width: infoWidth - 32,
      align: "right",
    });

  doc
    .fontSize(11)
    .fillColor("#111827")
    .text(`${order.orderNumber || order.id}`, infoX + 16, y + 12, {
      width: infoWidth - 32,
      align: "left",
    });

  const dateStr = formatDate(order.date || order.created_at);
  const timeStr = formatTime(order.date || order.created_at);

  doc
    .fontSize(11)
    .fillColor("#6b7280")
    .text("التاريخ:", infoX + 16, y + 32, {
      width: infoWidth / 2 - 20,
      align: "right",
    });

  doc
    .fontSize(11)
    .fillColor("#111827")
    .text(dateStr, infoX + infoWidth / 2, y + 32, {
      width: infoWidth / 2 - 20,
      align: "left",
    });

  doc
    .fontSize(11)
    .fillColor("#6b7280")
    .text("الوقت:", infoX + 16, y + 32, {
      width: infoWidth / 2 - 20,
      align: "left",
    });

  doc
    .fontSize(11)
    .fillColor("#111827")
    .text(timeStr, infoX + infoWidth / 2 - 40, y + 32, {
      width: infoWidth / 2 - 20,
      align: "right",
    });

  y += infoHeight + 24;

  // ======= جدول الأصناف =======
  const tableX = cardX + 24;
  const tableWidth = cardWidth - 48;

  // عناوين الأعمدة
  const colItem = tableX + 10;
  const colNotes = tableX + 190;
  const colQty = tableX + 290;
  const colPrice = tableX + 360;
  const colTotal = tableX + 440;

  doc.fontSize(11).fillColor("#6b7280");
  doc.text("الصنف", colItem, y, { width: 150, align: "right" });
  doc.text("ملاحظات", colNotes, y, { width: 80, align: "right" });
  doc.text("الكمية", colQty, y, { width: 40, align: "center" });
  doc.text("السعر", colPrice, y, { width: 60, align: "left" });
  doc.text("الإجمالي", colTotal, y, { width: 70, align: "left" });

  y += 6;
  doc
    .moveTo(tableX, y)
    .lineTo(tableX + tableWidth, y)
    .strokeColor("#d1d5db")
    .lineWidth(1)
    .stroke();
  y += 10;

  // الصفوف
  let subtotal = 0;
  const items = order.items || [];

  items.forEach((item) => {
    const qty = Number(item.qty || item.quantity || 1);
    const price = Number(item.price || item.unit_price || 0);
    const lineTotal = qty * price;
    subtotal += lineTotal;

    doc.fontSize(11).fillColor("#111827");
    doc.text(item.name || "صنف بدون اسم", colItem, y, {
      width: 150,
      align: "right",
    });

    doc
      .fontSize(10)
      .fillColor("#6b7280")
      .text(item.notes || "-", colNotes, y, {
        width: 80,
        align: "right",
      });

    doc
      .fontSize(11)
      .fillColor("#111827")
      .text(String(qty), colQty, y, {
        width: 40,
        align: "center",
      });

    doc.text(formatMoney(price), colPrice, y, {
      width: 60,
      align: "left",
    });

    doc.text(formatMoney(lineTotal), colTotal, y, {
      width: 70,
      align: "left",
    });

    y += 22;
    doc
      .moveTo(tableX, y)
      .lineTo(tableX + tableWidth, y)
      .strokeColor("#f3f4f6")
      .lineWidth(0.5)
      .stroke();
    y += 4;
  });

  y += 12;

  // ======= ملخص الأسعار =======
  const summaryX = tableX + 10;
  const summaryWidth = tableWidth - 20;

  const deliveryFee = Number(order.delivery_price ?? 0);
  const discount = Number(order.discount ?? 0);
  const vatPercent = 0; // يمكنك تغييره لاحقاً إذا أردت ضريبة
  const afterDelivery = subtotal + deliveryFee - discount;
  const vatAmount = (afterDelivery * vatPercent) / 100;
  const grandTotal = Number(order.total_price ?? afterDelivery + vatAmount);

  function summaryRow(label, value, options = {}) {
    doc
      .fontSize(11)
      .fillColor(options.color || "#374151")
      .text(label, summaryX, y, {
        width: summaryWidth / 2,
        align: "right",
      });

    doc.text(value, summaryX + summaryWidth / 2 + 8, y, {
      width: summaryWidth / 2 - 8,
      align: "left",
    });

    y += 18;
  }

  doc
    .moveTo(summaryX, y)
    .lineTo(summaryX + summaryWidth, y)
    .strokeColor("#e5e7eb")
    .stroke();
  y += 10;

  summaryRow("المجموع الفرعي:", formatMoney(subtotal));

  if (deliveryFee) summaryRow("رسوم التوصيل:", formatMoney(deliveryFee));

  if (discount)
    summaryRow("الخصم:", `-${formatMoney(discount)}`, {
      color: "#dc2626",
    });

  if (vatPercent)
    summaryRow(`الضريبة (VAT ${vatPercent}%):`, formatMoney(vatAmount));

  // صف الإجمالي الكلي (بخلفية ملونة خفيفة)
  doc
    .rect(summaryX, y, summaryWidth, 26)
    .fill("#eef2ff");
  doc.fontSize(12).fillColor("#111827");
  doc.text("الإجمالي الكلي:", summaryX + 4, y + 6, {
    width: summaryWidth / 2,
    align: "right",
  });
  doc.text(formatMoney(grandTotal), summaryX + summaryWidth / 2 + 8, y + 6, {
    width: summaryWidth / 2 - 8,
    align: "left",
  });

  y += 36;

  // طريقة الدفع
  summaryRow("طريقة الدفع:", order.payment_method || "غير محدد");

  // فاصل قبل معلومات العميل
  y += 6;
  doc
    .moveTo(cardX + 24, y)
    .lineTo(cardX + cardWidth - 24, y)
    .strokeColor("#e5e7eb")
    .stroke();
  y += 16;

  // ======= معلومات العميل =======
  const customerTitleX = summaryX;
  doc
    .fontSize(12)
    .fillColor("#111827")
    .text("معلومات العميل", customerTitleX, y, {
      width: summaryWidth,
      align: "right",
    });

  y += 22;

  const customerBoxHeight = 72;
  doc
    .rect(summaryX, y, summaryWidth, customerBoxHeight)
    .fill("#f9fafb")
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();

  const customerY = y + 10;
  const name =
    order.customer_name ||
    order.customer ||
    order.guest_customer_name ||
    "زبون التطبيق";

  const address =
    order.address ||
    order.full_address ||
    order.user_address ||
    "—";

  const phone = order.phone || order.guest_phone || "1700250250";

  doc
    .fontSize(11)
    .fillColor("#374151")
    .text(`الاسم: ${name}`, summaryX + 10, customerY, {
      width: summaryWidth - 20,
      align: "right",
    });

  doc.text(`العنوان: ${address}`, summaryX + 10, customerY + 20, {
    width: summaryWidth - 20,
    align: "right",
  });

  doc.text(`الهاتف: ${phone}`, summaryX + 10, customerY + 40, {
    width: summaryWidth - 20,
    align: "right",
  });

  // ======= الفوتر + رسالة الشكر =======
  const footerY = cardY + cardHeight - 90;

  // QR في الأسفل اليسار
  const qrData = await QRCode.toDataURL(`order:${order.id}`);
  doc.image(qrData, cardX + 30, footerY - 10, { width: 70 });

  doc
    .fontSize(11)
    .fillColor("#b91c1c")
    .text("شكراً لاختياركم مطعم ملكي بروست!", 0, footerY, {
      align: "center",
    });

  doc
    .fontSize(10)
    .fillColor("#6b7280")
    .text("نتطلع لخدمتكم مرة أخرى", 0, footerY + 16, {
      align: "center",
    });

  doc
    .fontSize(9)
    .fillColor("#9ca3af")
    .text(`تم توليد الفاتورة بتاريخ ${formatDate(new Date())}`, 0, footerY + 32, {
      align: "center",
    });

  // حفظ الملف
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ======= توابع مساعدة =======
function formatMoney(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)} ₪`;
}

function formatDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ar-PS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-PS", {
    hour: "numeric",
    minute: "2-digit",
  });
}