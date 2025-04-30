"use client";

type EventProperties = Record<string, string | number | boolean | undefined>;

export enum EventCategory {
  CAR = "car",
  BOOKING = "booking",
  NAVIGATION = "navigation",
  FILTERING = "filtering",
  ENGAGEMENT = "engagement",
}

const EVENT_NAME_MAP: Record<string, { fb?: string; ga?: string; vercel?: string }> = {
};

/**
 * Track an event across all analytics platforms
 */
export function trackEvent(
  eventName: string,
  category: EventCategory,
  properties: EventProperties = {}
) {
  const eventProps = {
    event_category: category,
    ...properties,
  };

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, eventProps);
  }

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", eventName, eventProps);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${eventName}`, eventProps);
  }
}

export function trackCarView(
  carId: string,
  carName: string,
  price: number,
  category: string
) {
  trackEvent("car_view", EventCategory.CAR, {
    car_id: carId,
    car_name: carName,
    price,
    category,
  });
}

export function trackCarCardClick(
  carId: string,
  carName: string,
  position: number
) {
  trackEvent("car_card_click", EventCategory.CAR, {
    car_id: carId,
    car_name: carName,
    position,
  });
}

export function trackDateSelection(
  carId: string,
  startDate: string,
  endDate: string,
  days: number,
  totalPrice: number
) {
  trackEvent("booking_dates_selected", EventCategory.BOOKING, {
    car_id: carId,
    start_date: startDate,
    end_date: endDate,
    rental_days: days,
    total_price: totalPrice,
  });
}

export function trackBookingStep(
  carId: string,
  step: number,
  stepName: string
) {
  trackEvent("booking_step_view", EventCategory.BOOKING, {
    car_id: carId,
    step_number: step,
    step_name: stepName,
  });
}

export function trackBookingInitiated(
  carId: string,
  carName: string,
  days: number,
  totalPrice: number
) {
  trackEvent("booking_initiated", EventCategory.BOOKING, {
    car_id: carId,
    car_name: carName,
    rental_days: days,
    total_price: totalPrice,
  });
}

export function trackBookingAbandoned(
  carId: string,
  step: number,
  timeSpent: number
) {
  trackEvent("booking_abandoned", EventCategory.BOOKING, {
    car_id: carId,
    step_abandoned: step,
    time_spent_seconds: timeSpent,
  });
}

export function trackNavigation(
  navItem: string,
  currentPage: string
) {
  trackEvent("navigation_click", EventCategory.NAVIGATION, {
    nav_item: navItem,
    current_page: currentPage,
  });
}

export function trackFilterApplied(
  filterType: string,
  filterValue: string
) {
  trackEvent("filter_applied", EventCategory.FILTERING, {
    filter_type: filterType,
    filter_value: filterValue,
  });
}

declare global {
  interface Window {
    fbq: any;
    gtag: any;
  }
}
