import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Gmail with TLS uses false here
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async (to, subject, bodyContent) => {
  const htmlTemplate = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .container {
      width: 100%;
      max-width: 600px;
      margin: auto;
      background: #ffffff;
      padding: 20px;
      box-sizing: border-box;
    }
    h2 { color: #333; font-size: 20px; }
    p { font-size: 16px; color: #555; }
    .btn {
      display: inline-block;
      background-color: #4CAF50;
      color: #fff;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
  </style>
  </head>
  <body>
    <div class="container">
      ${bodyContent}
    </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: `"D&S" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlTemplate,
  };

  await transporter.sendMail(mailOptions);
};
