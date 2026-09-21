import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../api/inventory.api';
import { useBookingStore } from '../store/booking.store';
import { useToast } from '../components/ui/Toast';
import AvailabilitySummary from '../components/seats/AvailabilitySummary';
import SeatFilters from '../components/seats/SeatFilters';
import SeatGrid from '../components/seats/SeatGrid';
import SeatLegend from '../components/seats/SeatLegend';
import SelectionSummary from '../components/seats/SelectionSummary';
import Spinner from '../components/ui/Spinner';
import { MAX_SEATS_PER_BOOKING } from '../utils/constants';

const normalizeCapacityUnit = (unit) => ({
  ...unit,
  seatId: unit.seatId ?? unit.capacityUnitId ?? unit.id,
  seatNumber: unit.seatNumber ?? unit.unitNumber,
  seatType: unit.seatType ?? unit.unitType,
});

export default function SeatSelectionPage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const selectedTrain = useBookingStore((s) => s.selectedTrain);
  const selectedSeats = useBookingStore((s) => s.selectedSeats);
  const toggleSeat = useBookingStore((s) => s.toggleSeat);
  const setSelectedTrain = useBookingStore((s) => s.setSelectedTrain);
  const fromStation = useBookingStore((s) => s.fromStation);
  const toStation = useBookingStore((s) => s.toStation);

  const [availability, setAvailability] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const seatParams = {};
        if (fromStation?.sequenceNumber && toStation?.sequenceNumber) {
          seatParams.fromSeq = fromStation.sequenceNumber;
          seatParams.toSeq = toStation.sequenceNumber;
        }

        const [availRes, seatsRes] = await Promise.all([
          inventoryApi.getAvailability(scheduleId),
          inventoryApi.getCapacityUnits(scheduleId, seatParams),
        ]);
        const rawAvail = availRes.data || availRes;
        const rawUnits = seatsRes.data?.capacityUnits
          || seatsRes.capacityUnits
          || seatsRes.data?.seats
          || seatsRes.seats
          || [];
        const seatList = rawUnits
          .map(normalizeCapacityUnit)
          .sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
        setSeats(seatList);

        // Segment status remains authoritative for the displayed availability totals.
        if (seatParams.fromSeq && seatParams.toSeq && seatList.some((unit) => unit.segmentStatus)) {
          const segAvail = seatList.filter((unit) => unit.segmentStatus === 'AVAILABLE').length;
          const segUnavail = seatList.filter((unit) => unit.segmentStatus === 'UNAVAILABLE').length;
          setAvailability({ ...rawAvail, available: segAvail, booked: segUnavail, locked: 0 });
        } else {
          setAvailability(rawAvail);
        }

        if (!selectedTrain) {
          setSelectedTrain({
            vehicleName: rawAvail.vehicleName,
            vehicleNumber: rawAvail.vehicleNumber,
            vehicleId: rawAvail.vehicleId,
            vehicleType: rawAvail.vehicleType,
            trainName: rawAvail.trainName || rawAvail.vehicleName,
            trainNumber: rawAvail.trainNumber || rawAvail.vehicleNumber,
            trainId: rawAvail.trainId || rawAvail.vehicleId,
          }, scheduleId);
        }
      } catch (err) {
        showToast(err.message || 'Failed to load cargo capacity', 'error');
        navigate('/search');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [scheduleId]);

  const handleToggleSeat = (seat) => {
    const result = toggleSeat(seat);
    if (result === false) {
      showToast(`Maximum ${MAX_SEATS_PER_BOOKING} capacity units can be selected`, 'warning');
    }
  };

  const typeCounts = useMemo(() => seats.reduce((counts, unit) => {
    if (unit.seatType) counts[unit.seatType] = (counts[unit.seatType] || 0) + 1;
    return counts;
  }, {}), [seats]);
  const capacityTypes = Object.keys(typeCounts);
  const filteredSeats = filter ? seats.filter((unit) => unit.seatType === filter) : seats;

  if (loading) {
    return (
      <main className="capacity-page capacity-loading" role="status" aria-live="polite">
        <Spinner size="lg" />
        <strong>Loading cargo capacity…</strong>
      </main>
    );
  }

  return (
    <main className="capacity-page">
      <div className="editorial-shell">
        <nav className="capacity-breadcrumb" aria-label="Breadcrumb">
          <Link to="/search">Search Results</Link><span aria-hidden="true">/</span><span>Select Capacity</span>
        </nav>
        <h1>Select Cargo Capacity.</h1>

        <AvailabilitySummary availability={availability} train={selectedTrain} />

        <div className="capacity-selection-layout">
          <section className="capacity-picker" aria-labelledby="capacity-picker-heading">
            <header className="capacity-picker-header">
              <h2 id="capacity-picker-heading">Choose Capacity Units</h2>
              <SeatLegend />
            </header>
            <div className="capacity-picker-body">
              <SeatFilters activeFilter={filter} onChange={setFilter} types={capacityTypes} counts={typeCounts} total={seats.length} />
              <SeatGrid seats={filteredSeats} selectedSeats={selectedSeats} onToggleSeat={handleToggleSeat} />
            </div>
          </section>

          <SelectionSummary />
        </div>
      </div>
    </main>
  );
}
