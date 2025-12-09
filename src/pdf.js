import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";
import arabicReshaper from "arabic-reshaper";
import bidi from "bidi-js";

// 🔤 دالة لإصلاح النص العربي
function ar(text) {
  if (!text) return "";
  return bidi.getEmbeddingLevels(arabicReshaper.reshape(text)).text;
}

// 💰 تنسيق الأرقام + العملة
function money(num) {
  return ar(`${Number(num).toFixed(2)} شيكل`);
}

// 📄 إنشاء الفاتورة
export async function generateInvoice(order, saveToPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: { Title: "فاتورة طلب مطعم ملكي بروست" },
      });

      const stream = fs.createWriteStream(saveToPath);
      doc.pipe(stream);

      // ========= 🅰️ إعداد الخطوط =========
      const font = "assets/fonts/Cairo-Regular.ttf";
      doc.registerFont("Arabic", font).font("Arabic");

      // ========= 🔺 رأس الصفحة =========
      try { doc.image("assets/logo/malaky.png", doc.page.width / 2 - 40, 30, { width: 80 }); } catch {}

      doc.fontSize(20).fillColor("#000")
        .text(ar("فاتورة طلب مطعم ملكي بروست"), 0, 120, { align: "center" });

      // معلومات الطلب
      const createdAt = formatDate(order.date ?? order.created_at ?? new Date());
      const payMethod = order.payment_method ?? "دفع عند الاستلام";

      doc.moveDown(1);
      field(`رقم الفاتورة`, order.id ?? "-");
      field(`التاريخ`, createdAt);
      field(`طريقة الدفع`, payMethod);

      // ========= 👤 بيانات الزبون =========
      doc.moveDown(1);
      title("بيانات العميل");
      field("الاسم", order.customer ?? order.guest_customer_name ?? "زبون التطبيق");
      field("الهاتف", order.phone ?? order.guest_phone ?? "-");
      field("العنوان", order.address ?? "لا يوجد عنوان");

      line();

      // ========= 🍗 أصناف الطلب =========
      title("تفاصيل الطلب");
      tableHeader(["الصنف", "الكمية", "السعر", "الإجمالي"]);

      let total = 0;

      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const name = item.name ?? "صنف";
          const qty = Number(item.qty ?? item.quantity ?? 1);
          const price = Number(item.price ?? item.unit_price ?? 0);
          const rowTotal = qty * price;
          total += rowTotal;
          tableRow([name, qty.toString(), money(price), money(rowTotal)]);
        });
      } else {
        doc.fontSize(11).fillColor("#666")
          .text(ar("لا توجد أصناف"), { align: "right" });
      }

      line();

      // ========= 💵 الإجمالي =========
      totalField("الإجمالي الكلي", money(total));

      // ========= 📝 ملاحظات =========
      if (order.notes) {
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor("#333")
          .text(ar(`ملاحظات: ${order.notes}`), { align: "right" });
      }

      // ========= 📌 QR =========
      try {
        const qr = await QRCode.toDataURL(`order:${order.id}`);
        doc.image(qr, 50, doc.page.height - 220, { width: 110 });
      } catch {}

      // ========= 🖊️ ختم + توقيع =========
      doc.fontSize(12).fillColor("#000")
        .text(ar("الختم والتوقيع:"), doc.page.width - 250, doc.page.height - 160);

      // ========= 🦶 Footer =========
      doc.fontSize(10).fillColor("#C62828")
        .text(ar("شكراً لاختياركم مطعم ملكي بروست!"), 0, doc.page.height - 60, { align: "center" });

      doc.fontSize(9).fillColor("#333")
        .text(ar("لطلباتكم: 1700250250"), 0, doc.page.height - 40, { align: "center" });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);

      // ========= 📌 دوال مساعدة =========

      function field(label, value) {
        doc.fontSize(11).fillColor("#333")
          .text(ar(`${label}: ${value}`), { align: "right" });
      }

      function title(text) {
        doc.fontSize(14).fillColor("#000")
          .text(ar(text), { align: "right" });
      }

      function line() {
        doc.moveDown(0.2);
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke("#CCC");
        doc.moveDown(0.3);
      }

      function tableHeader(cols) {
        doc.fontSize(12).fillColor("#000");
        printCols(cols, true);
      }

      function tableRow(cols) {
        doc.fontSize(11).fillColor("#333");
        printCols(cols, false);
      }

      function printCols(cols, bold) {
        const widths = [200, 60, 100, 110];
        let x = doc.page.width - 40;
        cols.forEach((col, i) => {
          const w = widths[i];
          x -= w;
          doc.text(ar(col), x, doc.y, { width: w, align: "center" });
        });
        doc.moveDown(1);
      }

      function totalField(label, value) {
        doc.fontSize(13).fillColor("#000")
          .text(ar(`${label}: ${value}`), { align: "right" });
      }

      function formatDate(date) {
        return new Date(date).toLocaleString("ar-EG", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });
      }

    } catch (err) { reject(err); }
  });
}
