import client from './client';

export const inventoryApi = {
  getAvailability: (tripId) =>
    client.get(`/inventory/trips/${tripId}/availability`).then((r) => r.data),

  getCapacityUnits: (tripId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.unitType || params.seatType) qs.set('unitType', params.unitType || params.seatType);
    if (params.fromSeq) qs.set('fromSeq', params.fromSeq);  // --- SEGMENT BOOKING
    if (params.toSeq) qs.set('toSeq', params.toSeq);        // --- SEGMENT BOOKING
    const qStr = qs.toString();
    return client.get(`/inventory/trips/${tripId}/capacity-units${qStr ? '?' + qStr : ''}`).then((r) => r.data);
  },
};
