#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Fix Next.js 15 params in dynamic API routes
 * In Next.js 15, params is now a Promise that needs to be awaited
 */

async function fixNextJs15Params() {
  console.log('🔧 Fixing Next.js 15 params in API routes...\n');
  
  // Find all route.ts files in the API directory
  const apiDir = path.join(process.cwd(), 'app', 'api');
  const routeFiles = await glob(`${apiDir}/**/route.ts`);
  
  let fixedCount = 0;
  const fixes: string[] = [];
  
  for (const filePath of routeFiles) {
    const fileName = path.relative(process.cwd(), filePath);
    
    // Check if this is a dynamic route (contains [param])
    const isDynamicRoute = filePath.includes('[') && filePath.includes(']');
    
    if (!isDynamicRoute) {
      continue;
    }
    
    console.log(`📝 Processing: ${fileName}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = content;
    
    // Pattern 1: Fix function signatures with params
    // Old: { params }: { params: { bookingId: string } }
    // New: { params }: { params: Promise<{ bookingId: string }> }
    modified = modified.replace(
      /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^}]+)\}\s*\}/g,
      '{ params }: { params: Promise<{$1}> }'
    );
    
    // Pattern 2: Add await before params usage
    // Find all functions that have params parameter
    const functionPattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*params[^)]*\)\s*{/g;
    const functions = modified.match(functionPattern);
    
    if (functions) {
      functions.forEach(func => {
        const methodName = func.match(/(GET|POST|PUT|PATCH|DELETE)/)?.[1];
        if (methodName) {
          // Find the function body and add await for params
          const functionBodyPattern = new RegExp(
            `export\\s+async\\s+function\\s+${methodName}\\s*\\([^)]*\\)\\s*{([^}]+(?:{[^}]*}[^}]*)*)}`
          );
          
          modified = modified.replace(functionBodyPattern, (match, body) => {
            // Check if params is already awaited
            if (body.includes('await params')) {
              return match;
            }
            
            // Check if params is destructured
            const destructurePattern = /const\s+\{([^}]+)\}\s*=\s*params;/;
            const destructureMatch = body.match(destructurePattern);
            
            if (destructureMatch) {
              // Replace with awaited version
              const newBody = body.replace(
                destructurePattern,
                'const {$1} = await params;'
              );
              return match.replace(body, newBody);
            }
            
            // Check for direct params access
            const directAccessPattern = /const\s+(\w+)\s*=\s*params\.(\w+);/g;
            if (body.match(directAccessPattern)) {
              // Add await params at the beginning
              const newBody = body.replace(
                /^(\s*try\s*\{)?/,
                '$1\n    const resolvedParams = await params;'
              ).replace(
                /params\.(\w+)/g,
                'resolvedParams.$1'
              );
              return match.replace(body, newBody);
            }
            
            return match;
          });
        }
      });
    }
    
    // Pattern 3: Fix inline arrow functions with params
    // Old: export const GET = async (request: NextRequest, { params }: { params: { id: string } }) =>
    // New: export const GET = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
    modified = modified.replace(
      /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async\s*\([^)]*\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^}]+)\}\s*\}/g,
      'export const $1 = async ($2{ params }: { params: Promise<{$3}> }'
    );
    
    // Check if file was modified
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf-8');
      fixedCount++;
      fixes.push(fileName);
      console.log(`✅ Fixed: ${fileName}`);
    } else {
      console.log(`⏭️  Skipped: ${fileName} (no changes needed)`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Fixed ${fixedCount} files:`);
  fixes.forEach(file => console.log(`  - ${file}`));
  
  // Now let's also create a separate fix for specific files we know have issues
  await fixSpecificFiles();
}

async function fixSpecificFiles() {
  console.log('\n🔧 Applying specific fixes to known problematic files...\n');
  
  const specificFixes = [
    {
      file: 'app/api/admin/bookings/[bookingId]/route.ts',
      fix: async (content: string) => {
        // Fix the GET function
        content = content.replace(
          /export\s+async\s+function\s+GET\s*\(\s*request:\s*NextRequest,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}\s*\)/,
          'export async function GET(\n  request: NextRequest,\n  { params }: { params: Promise<{ bookingId: string }> }\n)'
        );
        
        // Add await for params
        content = content.replace(
          /const\s+\{\s*bookingId\s*\}\s*=\s*params;/,
          'const { bookingId } = await params;'
        );
        
        // Fix PATCH function
        content = content.replace(
          /export\s+async\s+function\s+PATCH\s*\(\s*request:\s*NextRequest,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}\s*\)/,
          'export async function PATCH(\n  request: NextRequest,\n  { params }: { params: Promise<{ bookingId: string }> }\n)'
        );
        
        // Fix DELETE function
        content = content.replace(
          /export\s+async\s+function\s+DELETE\s*\(\s*request:\s*NextRequest,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}\s*\)/,
          'export async function DELETE(\n  request: NextRequest,\n  { params }: { params: Promise<{ bookingId: string }> }\n)'
        );
        
        return content;
      }
    },
    {
      file: 'app/api/admin/bookings/[bookingId]/status/route.ts',
      fix: async (content: string) => {
        content = content.replace(
          /export\s+async\s+function\s+POST\s*\(\s*request:\s*NextRequest,\s*\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}\s*\)/,
          'export async function POST(\n  request: NextRequest,\n  { params }: { params: Promise<{ bookingId: string }> }\n)'
        );
        
        content = content.replace(
          /const\s+\{\s*bookingId\s*\}\s*=\s*params;/,
          'const { bookingId } = await params;'
        );
        
        return content;
      }
    },
    {
      file: 'app/api/cars/[carId]/route.ts',
      fix: async (content: string) => {
        content = content.replace(
          /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*carId:\s*string\s*\}\s*\}/g,
          '{ params }: { params: Promise<{ carId: string }> }'
        );
        
        content = content.replace(
          /const\s+\{\s*carId\s*\}\s*=\s*params;/g,
          'const { carId } = await params;'
        );
        
        return content;
      }
    },
    {
      file: 'app/api/cars/[carId]/reviews/route.ts',
      fix: async (content: string) => {
        content = content.replace(
          /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*carId:\s*string\s*\}\s*\}/g,
          '{ params }: { params: Promise<{ carId: string }> }'
        );
        
        content = content.replace(
          /const\s+carId\s*=\s*params\.carId;/g,
          'const { carId } = await params;'
        );
        
        return content;
      }
    },
    {
      file: 'app/api/bookings/[bookingId]/capture-payment/route.ts',
      fix: async (content: string) => {
        content = content.replace(
          /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}/g,
          '{ params }: { params: Promise<{ bookingId: string }> }'
        );
        
        content = content.replace(
          /const\s+bookingId\s*=\s*params\.bookingId;/g,
          'const { bookingId } = await params;'
        );
        
        return content;
      }
    },
    {
      file: 'app/api/bookings/[bookingId]/void-payment/route.ts',
      fix: async (content: string) => {
        content = content.replace(
          /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{\s*bookingId:\s*string\s*\}\s*\}/g,
          '{ params }: { params: Promise<{ bookingId: string }> }'
        );
        
        content = content.replace(
          /const\s+bookingId\s*=\s*params\.bookingId;/g,
          'const { bookingId } = await params;'
        );
        
        return content;
      }
    }
  ];
  
  for (const { file, fix } of specificFixes) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`📝 Fixing: ${file}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fixed = await fix(content);
      
      if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, 'utf-8');
        console.log(`✅ Fixed: ${file}`);
      } else {
        console.log(`⏭️  No changes needed: ${file}`);
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
}

// Run the script
fixNextJs15Params().catch(console.error);
