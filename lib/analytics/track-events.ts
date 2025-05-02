"use client";

import { track } from '@vercel/analytics';

type EventProperties = Record<string, string | number | boolean | undefined>;

export enum EventCategory {
  CAR = "car",
  BOOKING = "booking",
  NAVIGATION = "navigation",
  FILTERING = "filtering",
  ENGAGEMENT = "engagement",
}

const EVENT_NAME_MAP: Record<string, { fb?: string; ga?: string; vercel?: string }> = {
  "car_view": { 
    fb: "ExoDrive_Car_View", 
    ga: "exodrive_car_view", 
    vercel: "car.view" 
  },
  "car_card_click": { 
    fb: "ExoDrive_Car_Card_Click", 
    ga: "exodrive_car_card_click", 
    vercel: "car.card.click" 
  },
  "booking_dates_selected": { 
    fb: "ExoDrive_Booking_Dates_Selected", 
    ga: "exodrive_booking_dates_selected", 
    vercel: "booking.dates.selected" 
  },
  "booking_step_view": { 
    fb: "ExoDrive_Booking_Step_View", 
    ga: "exodrive_booking_step_view", 
    vercel: "booking.step.view" 
  },
  "booking_initiated": { 
    fb: "ExoDrive_Booking_Initiated", 
    ga: "exodrive_booking_initiated", 
    vercel: "booking.initiated" 
  },
  "booking_abandoned": { 
    fb: "ExoDrive_Booking_Abandoned", 
    ga: "exodrive_booking_abandoned", 
    vercel: "booking.abandoned" 
  },
  "navigation_click": { 
    fb: "ExoDrive_Navigation_Click", 
    ga: "exodrive_navigation_click", 
    vercel: "navigation.click" 
  },
  "filter_applied": { 
    fb: "ExoDrive_Filter_Applied", 
    ga: "exodrive_filter_applied", 
    vercel: "filter.applied" 
  }
};

/**
 * Track an event across all analytics platforms
 */
export function trackEvent(
  eventName: string,
  category: EventCategory,
  properties: EventProperties = {}
) {
  let dynamicEventName = eventName;
  
  if (properties.car_name) {
    const carNameSlug = String(properties.car_name).toLowerCase().replace(/\s+/g, '_');
    dynamicEventName = `${eventName}_${carNameSlug}`;
  }
  
  const eventProps = {
    event_category: category,
    ...properties,
  };

  const baseEventName = eventName.split('_').slice(0, 2).join('_'); // Get base event name without dynamic parts
  const mappedNames = EVENT_NAME_MAP[baseEventName] || {};
  
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    const gaEventName = mappedNames.ga ? `${mappedNames.ga}_${properties.car_name ? String(properties.car_name).toLowerCase().replace(/\s+/g, '_') : ''}` : dynamicEventName;
    window.gtag("event", gaEventName, eventProps);
  }

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    const fbEventName = mappedNames.fb ? `${mappedNames.fb}_${properties.car_name ? String(properties.car_name).toLowerCase().replace(/\s+/g, '_') : ''}` : dynamicEventName;
    window.fbq("trackCustom", fbEventName, eventProps);
  }
  
  if (typeof window !== "undefined") {
    const vercelEventName = mappedNames.vercel ? mappedNames.vercel : dynamicEventName;
    track(vercelEventName, eventProps);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${dynamicEventName}`, eventProps);
  }
}

/**
 * Track when a user views a car detail page
 */
export function trackCarView(
  carId: string,
  carName: string,
  price: number,
  category: string
) {
  const eventName = `car_view`;
  
  trackEvent(eventName, EventCategory.CAR, {
    car_id: carId,
    car_name: carName,
    price,
    category,
    page_type: "car_detail",
    event_label: `View of ${carName} (${category})`,
  });
}

/**
 * Track when a user clicks on a car card
 */
export function trackCarCardClick(
  carId: string,
  carName: string,
  position: number
) {
  const eventName = `car_card_click`;
  
  trackEvent(eventName, EventCategory.CAR, {
    car_id: carId,
    car_name: carName,
    position,
    event_label: `Click on ${carName} card at position ${position}`,
  });
}

/**
 * Track when a user selects dates for a booking
 */
export function trackDateSelection(
  carId: string,
  startDate: string,
  endDate: string,
  days: number,
  totalPrice: number
) {
  const eventName = `booking_dates_selected`;
  
  trackEvent(eventName, EventCategory.BOOKING, {
    car_id: carId,
    start_date: startDate,
    end_date: endDate,
    rental_days: days,
    total_price: totalPrice,
    event_label: `Booking dates selected: ${startDate} to ${endDate} (${days} days)`,
  });
}

/**
 * Track when a user views a booking step
 */
export function trackBookingStep(
  carId: string,
  step: number,
  stepName: string
) {
  const eventName = `booking_step_view`;
  
  trackEvent(eventName, EventCategory.BOOKING, {
    car_id: carId,
    step_number: step,
    step_name: stepName,
    event_label: `Booking step ${step}: ${stepName}`,
  });
}

/**
 * Track when a user initiates a booking
 */
export function trackBookingInitiated(
  carId: string,
  carName: string,
  days: number,
  totalPrice: number
) {
  const eventName = `booking_initiated`;
  
  trackEvent(eventName, EventCategory.BOOKING, {
    car_id: carId,
    car_name: carName,
    rental_days: days,
    total_price: totalPrice,
    event_label: `Booking initiated for ${carName} (${days} days, $${totalPrice})`,
  });
}

/**
 * Track when a user abandons a booking
 */
export function trackBookingAbandoned(
  carId: string,
  step: number,
  timeSpent: number
) {
  const eventName = `booking_abandoned`;
  
  trackEvent(eventName, EventCategory.BOOKING, {
    car_id: carId,
    step_abandoned: step,
    time_spent_seconds: timeSpent,
    event_label: `Booking abandoned at step ${step} after ${timeSpent} seconds`,
  });
}

/**
 * Track when a user clicks on a navigation item
 */
export function trackNavigation(
  navItem: string,
  currentPage: string
) {
  const eventName = `navigation_click`;
  
  trackEvent(eventName, EventCategory.NAVIGATION, {
    nav_item: navItem,
    current_page: currentPage,
    event_label: `Navigation: ${navItem} clicked on ${currentPage} page`,
  });
}

/**
 * Track when a user applies a filter
 */
export function trackFilterApplied(
  filterType: string,
  filterValue: string
) {
  const eventName = `filter_applied`;
  
  trackEvent(eventName, EventCategory.FILTERING, {
    filter_type: filterType,
    filter_value: filterValue,
    event_label: `Filter applied: ${filterType} = ${filterValue}`,
  });
}

declare global {
  interface Window {
    fbq: any;
    gtag: any;
  }
}
