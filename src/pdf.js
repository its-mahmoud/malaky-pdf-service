import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";
import arabicReshaper from "arabic-reshaper";
import bidi from "bidi-js";

// 🛠️ إصلاح النص العربي
function fixArabic(text) {
  if (!text || typeof text !== "string") return "";
  try {
    const reshaped = arabicReshaper.reshape(text);
    return bidi.getEmbeddingLevels(reshaped).text;
  } catch {
    return text;
  }
}

const fontRegular = "assets/fonts/Cairo-Regular.ttf";
const logoImage = "assets/logo/malaky.png";
const primaryColor = "#C62828";
const softBackground = "#FAFAFA";

export async function createInvoicePDF(order, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: "فاتورة طلب مطعم ملكي بروست",
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 🎨 خلفية خفيفة
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(softBackground);
      doc.fillColor("#000"); // نرجع للون النص الافتراضي

      // 🅰️ الخط
      doc.registerFont("Arabic", fontRegular);
      doc.font("Arabic");

      // ========= 🔺 الهيدر =========
      try {
        doc.image(logoImage, doc.page.width / 2 - 35, 35, { width: 70 });
      } catch {
        console.log("Logo not found");
      }

      doc
        .fontSize(20)
        .fillColor(primaryColor)
        .text(fixArabic("فاتورة طلب مطعم ملكي بروست"), 0, 120, {
          align: "center",
          features: ["rtla"],
        });

      doc.moveDown(0.5);

      const createdAt = new Date(order.date ?? order.created_at ?? new Date());
      const dateStr = createdAt.toLocaleDateString("ar-EG");
      const timeStr = createdAt.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // ========= 📌 معلومات الفاتورة (رقم + تاريخ + وقت) =========
      doc
        .fontSize(11)
        .fillColor("#333")
        .text(
          fixArabic(`رقم الفاتورة: ${order.id ?? "-"}`),
          0,
          doc.y,
          {
            align: "right",
            width: doc.page.width - 80,
            features: ["rtla"],
          }
        );
      doc.text(
        fixArabic(`التاريخ: ${dateStr}  |  الوقت: ${timeStr}`),
        {
          align: "right",
          width: doc.page.width - 80,
          features: ["rtla"],
        }
      );

      doc.moveDown(0.7);

      // ========= 🍗 جدول تفاصيل الأصناف =========
      title(doc, "تفاصيل الطلب");

      doc.moveDown(0.3);
      tableHeader(doc, ["الصنف", "الملاحظات", "السعر", "الكمية", "الإجمالي"]);

      let subtotal = 0;

      if (Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach((item) => {
          const name = item.name ?? "صنف بدون اسم";
          const notes =
            item.notes ??
            item.note ??
            item.description ??
            "-";
          const qty = Number(item.qty ?? item.quantity ?? 1);
          const price = Number(item.price ?? item.unit_price ?? 0);
          const rowTotal = qty * price;
          subtotal += rowTotal;

          tableRow(doc, [
            name,
            notes,
            price.toFixed(2),
            qty.toString(),
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

      // ========= 💰 قسم المجموع ========

      const deliveryFee = Number(order.delivery_fee ?? 0);
      const isDelivery =
        order.order_type === "delivery" ||
        order.type === "delivery" ||
        order.is_delivery === true ||
        deliveryFee > 0;

      let totalToPay = subtotal;
      if (isDelivery && deliveryFee > 0) {
        totalToPay += deliveryFee;
      }

      doc.moveDown(0.5);

      // نحدد نقطة البداية للبلوكين (المبالغ + معلومات الزبون)
      const sectionStartY = doc.y;

      const pageWidth = doc.page.width;
      const leftBlockX = 40;
      const leftBlockWidth = pageWidth / 2 - 60;
      const rightBlockX = pageWidth / 2;
      const rightBlockWidth = pageWidth - rightBlockX - 40;

      // 💰 البلوك الأيسر: المجموع
      doc.fontSize(12).fillColor("#000");
      doc.text(fixArabic("ملخص المبلغ"), leftBlockX, sectionStartY, {
        width: leftBlockWidth,
        align: "right",
        features: ["rtla"],
      });

      let yAfterAmounts = doc.y;

      doc.fontSize(11).fillColor("#333");
      doc.text(
        fixArabic(`المجموع الفرعي: ${subtotal.toFixed(2)} شيكل`),
        leftBlockX,
        yAfterAmounts,
        {
          width: leftBlockWidth,
          align: "right",
          features: ["rtla"],
        }
      );
      yAfterAmounts = doc.y;

      if (isDelivery && deliveryFee > 0) {
        doc.text(
          fixArabic(`رسوم التوصيل: ${deliveryFee.toFixed(2)} شيكل`),
          leftBlockX,
          yAfterAmounts,
          {
            width: leftBlockWidth,
            align: "right",
            features: ["rtla"],
          }
        );
        yAfterAmounts = doc.y;
      }

      doc
        .fontSize(12)
        .fillColor(primaryColor)
        .text(
          fixArabic(`المبلغ للدفع: ${totalToPay.toFixed(2)} شيكل`),
          leftBlockX,
          yAfterAmounts + 2,
          {
            width: leftBlockWidth,
            align: "right",
            features: ["rtla"],
          }
        );
      yAfterAmounts = doc.y;

      // 👤 البلوك الأيمن: بيانات الزبون
      const customerName =
        order.customer ?? order.guest_customer_name ?? "زبون التطبيق";
      const customerPhone = order.phone ?? order.guest_phone ?? "-";
      const customerAddress = order.address ?? "لا يوجد عنوان";

      const yStartRight = sectionStartY;

      doc.fontSize(12).fillColor("#000");
      doc.text(fixArabic("معلومات التواصل"), rightBlockX, yStartRight, {
        width: rightBlockWidth,
        align: "right",
        features: ["rtla"],
      });

      doc.fontSize(11).fillColor("#333");
      doc.text(
        fixArabic(`اسم الزبون: ${customerName}`),
        rightBlockX,
        doc.y,
        {
          width: rightBlockWidth,
          align: "right",
          features: ["rtla"],
        }
      );
      doc.text(
        fixArabic(`رقم الهاتف: ${customerPhone}`),
        rightBlockX,
        doc.y,
        {
          width: rightBlockWidth,
          align: "right",
          features: ["rtla"],
        }
      );
      doc.text(
        fixArabic(`العنوان: ${customerAddress}`),
        rightBlockX,
        doc.y,
        {
          width: rightBlockWidth,
          align: "right",
          features: ["rtla"],
        }
      );

      const yAfterCustomer = doc.y;

      // نأخذ أكبر Y من البلوكين و نكمل منها
      doc.y = Math.max(yAfterAmounts, yAfterCustomer) + 20;

      // ========= 🔳 QR =========
      try {
        const qrData = `order:${order.id ?? ""}`;
        const qr = await QRCode.toDataURL(qrData);
        const size = 80;
        const qrX = 50;
        const qrY = doc.page.height - size - 140;

        doc.image(qr, qrX, qrY, { width: size, height: size });
        doc
          .fontSize(9)
          .fillColor("#555")
          .text(fixArabic("امسح لمعرفة تفاصيل طلبك"), qrX, qrY + size + 5, {
            width: size + 10,
            align: "center",
            features: ["rtla"],
          });
      } catch {
        console.log("QR failed");
      }

      // ========= 🦶 الفوتر =========
      const footerY = doc.page.height - 70;
      doc
        .fontSize(11)
        .fillColor(primaryColor)
        .text(fixArabic("شكراً لثقتكم بنا ❤️"), 0, footerY, {
          align: "center",
          features: ["rtla"],
        });

      doc
        .fontSize(9)
        .fillColor("#555")
        .text(fixArabic("مطعم ملكي بروست - لطـلباتكم: 1700250250"), 0, footerY + 18, {
          align: "center",
          features: ["rtla"],
        });

      // إنهاء الـ PDF
      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ========== دوال مساعدة للتنسيق ==========

function title(doc, text) {
  doc
    .fontSize(14)
    .fillColor("#000")
    .text(fixArabic(text), 0, doc.y, {
      align: "right",
      width: doc.page.width - 80,
      features: ["rtla"],
    });
}

function divider(doc) {
  const y = doc.y + 5;
  doc
    .moveTo(40, y)
    .lineTo(doc.page.width - 40, y)
    .strokeColor("#DDDDDD")
    .stroke();
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
  // [الصنف, الملاحظات, السعر, الكمية, الإجمالي]
  const colWidths = [180, 140, 70, 60, 80];
  let x = doc.page.width - 40;

  cols.forEach((col, i) => {
    const w = colWidths[i];
    x -= w;
    const isArabic = i <= 1; // الصنف + الملاحظات
    doc.text(
      isArabic ? fixArabic(col) : col,
      x,
      doc.y,
      {
        width: w,
        align: "center",
        features: ["rtla"],
      }
    );
  });

  doc.moveDown(1);
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
