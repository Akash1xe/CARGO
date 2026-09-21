const { config } = require('../config');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return escapeHtml(date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }));
};

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toFixed(2)}` : 'Not provided';
};

const layout = (title, content) => `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 10px; background: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #4A3AFF; margin: 0;">CargoFlow</h2>
      <p style="color: #555; margin: 8px 0 0;">${escapeHtml(title)}</p>
    </div>
    ${content}
    <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
    <p style="font-size: 14px; color: #888; text-align: center;"><strong>Team CargoFlow</strong></p>
  </div>`;

function getOtpTemplate(otp, ttlMinutes) {
  return layout('Account verification', `
    <p style="font-size: 16px; color: #333;">Use this verification code to continue:</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="display: inline-block; padding: 14px 26px; font-size: 32px; letter-spacing: 8px; font-weight: bold; background: #F4F4FF; border-radius: 8px; color: #4A3AFF; border: 1px solid #e0e0ff;">${escapeHtml(otp)}</span>
    </div>
    <p style="font-size: 15px; color: #555;">This code expires in <strong>${escapeHtml(ttlMinutes)} minutes</strong>.</p>
    <p style="font-size: 15px; color: #555;">If you did not request this code, do not share it and safely ignore this message.</p>`);
}

function getWelcomeTemplate(firstName) {
  const loginUrl = `${config.FRONTEND_URL || ''}/login`;
  return layout('Welcome to CargoFlow', `
    <p style="font-size: 16px; color: #333;">Hi <strong>${escapeHtml(firstName)}</strong>,</p>
    <p style="font-size: 16px; color: #333;">Your account is ready. You can search intercity transport routes and create cargo shipments.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${escapeHtml(loginUrl)}" style="display: inline-block; padding: 12px 22px; background: #4A3AFF; color: white; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 6px;">Log in to CargoFlow</a>
    </div>
    <p style="font-size: 15px; color: #555;">If you did not create this account, contact support immediately.</p>`);
}

function getShipmentConfirmedTemplate(data = {}) {
  const capacityUnits = Array.isArray(data.capacityUnits) ? data.capacityUnits : [];
  const packages = Array.isArray(data.packages) ? data.packages : [];
  const unitRows = capacityUnits.length
    ? capacityUnits.map(unit => `<li style="margin: 5px 0;">Unit ${escapeHtml(unit.unitNumber)} — ${escapeHtml(unit.unitType)} (${formatMoney(unit.price)}, max ${escapeHtml(unit.maxWeightKg)} kg)</li>`).join('')
    : '<li style="margin: 5px 0;">No capacity-unit details provided.</li>';
  const packageRows = packages.length
    ? packages.map(item => `<li style="margin: 5px 0;">${escapeHtml(item.description)} — ${escapeHtml(item.category)}, ${escapeHtml(item.weightKg)} kg</li>`).join('')
    : '<li style="margin: 5px 0;">No package details provided.</li>';

  return layout('Shipment confirmed', `
    <p style="font-size: 16px; color: #333;">Hi ${data.firstName ? `<strong>${escapeHtml(data.firstName)}</strong>` : 'there'},</p>
    <p style="font-size: 16px; color: #333;">Your cargo shipment has been confirmed.</p>
    <div style="background: #F4F4FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Tracking number:</strong> ${escapeHtml(data.trackingNumber)}</p>
      <p style="margin: 5px 0;"><strong>Shipment booking ID:</strong> ${escapeHtml(data.shipmentBookingId)}</p>
      <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${escapeHtml(data.vehicleName)} (${escapeHtml(data.vehicleNumber)})</p>
    </div>
    <p style="margin: 8px 0;"><strong>Origin hub:</strong> ${escapeHtml(data.fromHubName || 'Not provided')}</p>
    <p style="margin: 8px 0;"><strong>Destination hub:</strong> ${escapeHtml(data.toHubName || 'Not provided')}</p>
    <p style="margin: 8px 0;"><strong>Departure date:</strong> ${formatDate(data.departureDate)}</p>
    <p style="margin: 8px 0;"><strong>Amount paid:</strong> ${formatMoney(data.totalAmount)}</p>
    <h3 style="color: #333;">Capacity units</h3><ul>${unitRows}</ul>
    <h3 style="color: #333;">Packages</h3><ul>${packageRows}</ul>`);
}

const FAILURE_REASON_MESSAGES = {
  payment_failed: 'The payment could not be completed.',
  capacity_confirmation_failed: 'Payment was received, but the requested cargo capacity could not be confirmed.',
  shipment_timeout: 'The shipment request expired before the process was completed.',
  cargo_trip_cancelled: 'The selected cargo trip was cancelled.',
};

function getShipmentFailedTemplate(data = {}) {
  const friendlyReason = FAILURE_REASON_MESSAGES[data.reason] || 'The shipment could not be confirmed.';
  const refundGuidance = ['capacity_confirmation_failed', 'cargo_trip_cancelled'].includes(data.reason)
    ? 'If payment was captured, a refund will be returned to the original payment method. Processing times depend on your payment provider.'
    : 'If an amount was debited, it will be returned according to your payment provider’s processing times.';
  return layout('Shipment could not be confirmed', `
    <p style="font-size: 16px; color: #333;">Hi ${data.firstName ? `<strong>${escapeHtml(data.firstName)}</strong>` : 'there'},</p>
    <div style="background: #F4F4FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Tracking number:</strong> ${escapeHtml(data.trackingNumber)}</p>
      <p style="margin: 5px 0;"><strong>Shipment booking ID:</strong> ${escapeHtml(data.shipmentBookingId)}</p>
      <p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(friendlyReason)}</p>
    </div>
    <p style="font-size: 15px; color: #555;">${escapeHtml(refundGuidance)}</p>`);
}

const CANCELLATION_REASON_MESSAGES = {
  user_cancelled: 'You requested this cancellation.',
  cargo_trip_cancelled: 'The selected cargo trip was cancelled.',
  shipment_compensation: 'The shipment was cancelled while compensating an incomplete workflow.',
};

function getShipmentCancelledTemplate(data = {}) {
  const friendlyReason = CANCELLATION_REASON_MESSAGES[data.reason] || 'The shipment has been cancelled.';
  const refundAmount = Number(data.refundAmount) || 0;
  const refundText = refundAmount > 0
    ? `A refund of ${formatMoney(refundAmount)} has been initiated. It is normally processed to the original payment method within 5–7 business days.`
    : 'No refund amount was recorded for this cancellation.';
  return layout('Shipment cancelled', `
    <p style="font-size: 16px; color: #333;">Hi ${data.firstName ? `<strong>${escapeHtml(data.firstName)}</strong>` : 'there'},</p>
    <div style="background: #F4F4FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Tracking number:</strong> ${escapeHtml(data.trackingNumber)}</p>
      <p style="margin: 5px 0;"><strong>Shipment booking ID:</strong> ${escapeHtml(data.shipmentBookingId)}</p>
      <p style="margin: 5px 0;"><strong>Cancellation reason:</strong> ${escapeHtml(friendlyReason)}</p>
      <p style="margin: 5px 0;"><strong>Refund amount:</strong> ${formatMoney(refundAmount)}</p>
    </div>
    <p style="font-size: 15px; color: #555;">${refundText}</p>`);
}

module.exports = {
  escapeHtml,
  getOtpTemplate,
  getWelcomeTemplate,
  getShipmentConfirmedTemplate,
  getShipmentFailedTemplate,
  getShipmentCancelledTemplate,
};
