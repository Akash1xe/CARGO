import client from './client';

export const adminApi = {
  createHub: (data) => client.post('/admins/hubs/hub', data).then((r) => r.data),
  getHubs: (page = 1, limit = 20, search = '') => {
    let url = `/admins/hubs/hub?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return client.get(url).then((r) => r.data);
  },

  createVehicle: (data) => client.post('/admins/vehicles/vehicle', data).then((r) => r.data),
  getVehicles: () => client.get('/admins/vehicles/vehicle').then((r) => r.data),
  getVehicleById: (id) => client.get(`/admins/vehicles/vehicle/${id}`).then((r) => r.data),

  createTransportRoute: (data) => client.post('/admins/vehicles/route', data).then((r) => r.data),

  createTrip: (data) => client.post('/admins/trips/trip', data).then((r) => r.data),
  getTrips: (query = '') => client.get(`/admins/trips/trip${query ? '?' + query : ''}`).then((r) => r.data),
  cancelTrip: (id) => client.put(`/admins/trips/trip/${id}`).then((r) => r.data),
};
