#!/usr/bin/env bun

// Helper script to run database verification locally
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), '.env.local') });

// Check for required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env.local file');
  process.exit(1);
}

console.log('🔍 Running database verification script with Bun...');
console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

// Run the verification script with Bun
const verifyProcess = spawn('bun', [path.resolve(__dirname, 'verify-database.mjs')], {
  env: process.env,
  stdio: 'inherit'
});

verifyProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Database verification passed successfully!');
    
    // Read and display summary of report if it exists
    try {
      const reportPath = path.resolve(process.cwd(), 'db-verification-report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log(`\nCars: ${report.summary.totalCars} total, ${report.summary.hiddenCars} hidden`);
        console.log(`Tests: ${report.summary.passedTests} passed, ${report.summary.failedTests} failed`);
      }
    } catch (err) {
      console.error('Error reading report:', err.message);
    }
  } else {
    console.error('\n❌ Database verification failed');
  }
}); 