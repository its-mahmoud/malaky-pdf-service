import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// helper paths
const fontPath = path.resolve(__dirname, "../assets/fonts/Cairo-Regular.ttf");
const logoPath = path.resolve(__dirname, "../assets/logo/malaky.png");


export async function createInvoicePDF(order, outputPath) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    doc.registerFont("Arabic", fontPath);
    doc.image(logoPath, 50, 30, { width: 110 });

    // --- Title ---
    doc.font("Arabic").fontSize(22).text("فاتورة طلب مطعم Malaky Broast Chicken", 0, 55, {
        align: "center",
    });

    doc.moveDown(2);

    // --- Order Info ---
    doc.fontSize(14).text(`رقم الطلب: ${order.id}`);
    doc.text(`اسم العميل: ${order.customer}`);
    doc.text(`تاريخ الطلب: ${order.date}`);

    doc.moveDown(1);

    // --- Items Table ---
    doc.fontSize(16).text("تفاصيل الطلب:", { underline: true });
    doc.moveDown(0.5);

    let total = 0;
    order.items.forEach((item, i) => {
        doc.fontSize(14).text(` - ${item.name}  |  ${item.qty} × ${item.price} ₪`);
        total += item.qty * item.price;
    });

    doc.moveDown(1);

    // --- Total ---
    doc.fontSize(18).text(`الإجمالي: ${total} ₪`, { align: "right" });

    // --- Amount in Words ---
    doc.moveDown(0.3);
    doc.fontSize(14).text(`المبلغ كتابةً: ${convertNumberToArabicWords(total)} شيكل`, {
        align: "right",
    });

    // --- QR Code ---
    const qrData = await QRCode.toDataURL(`order:${order.id}`);
    doc.image(qrData, 450, 620, { width: 110 });

    // --- Footer Message ---
    doc.fontSize(12).text("شكراً لاختياركم Malaky ❤️", 0, 760, { align: "center" });

    // --- Save File ---
    doc.pipe(fs.createWriteStream(outputPath));
    doc.end();
}

// =============================
// 🔵 Function Convert Number
// =============================

// ملاحظة: يمكن تطويرها لاحقاً لتكون أكثر دقة
function convertNumberToArabicWords(number) {
    const words = [
        "صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة",
        "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر",
        "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
        "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر", "عشرون"
    ];

    if (number <= 20) return words[number];
    return number.toString(); // مؤقتًا حتى نوسعها لاحقًا
}
