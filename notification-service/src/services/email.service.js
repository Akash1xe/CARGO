const sgMail = require('@sendgrid/mail');
const logger = require('../config/logger');
const { config } = require('../config');
const {
     getOtpTemplate,
     getWelcomeTemplate,
     getShipmentConfirmedTemplate,
     getShipmentFailedTemplate,
     getShipmentCancelledTemplate,
} = require('../templates');

sgMail.setApiKey(config.SENDGRID_API_KEY);

class EmailService {
     constructor() {
          this.from = config.MAIL_SEND;
          this.maxRetries = 3;
     }

     async sendWithRetry(msg, retries = 0) {
          try {
               await sgMail.send(msg);
               logger.info(`Email sent successfully to ${msg.to}`, { subject: msg.subject, attempt: retries + 1 });
               return { success: true };
          } catch (error) {
               logger.error(`Email sending failed (attempt ${retries + 1}/${this.maxRetries})`, {
                    to: msg.to, error: error.message, code: error.code,
               });
               if (retries < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
                    return this.sendWithRetry(msg, retries + 1);
               }
               throw error;
          }
     }

     sendOtpEmail(email, otp, ttlMinutes) {
          return this.sendWithRetry({
               to: email, from: this.from, subject: 'Your CargoFlow verification code',
               html: getOtpTemplate(otp, ttlMinutes),
          });
     }

     sendWelcomeEmail(email, firstName) {
          return this.sendWithRetry({
               to: email, from: this.from, subject: 'Welcome to CargoFlow',
               html: getWelcomeTemplate(firstName),
          });
     }

     sendShipmentConfirmedEmail(email, data) {
          return this.sendWithRetry({
               to: email, from: this.from,
               subject: `Shipment Confirmed - ${data.trackingNumber}`,
               html: getShipmentConfirmedTemplate(data),
          });
     }

     sendShipmentFailedEmail(email, data) {
          return this.sendWithRetry({
               to: email, from: this.from,
               subject: `Shipment Could Not Be Confirmed - ${data.trackingNumber}`,
               html: getShipmentFailedTemplate(data),
          });
     }

     sendShipmentCancelledEmail(email, data) {
          return this.sendWithRetry({
               to: email, from: this.from,
               subject: `Shipment Cancelled - ${data.trackingNumber}`,
               html: getShipmentCancelledTemplate(data),
          });
     }
}

module.exports = new EmailService();
