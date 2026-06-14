# Salon booking in EverittOS

EverittOS should support salons, barbers, chair rentals, cleaners, contractors, consultants, and other appointment businesses with one services and bookings system.

## Product direction

Use EverittOS-owned booking screens for the customer experience, then use Google Calendar in the background for calendar blocking and conflict checks.

Do not make the main experience a Google iframe. The public booking page should feel branded, mobile-first, and premium.

## Core flow

1. Workspace creates services with name, category, duration, price, description, and active status.
2. Workspace assigns services to workers or stylists.
3. Workspace sets bookable hours, buffer time, and max daily bookings per worker.
4. Client opens `/book/[workspaceSlug]`.
5. Client chooses service, staff or any available, date, time, and contact details.
6. EverittOS checks existing bookings and connected Google Calendar events.
7. EverittOS saves the booking and creates the Google Calendar event.
8. Later enhancement: Stripe deposit, cancellation link, reschedule link, and reminders.

## Data model

Recommended tables:

- `services`
- `staff_services`
- `staff_availability`
- `bookings`

Recommended booking fields:

- workspace or organization id
- service id
- worker id
- customer id
- client name
- client email
- client phone
- starts at
- ends at
- status
- notes
- source
- Google Calendar event id
- cancel token
- reschedule token

## Required checks

Before confirming a booking, the server must check:

- selected service is active
- selected worker is bookable for that service
- requested time is inside worker availability
- requested time does not overlap another booking
- requested time does not overlap Google Calendar busy time
- workspace exists and is bookable

## UI notes

Use the existing EverittOS app style: warm white surfaces, slate borders, navy accent actions, spacious cards, mobile-first forms, readable type, clear confirmation states, and no crowded booking grids.
