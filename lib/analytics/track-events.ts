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

/**
 * Event name mapping for different analytics platforms
 * 
 * Naming conventions:
 * - Vercel: dot.notation (car.view, booking.initiated)
 * - Google Analytics: snake_case with prefix (exodrive_car_view)
 * - Meta Pixel: PascalCase with prefix (ExoDrive_Car_View)
 */
const EVENT_NAME_MAP: Record<string, { fb?: string; ga?: string; vercel?: string }> = {
  "car_view": { 
    fb: "ExoDrive_Car_View", 
    ga: "exodrive_car_view", 
    vercel: "car.detail.view" 
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
  const eventProps = {
    event_category: category,
    ...properties,
  };

  const mappedNames = EVENT_NAME_MAP[eventName] || {};
  
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    const gaEventName = mappedNames.ga || eventName;
    window.gtag("event", gaEventName, eventProps);
  }

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    const fbEventName = mappedNames.fb || eventName;
    window.fbq("trackCustom", fbEventName, eventProps);
  }
  
  if (typeof window !== "undefined") {
    const vercelEventName = mappedNames.vercel || eventName;
    track(vercelEventName, eventProps);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${eventName}`, eventProps);
  }
}

/**
 * Track when a user views a car detail page
 * 
 * @param carId - Unique identifier for the car
 * @param carName - Name of the car being viewed
 * @param price - Daily rental price of the car
 * @param category - Category of the car (luxury, sports, etc.)
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
 * Track when a user clicks on a car card in the fleet listing
 * 
 * @param carId - Unique identifier for the car
 * @param carName - Name of the car being clicked
 * @param position - Position of the car card in the grid (for analyzing which positions get more clicks)
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
 * 
 * @param carId - Unique identifier for the car being booked
 * @param startDate - Selected start date (format: YYYY-MM-DD)
 * @param endDate - Selected end date (format: YYYY-MM-DD)
 * @param days - Number of days for the rental
 * @param totalPrice - Total price for the booking
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
 * Track when a user views a specific step in the booking process
 * 
 * @param carId - Unique identifier for the car being booked
 * @param step - Step number in the booking flow
 * @param stepName - Descriptive name of the booking step (e.g., "Date Selection", "Personal Information")
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
 * Track when a user initiates a booking (submits booking form)
 * 
 * @param carId - Unique identifier for the car being booked
 * @param carName - Name of the car being booked
 * @param days - Number of days for the rental
 * @param totalPrice - Total price for the booking
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
 * Track when a user abandons a booking (leaves booking form without completing)
 * 
 * @param carId - Unique identifier for the car being booked
 * @param step - Step number in the booking flow where abandonment occurred
 * @param timeSpent - Time spent on the booking form in seconds
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
 * Track when a user clicks on a navigation menu item
 * 
 * @param navItem - Name of the navigation item clicked (e.g., "Fleet", "About", "Contact")
 * @param currentPage - Path of the current page where the navigation occurred
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
 * Track when a user applies a filter to the car fleet
 * 
 * @param filterType - Type of filter applied (e.g., "category", "search", "sort")
 * @param filterValue - Value of the filter (e.g., "luxury", "price-asc", search term)
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
