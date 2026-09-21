import PassengerForm from './PassengerForm';

export default function PassengerList({ seats, register, errors }) {
  return (
    <section className="booking-contact-section" aria-labelledby="package-details-heading">
      <header>
        <h2 id="package-details-heading">Package Details</h2>
        <p>Provide one package record for each selected capacity unit.</p>
      </header>
      <div className="booking-contact-list">
        {seats.map((seat, index) => (
          <PassengerForm key={seat.seatId} index={index} seat={seat} register={register} errors={errors} />
        ))}
      </div>
    </section>
  );
}
