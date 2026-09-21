import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useBookingStore } from '../store/booking.store';
import BookingSummary from '../components/booking/BookingSummary';
import ShipmentRouteSummary from '../components/booking/ShipmentRouteSummary';
import PassengerList from '../components/booking/PassengerList';
import PaymentButton from '../components/booking/PaymentButton';

export default function BookingPage() {
  const navigate = useNavigate();
  const selectedTrain = useBookingStore((s) => s.selectedTrain);
  const selectedSeats = useBookingStore((s) => s.selectedSeats);
  const scheduleId = useBookingStore((s) => s.scheduleId);

  const seats = useMemo(() => Array.from(selectedSeats.values()), [selectedSeats]);
  const seatIds = useMemo(() => seats.map((unit) => unit.seatId), [seats]);
  const totalPrice = useMemo(() => seats.reduce((sum, unit) => sum + (unit.price || 0), 0), [seats]);
  const departureDate = selectedTrain?.trip?.departureDate || selectedTrain?.schedule?.departureDate || selectedTrain?.departureDate;

  const { register, handleSubmit, formState: { errors, isValid }, getValues } = useForm({
    mode: 'onChange',
  });

  useEffect(() => {
    if (seats.length === 0) navigate('/search');
  }, [seats.length, navigate]);

  if (seats.length === 0) return null;

  return (
    <main className="booking-page">
      <div className="editorial-shell">
        <nav className="booking-breadcrumb" aria-label="Breadcrumb">
          {scheduleId ? <Link to={`/seats/${scheduleId}`}>Select Capacity</Link> : <span>Select Capacity</span>}
          <span aria-hidden="true">/</span><span>Complete Booking</span>
        </nav>
        <h1>Complete Your Shipment Booking.</h1>

        <ol className="booking-progress" aria-label="Shipment booking progress">
          <li><span>1</span><strong>Capacity</strong></li>
          <li className="is-current" aria-current="step"><span>2</span><strong>Details</strong></li>
          <li><span>3</span><strong>Payment</strong></li>
        </ol>

        <div className="booking-layout">
          <div className="booking-main-column">
            <ShipmentRouteSummary train={selectedTrain} seats={seats} departureDate={departureDate} />
            <form id="shipment-booking-form" className="booking-contact-form" onSubmit={handleSubmit(() => {})} noValidate>
              <PassengerList seats={seats} register={register} errors={errors} />
            </form>
          </div>

          <BookingSummary train={selectedTrain} seats={seats} totalPrice={totalPrice} departureDate={departureDate}>
            <PaymentButton
              packages={getValues('packages') || []}
              tripId={scheduleId}
              capacityUnitIds={seatIds}
              disabled={!isValid}
            />
          </BookingSummary>
        </div>
      </div>
    </main>
  );
}
