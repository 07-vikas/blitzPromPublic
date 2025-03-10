const nodemailer = require('nodemailer');

// Create a transporter using Gmail's SMTP server
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '2023uee1511@mnit.ac.in', // Replace with your Gmail address
        pass: 'enthusiast',   // Replace with your App Password
    },
});

// Function to send an email
async function sendEmail(to, subject, text) {
    try {
        const mailOptions = {
            from: '2023uee1511@mnit.ac.in', // Your email address
            to: '2023uee2010@mnit.ac.in',   // Recipient's email address
            subject: "otp testing hi .....",             // Subject line
            text: "Hey, how's you man ?",                   // Email body
        };

        const info = await transporter.sendMail(mailOptions);
        console.log( info);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Example usage
sendEmail(
    'recipient-email@gmail.com', // Replace with the recipient's email
    'Test Email',
    'This is a test email from Nodemailer!'
);
