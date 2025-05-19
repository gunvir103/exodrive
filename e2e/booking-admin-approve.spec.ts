import { test, expect } from '@playwright/test';

const USER_FIRST_NAME = 'Test';
const USER_LAST_NAME = 'User'; // Will be updated to Automated based on new script
const USER_EMAIL_DOMAIN = 'boxerinvestments.co';
const USER_PHONE = '555-123-4567'; // Will be updated based on new script

test.describe('Booking Flow', () => {
  test('Public booking → inbox → admin approve', async ({ page }) => {
    const uniqueEmail = `testuser_${Date.now()}@${USER_EMAIL_DOMAIN}`;
    const newFirstName = 'Playwright';
    const newLastName = 'Test';
    const newPhone = '1234561122';

    // Step 1: Go to a specific car page and submit a booking
    await page.goto('/fleet/brabusg63amg'); // Specific car page from your script

    await page.waitForSelector('#pickup-date', { timeout: 20000 });

    // --- Select Pickup Date ---
    await page.locator('#pickup-date').click(); 

    // Wait directly for the react-day-picker's month container to be visible.
    // The selector 'div.rdp.rdp-v6:not([hidden]) .rdp-months' is a common pattern.
    // Verify with Playwright Codegen if issues persist.
    const pickupCalendarMonthGrid = page.locator('div.rdp:not([hidden]) .rdp-months').first();
    await expect(pickupCalendarMonthGrid).toBeVisible({ timeout: 10000 });

    // Example: Select a day (e.g., 10th). Make this robust.
    await pickupCalendarMonthGrid.locator('button.rdp-button_reset:not([disabled]):text-is("10")').click();
    await page.waitForTimeout(500); 

    // --- Select Return Date ---
    await expect(page.locator('#return-date')).toBeEnabled({ timeout: 10000 }); 
    await page.locator('#return-date').click(); 

    const returnCalendarMonthGrid = page.locator('div.rdp:not([hidden]) .rdp-months').first(); 
    await expect(returnCalendarMonthGrid).toBeVisible({ timeout: 5000 });
    
    await returnCalendarMonthGrid.locator('button.rdp-button_reset:not([disabled]):text-is("15")').click();
    await page.waitForTimeout(500);

    // Click "Continue to Details"
    await page.getByRole('button', { name: 'Continue to Details' }).click();

    // Fill personal information using details from your script
    await page.waitForSelector('input[name="firstName"]');
    await page.getByRole('textbox', { name: 'First Name' }).fill(newFirstName);
    await page.getByRole('textbox', { name: 'Last Name' }).fill(newLastName);
    await page.getByRole('textbox', { name: 'Email Address' }).fill(uniqueEmail);
    await page.getByRole('textbox', { name: 'Phone Number' }).fill(newPhone);
    await page.getByRole('checkbox', { name: 'I agree to the Terms &' }).check();

    // Click "Complete Booking"
    await page.getByRole('button', { name: 'Complete Booking' }).click();
    
    await expect(page.locator('text=Booking Initiated')).toBeVisible({ timeout: 10000 });

    // Step 2: Log in as admin and go to inbox
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL || 'admin@example.com');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'password');
    await page.locator('button:has-text("Log In")').click();
    
    await page.waitForURL('/admin', { timeout: 15000 });
    await page.goto('/admin/inbox');
    
    await page.waitForSelector(`text=${newFirstName} ${newLastName}`, { timeout: 20000 });
    await expect(page.locator(`text=${newFirstName} ${newLastName}`)).toBeVisible();
    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible();

    // Step 3: Approve the booking
    await page.locator(`tr:has-text("${uniqueEmail}") >> text=View Details`).click();
    
    await page.waitForSelector('button:has-text("Approve Booking")', { timeout: 10000 });
    await page.locator('button:has-text("Approve Booking")').click();
    
    await expect(page.locator('text=Status: Authorized')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Payment: Authorized')).toBeVisible({ timeout: 10000 }); 
  });
}); 