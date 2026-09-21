# CargoFlow Domain Mapping

CargoFlow will convert the inherited railway-booking domain to an intercity logistics and cargo-capacity domain according to this mapping:

| Existing domain | Planned CargoFlow domain |
| --- | --- |
| Station | LogisticsHub |
| Train | CargoVehicle |
| Route | TransportRoute |
| RouteStop | RouteHub |
| Schedule | CargoTrip |
| Seat | CapacityUnit |
| Passenger | Package |
| Booking | ShipmentBooking |
| PNR/booking reference | TrackingNumber |
| Journey segment | Cargo route segment |
| Seat lock | Capacity reservation |

These domain conversions are planned, but they are not implemented as part of the CargoFlow foundation and project-level rebranding phase. Business-domain changes are delivered in later, service-specific phases without rewriting the existing architecture.
