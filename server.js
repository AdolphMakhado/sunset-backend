require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.post("/payfast/notify", async (req, res) => {
  try {
    const paymentStatus = req.body.payment_status;

    if (paymentStatus !== "COMPLETE") {
      return res.status(400).send("Payment not complete");
    }

    const name = req.body.name_first;
    const email = req.body.email_address;
    const paymentId = req.body.m_payment_id;

    const ticketNumber =
      "SAD-" + Math.floor(100000 + Math.random() * 900000);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            name,
            email,
            "",
            "Sunset Alfresco Ticket",
            1,
            ticketNumber,
            paymentId,
            new Date().toLocaleString(),
            "No",
          ],
        ],
      },
    });

    const qrCodeImage = await QRCode.toDataURL(ticketNumber);

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "🎟 Your Sunset Alfresco Ticket",
      html: `
        <h2>Booking Confirmed 🎉</h2>
        <p>Hello ${name},</p>
        <p>Your official ticket number:</p>
        <h3>${ticketNumber}</h3>
        <p>Please present this QR code at the entrance:</p>
        <img src="${qrCodeImage}" />
        <p>The secret location will be shared closer to the event date.</p>
      `,
    });

    console.log("Ticket created:", ticketNumber);
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
