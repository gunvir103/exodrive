#!/usr/bin/env bun
/**
 * Helper script to add make/model/year specifications to cars
 * This ensures DocuSeal documents are populated with correct vehicle information
 * 
 * Usage:
 *   bun run scripts/add-car-specifications.ts
 *   bun run scripts/add-car-specifications.ts --car-id=<uuid>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse } from 'path';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CarSpec {
  carId: string;
  carName: string;
  make: string;
  model: string;
  year: string;
}

/**
 * Parse car name to extract make, model, and year
 */
function parseCarName(name: string): { make: string; model: string; year: string } {
  const parts = name.split(/\s+/).filter(p => p.length > 0);
  
  // Pattern 1: Year at the beginning (e.g., "2024 Toyota Camry")
  if (parts[0] && /^\d{4}$/.test(parts[0])) {
    return {
      year: parts[0],
      make: parts[1] || '',
      model: parts.slice(2).join(' ') || '',
    };
  }
  
  // Pattern 2: Year at the end (e.g., "Toyota Camry 2024")
  if (parts.length > 0 && /^\d{4}$/.test(parts[parts.length - 1])) {
    return {
      year: parts[parts.length - 1],
      make: parts[0] || '',
      model: parts.slice(1, -1).join(' ') || '',
    };
  }
  
  // Pattern 3: No year (e.g., "Toyota Camry")
  return {
    year: new Date().getFullYear().toString(),
    make: parts[0] || '',
    model: parts.slice(1).join(' ') || '',
  };
}

/**
 * Check if a car already has make/model/year specifications
 */
async function hasSpecifications(carId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('car_specifications')
    .select('name')
    .eq('car_id', carId)
    .in('name', ['Make', 'Model', 'Year']);

  if (error) {
    console.error(`Error checking specifications for car ${carId}:`, error);
    return false;
  }

  const specNames = data?.map(s => s.name.toLowerCase()) || [];
  return specNames.includes('make') && specNames.includes('model') && specNames.includes('year');
}

/**
 * Add specifications for a single car
 */
async function addSpecificationsForCar(spec: CarSpec): Promise<void> {
  const specifications = [
    { car_id: spec.carId, name: 'Make', value: spec.make, is_highlighted: false },
    { car_id: spec.carId, name: 'Model', value: spec.model, is_highlighted: false },
    { car_id: spec.carId, name: 'Year', value: spec.year, is_highlighted: false },
  ];

  const { error } = await supabase
    .from('car_specifications')
    .upsert(specifications, { 
      onConflict: 'car_id,name',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error(`❌ Failed to add specifications for ${spec.carName}:`, error);
  } else {
    console.log(`✅ Added specifications for ${spec.carName}: ${spec.make} ${spec.model} ${spec.year}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚗 Adding car specifications for DocuSeal integration...\n');

  // Check if a specific car ID was provided
  const args = process.argv.slice(2);
  const carIdArg = args.find(arg => arg.startsWith('--car-id='));
  const specificCarId = carIdArg?.split('=')[1];

  // Fetch cars
  let query = supabase.from('cars').select('id, name');
  if (specificCarId) {
    query = query.eq('id', specificCarId);
  }

  const { data: cars, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch cars:', error);
    process.exit(1);
  }

  if (!cars || cars.length === 0) {
    console.log('No cars found');
    process.exit(0);
  }

  console.log(`Found ${cars.length} car(s) to process\n`);

  // Process each car
  for (const car of cars) {
    console.log(`Processing: ${car.name}`);

    // Check if specifications already exist
    const hasSpecs = await hasSpecifications(car.id);
    if (hasSpecs) {
      console.log(`  ⏭️  Already has specifications, skipping...`);
      continue;
    }

    // Parse the car name
    const parsed = parseCarName(car.name);
    
    // Show what will be added
    console.log(`  📝 Parsed as: Make="${parsed.make}", Model="${parsed.model}", Year="${parsed.year}"`);
    
    // Prompt for confirmation or manual entry
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>(resolve => {
      readline.question('  Is this correct? (y/n/manual): ', resolve);
    });

    if (answer.toLowerCase() === 'y') {
      await addSpecificationsForCar({
        carId: car.id,
        carName: car.name,
        ...parsed,
      });
    } else if (answer.toLowerCase() === 'manual') {
      // Manual entry
      const make = await new Promise<string>(resolve => {
        readline.question('  Enter Make: ', resolve);
      });
      const model = await new Promise<string>(resolve => {
        readline.question('  Enter Model: ', resolve);
      });
      const year = await new Promise<string>(resolve => {
        readline.question('  Enter Year: ', resolve);
      });

      await addSpecificationsForCar({
        carId: car.id,
        carName: car.name,
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
      });
    } else {
      console.log('  ⏭️  Skipping...');
    }

    readline.close();
    console.log('');
  }

  console.log('\n✨ Done! Car specifications have been added.');
  console.log('Your DocuSeal documents will now be populated with the correct vehicle information.');
}

// Run the script
main().catch(console.error);
