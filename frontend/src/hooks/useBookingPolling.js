import { useState, useEffect, useRef, useCallback } from 'react';
import { bookingApi } from '../api/booking.api';

const TERMINAL_STATUSES = ['CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED'];
const POLL_INTERVAL = 3000;
const MAX_POLLS = 20;

export function useBookingPolling(bookingId) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollCount = useRef(0);
  const intervalRef = useRef(null);
  const generationRef = useRef(0);

  const fetchBooking = useCallback(async (generation = generationRef.current) => {
    try {
      const res = await bookingApi.getShipmentById(bookingId);
      if (generation !== generationRef.current) return;
      const data = Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res;
      if (!data) {
        setBooking(null);
        setError(null);
        setLoading(false);
        clearInterval(intervalRef.current);
        return;
      }
      setBooking(data);
      setError(null);
      setLoading(false);

      if (TERMINAL_STATUSES.includes(data.status)) {
        clearInterval(intervalRef.current);
        return;
      }

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(intervalRef.current);
      }
    } catch (err) {
      if (generation !== generationRef.current) return;
      setBooking(null);
      setError(err.message);
      setLoading(false);
      clearInterval(intervalRef.current);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    pollCount.current = 0;
    setLoading(true);
    const interval = setInterval(() => fetchBooking(generation), POLL_INTERVAL);
    intervalRef.current = interval;
    fetchBooking(generation);
    return () => {
      clearInterval(interval);
      if (intervalRef.current === interval) intervalRef.current = null;
    };
  }, [bookingId, fetchBooking]);

  const refresh = () => fetchBooking();

  return { booking, loading, error, refresh };
}
