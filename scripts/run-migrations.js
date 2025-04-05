#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Running Supabase migrations...');

// Ensure we're in the project root
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

// Check if the migrations directory exists
const migrationsDir = path.join(projectRoot, 'supabase/migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('❌ Migrations directory not found. Make sure you are in the correct project directory.');
  process.exit(1);
}

// Display available migrations
console.log('📋 Available migrations:');
const migrations = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

if (migrations.length === 0) {
  console.error('❌ No SQL migration files found in the migrations directory.');
  process.exit(1);
}

migrations.forEach((migration, index) => {
  console.log(`   ${index + 1}. ${migration}`);
});

try {
  // Run the migrations using Supabase CLI
  console.log('\n🚀 Applying migrations...');
  execSync('npx supabase db push', { stdio: 'inherit' });
  
  console.log('\n✅ Migrations applied successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Go to the admin homepage settings page');
  console.log('   2. Select a car to be featured on the homepage');
  console.log('   3. Save the settings');
} catch (error) {
  console.error(`\n❌ Migration failed: ${error.message}`);
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Make sure Supabase CLI is installed: npm install -g supabase');
  console.error('   2. Check that your Supabase project is linked correctly');
  console.error('   3. Verify your database credentials in .env.local');
  process.exit(1);
} 