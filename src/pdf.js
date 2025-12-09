import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";
import arabicReshaper from "arabic-reshaper";
import bidi from "bidi-js";

// 🛠️ إصلاح النص العربي مع bidi
function fixArabic(text) {
  if (!text || typeof text !== "string") return "";
  try {
    const reshaped = arabicReshaper.reshape(text);
    return bidi.getEmbeddingLevels(reshaped).text;
  } catch {
    return text;
  }
}

// 💰 تنسيق المبلغ
function money(amount) {
  return fixArabic(`${Number(amount).toFixed(2)} شيكل`);
}

const fontRegular = "assets/fonts/Cairo-Regular.ttf";
const logoImage = "assets/logo/malaky.png";
const primaryColor = "#C62828";

export async function createInvoicePDF(order, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: { Title: fixArabic("فاتورة طلب مطعم ملكي بروست") },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 🅰️ الخط
      doc.registerFont("Arabic", fontRegular);
      doc.font("Arabic");

      // ========= 🔺 الهيدر =========
      try {
        doc.image(logoImage, doc.page.width / 2 - 35, 30, { width: 70 });
      } catch {}

      doc
        .fontSize(20)
        .fillColor(primaryColor)
        .text(fixArabic("فاتورة طلب مطعم ملكي بروست"), {
          align: "center",
          features: ["rtla"],
        });

      doc.moveDown(1);

      const createdAt = formatDate(order.date ?? order.created_at ?? new Date());
      const paymentMethod =
        order.payment_method ?? fixArabic("دفع عند الاستلام");

      // ========= 📌 البيانات الأساسية =========
      field(doc, "رقم الطلب", order.id ?? "-");
      field(doc, "التاريخ", createdAt);
      field(doc, "طريقة الدفع", paymentMethod);

      doc.moveDown(0.8);

      // ========= 👤 بيانات العميل =========
      title(doc, "بيانات العميل");

      const customer =
        order.customer ?? order.guest_customer_name ?? "زبون التطبيق";
      const phone = order.phone ?? order.guest_phone ?? "-";
      const address = order.address ?? "لا يوجد عنوان";

      field(doc, "اسم العميل", customer);
      field(doc, "الهاتف", phone);
      field(doc, "العنوان", address);

      doc.moveDown(0.7);
      divider(doc);

      // ========= 🍗 تفاصيل الأصناف =========
      title(doc, "تفاصيل الطلب");
      doc.moveDown(0.3);

      tableHeader(doc, ["الصنف", "الكمية", "السعر", "الإجمالي"]);

      let total = 0;

      if (Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach((item) => {
          const name = item.name ?? "صنف";
          const qty = Number(item.qty ?? item.quantity ?? 1);
          const price = Number(item.price ?? item.unit_price ?? 0);
          const rowTotal = qty * price;
          total += rowTotal;

          tableRow(doc, [
            name,
            qty.toString(),
            price.toFixed(2),
            rowTotal.toFixed(2),
          ]);
        });
      } else {
        doc
          .fontSize(11)
          .fillColor("#777")
          .text(fixArabic("لا توجد أصناف في هذا الطلب."), {
            align: "right",
            width: doc.page.width - 80,
            features: ["rtla"],
          });
      }

      doc.moveDown(0.5);
      divider(doc);

      // ========= 💰 الإجمالي =========
      doc.moveDown(0.5);
      totalField(doc, "الإجمالي الكلي", total);

      // ========= 📝 ملاحظات =========
      if (order.notes) {
        doc.moveDown(0.8);
        doc
          .fontSize(11)
          .fillColor("#333")
          .text(fixArabic(`ملاحظات الطلب: ${order.notes}`), {
            align: "right",
            width: doc.page.width - 80,
            features: ["rtla"],
          });
      }

      // ========= 🔳 QR =========
      try {
        const qr = await QRCode.toDataURL(`order:${order.id ?? ""}`);
        const size = 90;
        const qrX = 50;
        const qrY = doc.page.height - size - 140;
        doc.image(qr, qrX, qrY, { width: size, height: size });

        doc
          .fontSize(9)
          .fillColor("#555")
          .text(fixArabic("امسح للتحقق من تفاصيل الطلب"), qrX, qrY + size + 5, {
            width: size + 10,
            align: "center",
            features: ["rtla"],
          });
      } catch {}

      // ========= 🖊️ التوقيع =========
      const signY = doc.page.height - 160;
      doc
        .fontSize(12)
        .fillColor("#000")
        .text(fixArabic("الختم والتوقيع:"), doc.page.width - 260, signY, {
          width: 200,
          align: "right",
          features: ["rtla"],
        });

      // ========= 🦶 الفوتر =========
      const footerY = doc.page.height - 70;
      doc
        .fontSize(11)
        .fillColor(primaryColor)
        .text(fixArabic("شكراً لاختياركم مطعم ملكي بروست!"), 0, footerY, {
          align: "center",
          features: ["rtla"],
        });

      doc
        .fontSize(9)
        .fillColor("#555")
        .text(fixArabic("لطلباتكم: 1700250250"), 0, footerY + 18, {
          align: "center",
          features: ["rtla"],
        });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ==================== 📌 دوال مساعدة ====================

function field(doc, label, value) {
  doc
    .fontSize(11)
    .fillColor("#333")
    .text(fixArabic(`${label}: ${value}`), {
      align: "right",
      width: doc.page.width - 80,
      features: ["rtla"],
    });
}

function title(doc, text) {
  doc
    .fontSize(14)
    .fillColor("#000")
    .text(fixArabic(text), {
      align: "right",
      width: doc.page.width - 80,
      features: ["rtla"],
    });
}

function divider(doc) {
  const y = doc.y + 5;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor("#DDDDDD").stroke();
  doc.moveDown(0.5);
}

function tableHeader(doc, cols) {
  doc.fontSize(12).fillColor(primaryColor);
  printRow(doc, cols, true);
}

function tableRow(doc, cols) {
  doc.fontSize(11).fillColor("#333");
  printRow(doc, cols, false);
}

function printRow(doc, cols, isHeader) {
  const colWidths = [200, 60, 80, 90];
  let x = doc.page.width - 40;

  cols.forEach((col, i) => {
    const w = colWidths[i];
    x -= w;
    doc.text(i === 0 ? fixArabic(col) : col, x, doc.y, {
      width: w,
      align: "center",
      features: i === 0 ? ["rtla"] : undefined,
    });
  });

  doc.moveDown(1);
}

function totalField(doc, label, total) {
  const text = fixArabic(`${label}: ${total.toFixed(2)} شيكل`);
  doc.fontSize(13).fillColor(primaryColor).text(text, {
    align: "right",
    width: doc.page.width - 80,
    features: ["rtla"],
  });
}

function formatDate(date) {
  return new Date(date).toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
