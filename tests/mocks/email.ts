import { mock } from "bun:test";

// Mock email sending functions
export const mockSendBookingConfirmationEmail = mock(async (params: {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  carName: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  bookingUrl: string;
}) => {
  console.log(`[Mock] Sending booking confirmation email to ${params.customerEmail}`);
  return { success: true, messageId: 'mock-message-id' };
});

export const mockSendPaymentConfirmationEmail = mock(async (params: {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}) => {
  console.log(`[Mock] Sending payment confirmation email to ${params.customerEmail}`);
  return { success: true, messageId: 'mock-message-id' };
});

export const mockSendContractEmail = mock(async (params: {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  contractUrl: string;
}) => {
  console.log(`[Mock] Sending contract email to ${params.customerEmail}`);
  return { success: true, messageId: 'mock-message-id' };
});

export const mockSendCancellationEmail = mock(async (params: {
  customerEmail: string;
  customerName: string;
  bookingId: string;
  refundAmount?: number;
  currency?: string;
}) => {
  console.log(`[Mock] Sending cancellation email to ${params.customerEmail}`);
  return { success: true, messageId: 'mock-message-id' };
});

// Mock email error scenarios
export const mockEmailError = new Error('Failed to send email');

export const setupEmailMockError = (mockFn: any, shouldFail: boolean = false) => {
  if (shouldFail) {
    mockFn.mockRejectedValueOnce(mockEmailError);
  } else {
    mockFn.mockResolvedValueOnce({ success: true, messageId: 'mock-message-id' });
  }
};