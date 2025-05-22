// File: app/admin/cars/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { carServiceSupabase } from '@/lib/services/car-service-supabase'
import { redirect } from 'next/navigation' // Import redirect

// Action to toggle the 'hidden' status (Archive/Unarchive)
export async function toggleCarVisibilityAction(formData: FormData) {
  const carId = formData.get('carId') as string
  const currentHiddenStatus = formData.get('isHidden') === 'true' // Check current status

  // Add detailed logging
  console.log('toggleCarVisibilityAction called with:')
  console.log('- carId:', carId)
  console.log('- currentHiddenStatus:', currentHiddenStatus)
  console.log('- isHidden form value:', formData.get('isHidden'))

  if (!carId) {
    console.error('toggleCarVisibilityAction: Car ID missing')
    // Handle error appropriately, maybe redirect with error message
    return
  }

  // TODO: Add proper authorization check here - ensure only admins can call this!
  // You might fetch the user session here and check their email/role

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const newHiddenStatus = !currentHiddenStatus
  console.log('- newHiddenStatus (to be applied):', newHiddenStatus)

  try {
    // Use the appropriate service function based on the new status
    if (newHiddenStatus) {
      console.log(`Archiving car ${carId} (setting hidden=true)`)
      await carServiceSupabase.archiveCar(supabaseAdmin, carId)
    } else {
      console.log(`Unarchiving car ${carId} (setting hidden=false)`)
      await carServiceSupabase.unarchiveCar(supabaseAdmin, carId)
    }
    
    // Verify the change was applied
    const updatedCar = await carServiceSupabase.getCarById(supabaseAdmin, carId)
    console.log(`Car ${carId} after toggle: hidden=${updatedCar?.hidden}`)
    
    // Revalidate paths to update caches
    revalidatePath('/admin/cars')
    revalidatePath('/fleet')
    // Optional: Revalidate specific car detail pages if needed
    // const car = await carServiceSupabase.getCarById(supabaseAdmin, carId); // Need slug for this
    // if (car?.slug) revalidatePath(`/fleet/${car.slug}`);

    // Optional: Redirect back to admin cars page to see changes immediately
    // redirect('/admin/cars'); // Uncomment if desired behaviour
  } catch (error: any) {
    console.error(`Error in toggleCarVisibilityAction for car ${carId}:`, error)
    // Handle error appropriately, maybe return an error message
  }
}

// Action for Permanent Delete (Example - Currently Not Used By UI)
// Note: A UI component with confirmation would call this
export async function deleteCarPermanentlyAction(formData: FormData): Promise<{ success: boolean; message: string }> {
    const carId = formData.get('carId') as string;
    const confirmDelete = formData.get('confirmDelete') as string; // Example confirmation field

    if (!carId) {
        console.error('deleteCarPermanentlyAction: Car ID missing');
        return { success: false, message: 'Car ID is missing.' };
    }
    // Example simple confirmation check
    if (confirmDelete !== `delete-${carId}`) {
        console.error(`deleteCarPermanentlyAction: Confirmation failed for ${carId}`);
        return { success: false, message: 'Deletion confirmation failed.' };
    }

    // TODO: Add proper authorization check here

    const supabaseAdmin = createSupabaseServiceRoleClient();

    try {
        await carServiceSupabase.deleteCar(supabaseAdmin, carId); // Uses atomic RPC
        revalidatePath('/admin/cars');
        revalidatePath('/fleet');
        console.log(`Successfully deleted car ${carId}`);
        return { success: true, message: 'Car deleted successfully.' };
        // redirect('/admin/cars'); // Optional redirect
    } catch (error: any) {
        console.error(`Error in deleteCarPermanentlyAction for car ${carId}:`, error);
        return { success: false, message: error.message || 'Failed to delete car.' };
    }
}

// New server action to fetch ALL cars for admin list, including hidden ones
export async function fetchAllCarsForAdmin() {
  console.log('fetchAllCarsForAdmin server action called');
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();
    const allCars = await carServiceSupabase.getAllCarsForAdminList(supabaseAdmin);
    
    console.log(`fetchAllCarsForAdmin: Found ${allCars.length} total cars`);
    const visibleCount = allCars.filter(car => !car.hidden).length;
    const hiddenCount = allCars.filter(car => car.hidden === true).length;
    console.log(`fetchAllCarsForAdmin: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    // Debug log each hidden car
    if (hiddenCount > 0) {
      allCars
        .filter(car => car.hidden === true)
        .forEach(car => console.log(`Hidden car: ${car.name} (${car.id})`));
    }
    
    // Return value must be serializable
    return { 
      cars: allCars, 
      error: null 
    };
  } catch (error: any) {
    console.error('Error in fetchAllCarsForAdmin:', error);
    // Return error in expected structure
    return { 
      cars: [], 
      error: error.message || 'Failed to fetch cars' 
    };
  }
}