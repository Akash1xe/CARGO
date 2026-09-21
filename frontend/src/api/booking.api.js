import client from './client';

export const bookingApi = {
  createShipment: (data) => client.post('/shipments/shipments', data).then((r) => r.data),

  listShipments: (status, page = 1, limit = 10) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    qs.set('page', page);
    qs.set('limit', limit);
    return client.get(`/shipments/shipments?${qs.toString()}`).then((r) => r.data);
  },

  getShipmentById: (id) => client.get(`/shipments/shipments/${id}`).then((r) => r.data),

  verifyPayment: (id, data) => client.post(`/shipments/shipments/${id}/verify-payment`, data).then((r) => r.data),

  cancelShipment: (id) => client.post(`/shipments/shipments/${id}/cancel`).then((r) => r.data),
};
