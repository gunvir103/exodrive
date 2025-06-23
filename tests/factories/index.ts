import { generateTestId } from "../integration/test-helpers";

/**
 * Factory for creating test car data
 */
export const carFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: generateTestId("car"),
    name: "Test Vehicle",
    slug: "test-vehicle",
    brand: "TestBrand",
    model: "TestModel",
    year: 2024,
    base_price_per_day: 100,
    currency: "USD",
    availability_status: "available",
    hidden: false,
    features: ["Feature 1", "Feature 2"],
    images: ["https://example.com/image1.jpg"],
    passenger_capacity: 5,
    transmission: "automatic",
    fuel_type: "gasoline",
    min_rental_days: 1,
    max_rental_days: 30,
    security_deposit: 500,
    discount_weekly: 10,
    discount_monthly: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<any> = {}) => {
    return Array.from({ length: count }, (_, i) =>
      carFactory.build({
        name: `Test Vehicle ${i + 1}`,
        slug: `test-vehicle-${i + 1}`,
        ...overrides,
      })
    );
  },
};

/**
 * Factory for creating test customer data
 */
export const customerFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: generateTestId("customer"),
    email: `test-${Date.now()}@example.com`,
    first_name: "Test",
    last_name: "Customer",
    phone: "+1234567890",
    address: "123 Test Street",
    city: "Test City",
    state: "TC",
    country: "Test Country",
    postal_code: "12345",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  buildList: (count: number, overrides: Partial<any> = {}) => {
    return Array.from({ length: count }, (_, i) =>
      customerFactory.build({
        email: `test-${Date.now()}-${i}@example.com`,
        first_name: `Test${i + 1}`,
        last_name: `Customer${i + 1}`,
        ...overrides,
      })
    );
  },
};

/**
 * Factory for creating test booking data
 */
export const bookingFactory = {
  build: (overrides: Partial<any> = {}) => {
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const basePrice = 100;

    return {
      id: generateTestId("booking"),
      car_id: overrides.car_id || generateTestId("car"),
      customer_id: overrides.customer_id || generateTestId("customer"),
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      booking_days: days,
      total_price: basePrice * days,
      currency: "USD",
      security_deposit_amount: 500,
      discount_percentage: null,
      overall_status: "pending_payment",
      payment_status: "pending",
      contract_status: "not_sent",
      payment_id: null,
      paypal_order_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  },

  buildList: (count: number, overrides: Partial<any> = {}) => {
    return Array.from({ length: count }, (_, i) => {
      const startDate = new Date(
        Date.now() + (7 + i * 14) * 24 * 60 * 60 * 1000
      );
      const endDate = new Date(
        Date.now() + (10 + i * 14) * 24 * 60 * 60 * 1000
      );

      return bookingFactory.build({
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        ...overrides,
      });
    });
  },
};

/**
 * Factory for creating test payment data
 */
export const paymentFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: generateTestId("payment"),
    booking_id: overrides.booking_id || generateTestId("booking"),
    amount: 100,
    currency: "USD",
    status: "pending",
    provider: "paypal",
    paypal_order_id: null,
    paypal_authorization_id: null,
    paypal_capture_id: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
};

/**
 * Factory for creating test booking event data
 */
export const bookingEventFactory = {
  build: (overrides: Partial<any> = {}) => ({
    id: generateTestId("event"),
    booking_id: overrides.booking_id || generateTestId("booking"),
    event_type: "status_changed",
    timestamp: new Date().toISOString(),
    actor_type: "system",
    actor_id: null,
    actor_name: "System",
    summary_text: "Status changed",
    details: {},
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  buildList: (count: number, bookingId: string, overrides: Partial<any> = {}) => {
    const eventTypes = [
      "booking_created",
      "payment_authorized",
      "contract_sent",
      "contract_signed",
      "payment_captured",
    ];

    return Array.from({ length: count }, (_, i) => {
      const timestamp = new Date(Date.now() - (count - i) * 60 * 1000); // Events 1 minute apart

      return bookingEventFactory.build({
        booking_id: bookingId,
        event_type: eventTypes[i % eventTypes.length],
        timestamp: timestamp.toISOString(),
        summary_text: `Event ${i + 1}: ${eventTypes[i % eventTypes.length]}`,
        ...overrides,
      });
    });
  },
};

/**
 * Factory for creating test car availability data
 */
export const carAvailabilityFactory = {
  build: (carId: string, date: string, overrides: Partial<any> = {}) => ({
    car_id: carId,
    date: date,
    status: "available",
    price_override: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  buildDateRange: (
    carId: string,
    startDate: string,
    endDate: string,
    overrides: Partial<any> = {}
  ) => {
    const availability = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      availability.push(
        carAvailabilityFactory.build(
          carId,
          currentDate.toISOString().split("T")[0],
          overrides
        )
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  },
};

/**
 * Factory for creating PayPal webhook payloads
 */
export const paypalWebhookFactory = {
  build: (eventType: string, bookingId: string, overrides: Partial<any> = {}) => ({
    id: `WH-${generateTestId()}`,
    event_type: eventType,
    resource_type: "payment",
    summary: `${eventType} event`,
    resource: {
      id: generateTestId("resource"),
      status: "COMPLETED",
      amount: {
        currency_code: "USD",
        value: "100.00",
      },
      custom_id: bookingId,
      ...overrides.resource,
    },
    create_time: new Date().toISOString(),
    event_version: "1.0",
    ...overrides,
  }),
};

/**
 * Factory for creating test scenarios with related data
 */
export const scenarioFactory = {
  /**
   * Create a complete booking scenario with car, customer, and booking
   */
  createBookingScenario: async (overrides: {
    car?: Partial<any>;
    customer?: Partial<any>;
    booking?: Partial<any>;
  } = {}) => {
    const car = carFactory.build(overrides.car);
    const customer = customerFactory.build(overrides.customer);
    const booking = bookingFactory.build({
      car_id: car.id,
      customer_id: customer.id,
      ...overrides.booking,
    });

    // Create availability for the booking dates
    const availability = carAvailabilityFactory.buildDateRange(
      car.id,
      booking.start_date,
      booking.end_date,
      { status: "booked" }
    );

    return {
      car,
      customer,
      booking,
      availability,
    };
  },

  /**
   * Create a scenario with multiple bookings for testing conflicts
   */
  createConflictScenario: async (carId: string, dateRanges: Array<{ start: string; end: string }>) => {
    const bookings = dateRanges.map((range, index) => {
      const customer = customerFactory.build();
      return bookingFactory.build({
        car_id: carId,
        customer_id: customer.id,
        start_date: range.start,
        end_date: range.end,
        overall_status: index === 0 ? "confirmed" : "pending_payment",
      });
    });

    return bookings;
  },
};