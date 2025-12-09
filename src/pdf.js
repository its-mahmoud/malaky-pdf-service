import PDFDocument from "pdfkit";
import fs from "fs";
import QRCode from "qrcode";

// الخطوط
const fontRegular = "assets/fonts/Cairo-Regular.ttf";
const fontBold = "assets/fonts/Cairo-Bold.ttf";
const logoImage = "assets/logo/malaky.png";

// الألوان
const COLORS = {
  primary: "#C62828",
  secondary: "#2E7D32",
  lightGray: "#F5F5F5",
  darkGray: "#333333",
  borderGray: "#E0E0E0",
  white: "#FFFFFF"
};

export async function createInvoicePDF(order, outputPath) {
  const doc = new PDFDocument({ 
    size: "A4", 
    margin: 40,
    bufferPages: true
  });
  
  doc.registerFont("ArabicRegular", fontRegular);
  doc.registerFont("ArabicBold", fontBold);
  
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  let yPos = margin;

  // ===== الترويسة =====
  drawHeader(doc, pageWidth, margin, yPos);
  yPos += 120;

  // ===== معلومات الطلب والعميل =====
  yPos = drawOrderAndCustomerInfo(doc, order, margin, contentWidth, yPos);
  yPos += 30;

  // ===== جدول الأصناف =====
  yPos = drawItemsTable(doc, order.items, margin, contentWidth, yPos);
  yPos += 20;

  // ===== الإجمالي =====
  const total = calculateTotal(order.items);
  yPos = drawTotalSection(doc, total, margin, contentWidth, yPos);
  yPos += 30;

  // ===== QR Code =====
  await drawQRCode(doc, order.id, margin, pageHeight);

  // ===== الفوتر =====
  drawFooter(doc, pageWidth, pageHeight);

  // حفظ الملف
  doc.pipe(fs.createWriteStream(outputPath));
  doc.end();
}

// رسم الترويسة
function drawHeader(doc, pageWidth, margin, yPos) {
  // خلفية الترويسة
  doc.rect(0, 0, pageWidth, 100)
     .fill(COLORS.primary);
  
  // اللوجو
  try {
    doc.image(logoImage, margin, yPos + 10, { 
      width: 60,
      height: 60
    });
  } catch (e) {
    console.log("Logo not found, skipping...");
  }
  
  // عنوان الفاتورة
  doc.font("ArabicBold")
     .fontSize(28)
     .fillColor(COLORS.white)
     .text("فاتورة طلب", margin + 80, yPos + 25, {
        width: pageWidth - 160,
        align: "right"
     });
  
  // شريط زخرفي
  doc.rect(0, 100, pageWidth, 3)
     .fill(COLORS.secondary);
}

// رسم معلومات الطلب والعميل
function drawOrderAndCustomerInfo(doc, order, margin, contentWidth, yPos) {
  const boxHeight = 100;
  const boxWidth = (contentWidth - 20) / 2;
  
  // صندوق معلومات الطلب
  drawBox(doc, margin, yPos, boxWidth, boxHeight, COLORS.lightGray);
  
  doc.font("ArabicBold")
     .fontSize(14)
     .fillColor(COLORS.primary)
     .text("معلومات الطلب", margin + boxWidth - 10, yPos + 15, {
        width: boxWidth - 20,
        align: "right"
     });
  
  doc.font("ArabicRegular")
     .fontSize(12)
     .fillColor(COLORS.darkGray);
  
  doc.text(`رقم الطلب: #${order.id ?? "-"}`, margin + 10, yPos + 45, {
     width: boxWidth - 20,
     align: "right"
  });
  
  doc.text(`التاريخ: ${formatDate(order.date)}`, margin + 10, yPos + 70, {
     width: boxWidth - 20,
     align: "right"
  });
  
  // صندوق معلومات العميل
  const customerBoxX = margin + boxWidth + 20;
  drawBox(doc, customerBoxX, yPos, boxWidth, boxHeight, COLORS.lightGray);
  
  doc.font("ArabicBold")
     .fontSize(14)
     .fillColor(COLORS.primary)
     .text("معلومات العميل", customerBoxX + boxWidth - 10, yPos + 15, {
        width: boxWidth - 20,
        align: "right"
     });
  
  doc.font("ArabicRegular")
     .fontSize(11)
     .fillColor(COLORS.darkGray);
  
  const customerName = order.customer ?? "زبون التطبيق";
  const customerPhone = order.phone ?? "-";
  const customerAddress = order.address ?? "-";
  
  doc.text(`الاسم: ${customerName}`, customerBoxX + 10, yPos + 40, {
     width: boxWidth - 20,
     align: "right"
  });
  
  doc.text(`الهاتف: ${customerPhone}`, customerBoxX + 10, yPos + 60, {
     width: boxWidth - 20,
     align: "right"
  });
  
  doc.text(`العنوان: ${customerAddress}`, customerBoxX + 10, yPos + 80, {
     width: boxWidth - 20,
     align: "right",
     lineBreak: false,
     ellipsis: true
  });
  
  return yPos + boxHeight;
}

