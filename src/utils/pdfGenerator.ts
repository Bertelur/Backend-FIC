import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SuratJalanItem {
  quantity: string;
  name: string;
  price: string;
  total: string;
}

interface SuratJalanData {
  date: string;
  recipientName: string;
  recipientAddress: string;
  items: SuratJalanItem[];
  grandTotal: string;
}

// Convert image to base64
const imageToBase64 = (imagePath: string): string => {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).slice(1);
  return `data:image/${ext};base64,${base64}`;
};

// Generate HTML template for Surat Jalan
const generateSuratJalanHTML = (data: SuratJalanData): string => {
  const projectRoot = path.resolve(__dirname, "../../");
  const logo1Base64 = imageToBase64(path.join(projectRoot, "logo1.png"));
  const logo2Base64 = imageToBase64(path.join(projectRoot, "logo2.png"));
  const ttdBase64 = imageToBase64(path.join(projectRoot, "ttd.png"));

  const itemsHTML = data.items
    .map(
      (item) => `
    <tr>
      <td>${item.quantity}</td>
      <td>${item.name}</td>
      <td>${item.price}</td>
      <td>${item.total}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Surat Jalan</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      margin: 0;
      padding: 0;
    }

    body {
      padding: 15px;
    }

    .main-content {
    }

    .surat-jalan-title {
      font-size: 28px;
      font-weight: bold;
      margin-top: 15px;
    }

    .logo-container {
      display: flex;
      justify-content: space-between;
    }

    .logo-1 {
      margin-top: 10px;
      height: 30px;
    }

    .logo-2 {
      margin-left: 10px;
      height: 30px;
    }

    .address {
      width: 180px;
      font-size: 9px;
      line-height: 1.4;
    }
    .info-section .yth{
      margin-top: 10px;
    }

    .info-section h3 {
      font-size: 10px;
      margin-bottom: 3px;
    }

    .info-section h3 span {
      font-weight: normal;
    }

    /* Table Styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 9px;
    }

    thead th {
      background-color: #3DB4EA;
      color: black;
      padding: 8px 10px;
      text-align: left;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 8px;
    }

    thead th:first-child {
      width: 80px;
    }

    thead th:nth-child(2) {
      width: 120px;
    }

    thead th:nth-child(3),
    thead th:nth-child(4) {
      width: 80px;
    }

    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid #e0e0e0;
    }

    /* Footer Section */
    .footer-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 20px;
      margin-top: 200px;
    }

    .signature-section {
      text-align: left;
    }

    .signature-section h4 {
      font-size: 10px;
      margin-bottom: 5px;
      font-weight: bold;
    }

    .signature-section img {
      max-width: 100px;
    }

    .total-section {
      display: flex;
      align-items: center;
      border: 1px solid #e0e0e0;
    }

    .total-label {
      background-color: #3DB4EA;
      color: black;
      padding: 10px 15px;
      font-weight: bold;
      font-size: 10px;
    }

    .total-value {
      padding: 10px 15px;
      font-size: 10px;
      font-weight: 500;
    }
  </style>
</head>

<body>
  <div class="main-content">
    <div class="logo-container">
      <div class="logo">
        <img src="${logo1Base64}" class="logo-1" alt="Gudang Jawa Barat">
        <img src="${logo2Base64}" class="logo-2" alt="PT. Fahmi Jaya Internasional">
        <div>
          <h1 class="surat-jalan-title">Surat Jalan</h1>
        </div>
      </div>

      <div class="info-section">
        <h3>Tanggal: <span>${data.date}</span></h3>
        <h3 class="yth">Yth</h3>
        <p class="address">Kepada ${data.recipientName}<br>${data.recipientAddress}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th></th>
          <th>NAMA PESANAN</th>
          <th>HARGA (RP)</th>
          <th>JUMLAH (RP)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>
  </div>

  <!-- Footer Section -->
  <div class="footer-section">
    <div class="signature-section">
      <h4>HORMAT KAMI</h4>
      <img src="${ttdBase64}" alt="Tanda Tangan">
    </div>

    <div class="total-section">
      <div class="total-label">JUMLAH RP</div>
      <div class="total-value">Rp. ${data.grandTotal}</div>
    </div>
  </div>
</body>
</html>
`;
};

// Generate PDF from HTML
export const generateSuratJalanPDF = async (
  data: SuratJalanData
): Promise<Buffer> => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const htmlContent = generateSuratJalanHTML(data);

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    // A5 size: 148mm x 210mm
    const pdfBuffer = await page.pdf({
      format: "A5",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};

// Export types
export type { SuratJalanData, SuratJalanItem };
