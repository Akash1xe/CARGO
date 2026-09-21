require('dotenv').config();

const prisma = require('../src/config/prisma');
const hubService = require('../src/services/hub.service');
const vehicleService = require('../src/services/vehicle.service');
const tripService = require('../src/services/trip.service');
const adminProducer = require('../src/kafka/producer/admin.producer');
const { disconnectProducer } = require('../src/config/kafka');

const hubs = [
  { code: 'DEL01', name: 'Delhi Central Logistics Hub', city: 'Delhi', state: 'Delhi', address: 'NH 48, New Delhi', latitude: 28.6139, longitude: 77.2090 },
  { code: 'BOM01', name: 'Mumbai Freight Gateway', city: 'Mumbai', state: 'Maharashtra', address: 'JNPT Link Road, Navi Mumbai', latitude: 19.0760, longitude: 72.8777 },
  { code: 'BLR01', name: 'Bengaluru Cargo Exchange', city: 'Bengaluru', state: 'Karnataka', address: 'Tumakuru Road, Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  { code: 'MAA01', name: 'Chennai Logistics Terminal', city: 'Chennai', state: 'Tamil Nadu', address: 'Chennai–Bengaluru Highway', latitude: 13.0827, longitude: 80.2707 },
  { code: 'HYD01', name: 'Hyderabad Distribution Hub', city: 'Hyderabad', state: 'Telangana', address: 'Outer Ring Road, Hyderabad', latitude: 17.3850, longitude: 78.4867 },
  { code: 'CCU01', name: 'Kolkata Eastern Cargo Hub', city: 'Kolkata', state: 'West Bengal', address: 'Kona Expressway, Kolkata', latitude: 22.5726, longitude: 88.3639 },
  { code: 'PNQ01', name: 'Pune Logistics Park', city: 'Pune', state: 'Maharashtra', address: 'Chakan Industrial Area, Pune', latitude: 18.5204, longitude: 73.8567 },
  { code: 'AMD01', name: 'Ahmedabad Cargo Hub', city: 'Ahmedabad', state: 'Gujarat', address: 'Sarkhej–Gandhinagar Highway', latitude: 23.0225, longitude: 72.5714 },
  { code: 'JAI01', name: 'Jaipur Freight Centre', city: 'Jaipur', state: 'Rajasthan', address: 'Ajmer Road, Jaipur', latitude: 26.9124, longitude: 75.7873 },
  { code: 'LKO01', name: 'Lucknow Logistics Hub', city: 'Lucknow', state: 'Uttar Pradesh', address: 'Kanpur Road, Lucknow', latitude: 26.8467, longitude: 80.9462 },
  { code: 'STV01', name: 'Surat Textile Cargo Hub', city: 'Surat', state: 'Gujarat', address: 'Hazira Road, Surat', latitude: 21.1702, longitude: 72.8311 },
  { code: 'NAG01', name: 'Nagpur Central Freight Hub', city: 'Nagpur', state: 'Maharashtra', address: 'MIHAN Logistics Zone, Nagpur', latitude: 21.1458, longitude: 79.0882 },
];

const vehicles = [
  { number: 'CF-CT-1001', name: 'Western Freight Express', type: 'CLOSED_TRUCK', route: ['DEL01', 'JAI01', 'AMD01', 'BOM01'], distances: [0, 280, 940, 1470] },
  { number: 'CF-OT-1002', name: 'Aravalli Open Carrier', type: 'OPEN_TRUCK', route: ['DEL01', 'JAI01', 'STV01', 'BOM01'], distances: [0, 280, 1160, 1450] },
  { number: 'CF-RF-1003', name: 'FreshChain Reefer', type: 'REEFER_TRUCK', route: ['DEL01', 'AMD01', 'STV01', 'BOM01'], distances: [0, 950, 1210, 1490] },
  { number: 'CF-CN-1004', name: 'Northern Container Link', type: 'CONTAINER_TRUCK', route: ['DEL01', 'LKO01', 'CCU01'], distances: [0, 555, 1530] },
  { number: 'CF-RF-1005', name: 'Deccan Cold Chain', type: 'REEFER_TRUCK', route: ['BOM01', 'PNQ01', 'HYD01', 'BLR01'], distances: [0, 150, 710, 1280] },
  { number: 'CF-CN-1006', name: 'Southern Container Express', type: 'CONTAINER_TRUCK', route: ['MAA01', 'BLR01', 'PNQ01', 'BOM01'], distances: [0, 350, 1190, 1340] },
  { number: 'CF-CT-1007', name: 'East Coast Cargo Runner', type: 'CLOSED_TRUCK', route: ['CCU01', 'NAG01', 'HYD01', 'MAA01'], distances: [0, 1120, 1620, 2250] },
  { number: 'CF-CT-1008', name: 'Southwest Business Carrier', type: 'CLOSED_TRUCK', route: ['BOM01', 'PNQ01', 'BLR01', 'MAA01'], distances: [0, 150, 990, 1340] },
  { number: 'CF-OT-1009', name: 'Central India Heavy Haul', type: 'OPEN_TRUCK', route: ['AMD01', 'NAG01', 'CCU01'], distances: [0, 860, 1980] },
  { number: 'CF-CN-1010', name: 'Golden Quadrilateral Cargo', type: 'CONTAINER_TRUCK', route: ['DEL01', 'JAI01', 'AMD01', 'STV01', 'BOM01'], distances: [0, 280, 940, 1200, 1490] },
];

const unitBlueprint = [
  ['STANDARD', 2300, 1000], ['STANDARD', 2300, 1000], ['STANDARD', 2450, 1200],
  ['FRAGILE', 2900, 700], ['STANDARD', 2450, 1200], ['REFRIGERATED', 3500, 800],
  ['STANDARD', 2600, 1500], ['HAZARDOUS', 4200, 600], ['FRAGILE', 3100, 750],
  ['REFRIGERATED', 3700, 900], ['STANDARD', 2750, 1600], ['STANDARD', 2750, 1600],
];

const capacityUnitsFor = (vehicleIndex) => unitBlueprint.map(([unitType, price, maxWeightKg], index) => ({
  unitNumber: index + 1,
  unitType,
  price: price + vehicleIndex * 75,
  maxWeightKg,
}));

const formatDate = (date) => date.toISOString().slice(0, 10);

const routePayload = (route, vehicle) => ({ ...route, vehicle });

const tripPayload = (trip, vehicle) => ({
  tripId: trip.id,
  vehicleId: vehicle.id,
  vehicleNumber: vehicle.vehicleNumber,
  vehicleName: vehicle.vehicleName,
  vehicleType: vehicle.vehicleType,
  totalCapacityUnits: vehicle.totalCapacityUnits,
  departureDate: formatDate(trip.departureDate),
  status: trip.status,
  capacityUnits: vehicle.capacityUnits.map((unit) => ({
    capacityUnitId: unit.id,
    unitNumber: unit.unitNumber,
    unitType: unit.unitType,
    price: unit.price,
    maxWeightKg: unit.maxWeightKg,
  })),
  route: vehicle.transportRoute.routeHubs.map((routeHub) => ({
    hubId: routeHub.hub.id,
    hubName: routeHub.hub.name,
    hubCode: routeHub.hub.code,
    city: routeHub.hub.city,
    sequenceNumber: routeHub.sequenceNumber,
    arrivalTime: routeHub.arrivalTime,
    departureTime: routeHub.departureTime,
    distanceFromOriginKm: routeHub.distanceFromOriginKm,
  })),
});

async function ensureHub(definition) {
  const existing = await prisma.logisticsHub.findUnique({ where: { code: definition.code } });
  const hub = existing || await hubService.createHub(definition);
  if (existing) await adminProducer.publishHubCreated(hub);
  return hub;
}

async function ensureVehicle(definition, index) {
  let vehicle = await prisma.cargoVehicle.findUnique({
    where: { vehicleNumber: definition.number },
    include: { capacityUnits: { orderBy: { unitNumber: 'asc' } } },
  });
  if (!vehicle) {
    vehicle = await vehicleService.createVehicle({
      vehicleNumber: definition.number,
      vehicleName: definition.name,
      vehicleType: definition.type,
      capacityUnits: capacityUnitsFor(index),
    });
  }
  return vehicle;
}

async function ensureRoute(definition, vehicle, hubsByCode) {
  let route = await prisma.transportRoute.findUnique({
    where: { vehicleId: vehicle.id },
    include: { routeHubs: { include: { hub: true }, orderBy: { sequenceNumber: 'asc' } } },
  });
  if (!route) {
    route = await vehicleService.createTransportRoute({
      vehicleId: vehicle.id,
      hubs: definition.route.map((code, index) => ({
        hubId: hubsByCode.get(code).id,
        sequenceNumber: index + 1,
        arrivalTime: index === 0 ? null : `${String((7 + index * 4) % 24).padStart(2, '0')}:00`,
        departureTime: index === definition.route.length - 1 ? null : `${String((8 + index * 4) % 24).padStart(2, '0')}:00`,
        distanceFromOriginKm: definition.distances[index],
      })),
    });
  } else {
    const completeVehicle = await vehicleService.getVehicleById(vehicle.id);
    await adminProducer.publishTransportRouteCreated(routePayload(route, completeVehicle));
  }
  return route;
}

async function ensureTrips(vehicleId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = 0; offset < 14; offset += 1) {
    const departure = new Date(today);
    departure.setUTCDate(today.getUTCDate() + offset);
    const departureDate = formatDate(departure);
    const existing = await prisma.cargoTrip.findUnique({
      where: { vehicleId_departureDate: { vehicleId, departureDate: departure } },
    });
    if (!existing) {
      await tripService.createTrip({ vehicleId, departureDate });
    } else {
      const vehicle = await vehicleService.getVehicleById(vehicleId);
      await adminProducer.publishCargoTripCreated(tripPayload(existing, vehicle));
    }
  }
}

async function main() {
  const hubsByCode = new Map();
  for (const definition of hubs) {
    const hub = await ensureHub(definition);
    hubsByCode.set(hub.code, hub);
  }

  for (let index = 0; index < vehicles.length; index += 1) {
    const definition = vehicles[index];
    const vehicle = await ensureVehicle(definition, index);
    await ensureRoute(definition, vehicle, hubsByCode);
    await ensureTrips(vehicle.id);
    console.log(`Seeded ${definition.number}: ${definition.route.join(' -> ')}`);
  }

  const [hubCount, vehicleCount, routeCount, tripCount] = await Promise.all([
    prisma.logisticsHub.count(), prisma.cargoVehicle.count(), prisma.transportRoute.count(), prisma.cargoTrip.count(),
  ]);
  console.log(`CargoFlow demo catalog ready: ${hubCount} hubs, ${vehicleCount} vehicles, ${routeCount} routes, ${tripCount} trips.`);
}

main()
  .catch((error) => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectProducer().catch(() => {});
    await prisma.$disconnect();
  });
