import Spinner from '../ui/Spinner';

const PROCESSING_STATUSES = ['PENDING', 'CAPACITY_HELD', 'PAYMENT_PENDING', 'CONFIRMING'];

const messages = {
  PENDING: 'Creating shipment booking…',
  CAPACITY_HELD: 'Selected capacity reserved, awaiting payment…',
  PAYMENT_PENDING: 'Waiting for payment confirmation…',
  CONFIRMING: 'Payment received, confirming shipment booking…',
};

export default function BookingStatusPoller({ status }) {
  if (!PROCESSING_STATUSES.includes(status)) return null;

  return (
    <div className="booking-detail-processing" role="status" aria-live="polite" aria-atomic="true">
      <Spinner size="sm" />
      <div>
        <p>{messages[status] || 'Processing shipment booking…'}</p>
        <small>This page updates automatically.</small>
      </div>
    </div>
  );
}
