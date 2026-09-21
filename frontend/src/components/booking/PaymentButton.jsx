import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useBookingStore } from '../../store/booking.store';
import { bookingApi } from '../../api/booking.api';
import { loadRazorpayScript, openRazorpayCheckout } from '../../utils/razorpay';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';

export default function PaymentButton({ packages, tripId, capacityUnitIds, disabled }) {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const reset = useBookingStore((s) => s.reset);
  const fromStation = useBookingStore((s) => s.fromStation);  // --- SEGMENT BOOKING
  const toStation = useBookingStore((s) => s.toStation);      // --- SEGMENT BOOKING
  const navigate = useNavigate();
  const showToast = useToast();

  const handlePay = async () => {
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      // --- SEGMENT BOOKING: Include fromStation/toStation segment params ---
      const res = await bookingApi.createShipment({
        tripId,
        capacityUnitIds,
        packages,
        idempotencyKey,
        fromHubId: fromStation?.hubId,
        toHubId: toStation?.hubId,
        fromSeq: fromStation?.sequenceNumber,
        toSeq: toStation?.sequenceNumber,
      });
      const booking = res.data || res;
      const shipmentBookingId = booking.shipmentBookingId;
      const paymentOrder = booking.paymentOrder;

      if (!paymentOrder?.gatewayOrderId) {
        showToast('Shipment booking created but payment order is missing', 'warning');
        navigate(`/bookings/${shipmentBookingId}`);
        return;
      }

      await loadRazorpayScript();

      openRazorpayCheckout({
        keyId: paymentOrder.keyId,
        orderId: paymentOrder.gatewayOrderId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || 'INR',
        bookingDescription: `Cargo Shipment Booking ${shipmentBookingId}`,
        user,
        onSuccess: async (response) => {
          try {
            await bookingApi.verifyPayment(shipmentBookingId, {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            showToast('Payment verified! Confirming shipment booking...', 'success');
          } catch (err) {
            showToast('Payment received. Confirmation may take a moment.', 'warning');
          }
          reset();
          navigate(`/bookings/${shipmentBookingId}`);
        },
        onDismiss: () => {
          showToast('Payment cancelled. Review the shipment booking status for next steps.', 'warning');
          reset();
          navigate(`/bookings/${shipmentBookingId}`);
        },
        onFailure: (response) => {
          showToast('Payment failed: ' + (response?.error?.description || 'Unknown error'), 'error');
          reset();
          navigate(`/bookings/${shipmentBookingId}`);
        },
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Shipment booking failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" onClick={handlePay} loading={loading} disabled={disabled} className="booking-payment-button">
      Confirm & Pay <span aria-hidden="true">→</span>
    </Button>
  );
}