// رسم جدول الأصناف
function drawItemsTable(doc, items, margin, contentWidth, yPos) {
  const tableStartY = yPos;
  const rowHeight = 35;
  const headerHeight = 40;
  
  // عنوان الجدول
  doc.font("ArabicBold")
     .fontSize(16)
     .fillColor(COLORS.darkGray)
     .text("تفاصيل الطلب", margin, yPos, {
        width: contentWidth,
        align: "right"
     });
  
  yPos += 30;
  
  // رأس الجدول
  doc.rect(margin, yPos, contentWidth, headerHeight)
     .fill(COLORS.primary);
  
  doc.font("ArabicBold")
     .fontSize(12)
     .fillColor(COLORS.white);
  
  // عرض الأعمدة
  const cols = {
    item: contentWidth * 0.25,
    qty: contentWidth * 0.12,
    price: contentWidth * 0.18,
    notes: contentWidth * 0.25,
    total: contentWidth * 0.20
  };
  
  let xPos = margin + contentWidth;
  
  // الصنف
  xPos -= cols.item;
  doc.text("الصنف", xPos, yPos + 12, { 
    width: cols.item - 10,
    align: "right" 
  });
  
  // الكمية
  xPos -= cols.qty;
  doc.text("الكمية", xPos, yPos + 12, { 
    width: cols.qty,
    align: "center" 
  });
  
  // السعر
  xPos -= cols.price;
  doc.text("السعر", xPos, yPos + 12, { 
    width: cols.price,
    align: "center" 
  });
  
  // الملاحظات
  xPos -= cols.notes;
  doc.text("ملاحظات", xPos, yPos + 12, { 
    width: cols.notes,
    align: "center" 
  });
  
  // الإجمالي
  xPos -= cols.total;
  doc.text("الإجمالي", xPos + 10, yPos + 12, { 
    width: cols.total - 10,
    align: "left" 
  });
  
  yPos += headerHeight;
  
  // صفوف الأصناف
  items.forEach((item, index) => {
    const rowTotal = item.qty * item.price;
    const bgColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    
    doc.rect(margin, yPos, contentWidth, rowHeight)
       .fill(bgColor)
       .stroke(COLORS.borderGray);
    
    doc.font("ArabicRegular")
       .fontSize(11)
       .fillColor(COLORS.darkGray);
    
    xPos = margin + contentWidth;
    
    // الصنف
    xPos -= cols.item;
    doc.text(item.name, xPos + 5, yPos + 10, { 
      width: cols.item - 15,
      align: "right",
      lineBreak: false,
      ellipsis: true
    });
    
    // الكمية
    xPos -= cols.qty;
    doc.text(item.qty.toString(), xPos, yPos + 10, { 
      width: cols.qty,
      align: "center" 
    });
    
    // السعر
    xPos -= cols.price;
    doc.text(`${item.price.toFixed(2)} ₪`, xPos, yPos + 10, { 
      width: cols.price,
      align: "center" 
    });
    
    // الملاحظات
    xPos -= cols.notes;
    const notes = item.notes ?? "-";
    doc.text(notes, xPos + 5, yPos + 10, { 
      width: cols.notes - 10,
      align: "center",
      lineBreak: false,
      ellipsis: true
    });
    
    // الإجمالي
    xPos -= cols.total;
    doc.font("ArabicBold")
       .fillColor(COLORS.secondary)
       .text(`${rowTotal.toFixed(2)} ₪`, xPos + 10, yPos + 10, { 
          width: cols.total - 10,
          align: "left" 
       });
    
    yPos += rowHeight;
  });
  
  return yPos;
}

// رسم قسم الإجمالي
function drawTotalSection(doc, total, margin, contentWidth, yPos) {
  const boxWidth = 250;
  const boxHeight = 80;
  const boxX = margin + contentWidth - boxWidth;
  
  drawBox(doc, boxX, yPos, boxWidth, boxHeight, COLORS.lightGray);
  
  doc.font("ArabicBold")
     .fontSize(14)
     .fillColor(COLORS.darkGray)
     .text("الإجمالي الكلي:", boxX + 10, yPos + 20, {
        width: boxWidth - 20,
        align: "right"
     });
  
  doc.font("ArabicBold")
     .fontSize(24)
     .fillColor(COLORS.secondary)
     .text(`${total.toFixed(2)} ₪`, boxX + 10, yPos + 45, {
        width: boxWidth - 20,
        align: "right"
     });
  
  return yPos + boxHeight;
}

// رسم QR Code
async function drawQRCode(doc, orderId, margin, pageHeight) {
  try {
    const qrData = await QRCode.toDataURL(`order:${orderId}`);
    const qrSize = 80;
    const qrY = pageHeight - 150;
    
    doc.image(qrData, margin, qrY, { 
      width: qrSize,
      height: qrSize
    });
    
    doc.font("ArabicRegular")
       .fontSize(9)
       .fillColor(COLORS.darkGray)
       .text("امسح للتحقق", margin, qrY + qrSize + 5, {
          width: qrSize,
          align: "center"
       });
  } catch (e) {
    console.log("QR Code generation failed:", e);
  }
}

// رسم الفوتر
function drawFooter(doc, pageWidth, pageHeight) {
  const footerHeight = 50;
  const footerY = pageHeight - footerHeight;
  
  doc.rect(0, footerY, pageWidth, footerHeight)
     .fill(COLORS.primary);
  
  doc.font("ArabicBold")
     .fontSize(14)
     .fillColor(COLORS.white)
     .text("شكراً لاختياركم مطعم ملكي بروست!", 0, footerY + 12, {
        width: pageWidth,
        align: "center"
     });
  
  doc.font("ArabicRegular")
     .fontSize(10)
     .fillColor("rgba(255, 255, 255, 0.9)")
     .text("نتطلع لخدمتكم مرة أخرى | هاتف: 1234-567-890", 0, footerY + 32, {
        width: pageWidth,
        align: "center"
     });
}

// دوال مساعدة
function drawBox(doc, x, y, width, height, color) {
  doc.roundedRect(x, y, width, height, 5)
     .fill(color)
     .stroke(COLORS.borderGray);
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
}

function formatDate(dateString) {
  const d = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return d.toLocaleDateString('ar-EG', options);
}