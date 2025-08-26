#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function fixAllNextJs15Issues() {
  console.log('🔧 Applying comprehensive Next.js 15 fixes...\n');
  
  // List of all dynamic route files and their specific fixes
  const dynamicRouteFiles = [
    'app/api/admin/bookings/[bookingId]/route.ts',
    'app/api/admin/bookings/[bookingId]/status/route.ts',
    'app/api/cars/[carId]/route.ts',
    'app/api/cars/[carId]/reviews/route.ts',
    'app/api/bookings/[bookingId]/capture-payment/route.ts',
    'app/api/bookings/[bookingId]/void-payment/route.ts',
  ];
  
  for (const file of dynamicRouteFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }
    
    console.log(`📝 Processing: ${file}`);
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Fix 1: Update all function signatures to use Promise<{ param: string }>
    content = content.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{([^}]+)\}\s*\}/g,
      '{ params }: { params: Promise<{$1}> }'
    );
    
    // Fix 2: Add await for all params destructuring
    // Handle multiple patterns
    
    // Pattern: const { bookingId } = params;
    content = content.replace(
      /const\s+\{\s*bookingId\s*\}\s*=\s*params;/g,
      'const { bookingId } = await params;'
    );
    
    // Pattern: const { carId } = params;
    content = content.replace(
      /const\s+\{\s*carId\s*\}\s*=\s*params;/g,
      'const { carId } = await params;'
    );
    
    // Pattern: const bookingId = params.bookingId;
    content = content.replace(
      /const\s+bookingId\s*=\s*params\.bookingId;/g,
      'const { bookingId } = await params;'
    );
    
    // Pattern: const carId = params.carId;
    content = content.replace(
      /const\s+carId\s*=\s*params\.carId;/g,
      'const { carId } = await params;'
    );
    
    // Check if modifications were made
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${file}`);
      modified = true;
    } else {
      console.log(`⏭️  No changes needed: ${file}`);
    }
  }
  
  // Fix the specific issue in PATCH function
  console.log('\n🔧 Applying specific PATCH function fixes...\n');
  
  const patchFile = path.join(process.cwd(), 'app/api/admin/bookings/[bookingId]/route.ts');
  if (fs.existsSync(patchFile)) {
    let content = fs.readFileSync(patchFile, 'utf-8');
    
    // Find the PATCH function and ensure params is awaited
    const patchFunctionRegex = /export\s+async\s+function\s+PATCH[\s\S]*?const\s+\{\s*bookingId\s*\}\s*=\s*params;/;
    if (patchFunctionRegex.test(content)) {
      content = content.replace(
        /export\s+async\s+function\s+PATCH([\s\S]*?)const\s+\{\s*bookingId\s*\}\s*=\s*params;/,
        'export async function PATCH$1const { bookingId } = await params;'
      );
      fs.writeFileSync(patchFile, content, 'utf-8');
      console.log(`✅ Fixed PATCH function in: app/api/admin/bookings/[bookingId]/route.ts`);
    }
    
    // Do the same for DELETE function
    const deleteFunctionRegex = /export\s+async\s+function\s+DELETE[\s\S]*?const\s+\{\s*bookingId\s*\}\s*=\s*params;/;
    if (deleteFunctionRegex.test(content)) {
      content = content.replace(
        /export\s+async\s+function\s+DELETE([\s\S]*?)const\s+\{\s*bookingId\s*\}\s*=\s*params;/,
        'export async function DELETE$1const { bookingId } = await params;'
      );
      fs.writeFileSync(patchFile, content, 'utf-8');
      console.log(`✅ Fixed DELETE function in: app/api/admin/bookings/[bookingId]/route.ts`);
    }
  }
  
  console.log('\n✨ All fixes completed!');
}

// Run the script
fixAllNextJs15Issues().catch(console.error);
