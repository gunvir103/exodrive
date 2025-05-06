// Database verification script for ExoDrive cars
// This script verifies database cars and specifically checks for hidden cars
// Acts as a safety and stability check for all code commits

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service role key not provided');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔒 RUNNING DATABASE SAFETY & STABILITY CHECK 🔒');
  console.log('This verification ensures database integrity and proper access controls.\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    commit_info: process.env.GITHUB_SHA || 'local',
    testResults: [],
    safety_status: 'CHECKING',
    summary: {
      passedTests: 0,
      failedTests: 0,
      totalCars: 0,
      hiddenCars: 0,
      critical_issues: [],
      warnings: [],
      errors: [],
    }
  };

  try {
    // Test 1: Database connectivity check
    console.log('Test 1: Verifying database connectivity...');
    const { data: healthData, error: healthError } = await supabase.rpc('check_db_health', {});
    
    if (healthError) {
      report.testResults.push({
        name: 'Database connectivity check',
        passed: false,
        is_critical: true,
        details: `Failed to connect to database: ${healthError.message}`
      });
      report.summary.failedTests++;
      report.summary.critical_issues.push('Database connectivity failure');
    } else {
      report.testResults.push({
        name: 'Database connectivity check',
        passed: true,
        details: 'Successfully connected to database'
      });
      report.summary.passedTests++;
    }

    // Test 2: Can fetch all cars
    console.log('Test 2: Fetching all cars...');
    const { data: allCars, error: fetchError } = await supabase
      .from('cars')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch cars: ${fetchError.message}`);
    }

    report.testResults.push({
      name: 'Fetch all cars',
      passed: true,
      details: `Successfully fetched ${allCars.length} cars`
    });
    
    report.summary.totalCars = allCars.length;
    report.summary.passedTests++;

    // Test 3: Check for hidden cars
    console.log('Test 3: Checking for hidden cars...');
    const hiddenCars = allCars.filter(car => car.hidden === true);
    report.summary.hiddenCars = hiddenCars.length;

    if (hiddenCars.length > 0) {
      report.testResults.push({
        name: 'Check for hidden cars',
        passed: true,
        details: `Found ${hiddenCars.length} hidden cars`
      });
      report.summary.passedTests++;
    } else {
      report.testResults.push({
        name: 'Check for hidden cars',
        passed: false,
        details: 'No hidden cars found. This might be expected if no cars are archived.',
        is_warning: true
      });
      report.summary.warnings.push('No archived cars found - consider creating a test archived car');
      report.summary.failedTests++;
    }

    // Test 4: Check cars have required fields
    console.log('Test 4: Verifying car fields...');
    const requiredFields = ['id', 'name', 'slug', 'category'];
    const invalidCars = allCars.filter(car => 
      !requiredFields.every(field => car[field] !== undefined && car[field] !== null)
    );

    if (invalidCars.length === 0) {
      report.testResults.push({
        name: 'Verify required car fields',
        passed: true,
        details: 'All cars have the required fields'
      });
      report.summary.passedTests++;
    } else {
      report.testResults.push({
        name: 'Verify required car fields',
        passed: false,
        is_critical: true,
        details: `Found ${invalidCars.length} cars missing required fields`,
        invalidIds: invalidCars.map(car => car.id)
      });
      report.summary.critical_issues.push('Cars with missing required fields detected');
      report.summary.failedTests++;
    }

    // Test 5: Fetch related data for a sample car
    console.log('Test 5: Checking related data...');
    if (allCars.length > 0) {
      const sampleCarId = allCars[0].id;
      const { data: carWithRelations, error: relationsError } = await supabase
        .from('cars')
        .select(`
          *,
          pricing:car_pricing(*),
          images:car_images(*),
          features:car_features(*),
          specifications:car_specifications(*)
        `)
        .eq('id', sampleCarId)
        .single();

      if (relationsError) {
        throw new Error(`Failed to fetch car relations: ${relationsError.message}`);
      }

      const hasRelations = 
        (carWithRelations.pricing !== null) || 
        (Array.isArray(carWithRelations.images) && carWithRelations.images.length > 0) ||
        (Array.isArray(carWithRelations.features) && carWithRelations.features.length > 0) ||
        (Array.isArray(carWithRelations.specifications) && carWithRelations.specifications.length > 0);

      report.testResults.push({
        name: 'Fetch related car data',
        passed: true,
        details: hasRelations 
          ? 'Successfully fetched car with related data' 
          : 'Successfully fetched car but no related data found'
      });
      report.summary.passedTests++;
    }

    // Test 6: Specific test for hidden cars if they exist
    if (hiddenCars.length > 0) {
      console.log('Test 6: Testing hidden car access controls...');
      const sampleHiddenCarId = hiddenCars[0].id;
      
      // Test with anon key first (should fail due to RLS)
      const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { data: anonResult, error: anonError } = await anonClient
        .from('cars')
        .select('*')
        .eq('id', sampleHiddenCarId)
        .eq('hidden', true)
        .maybeSingle();
      
      const rlsWorking = (anonError || !anonResult);
      
      report.testResults.push({
        name: 'Verify RLS protects hidden cars',
        passed: rlsWorking,
        is_critical: !rlsWorking,
        details: rlsWorking 
          ? 'RLS correctly prevents anonymous access to hidden cars' 
          : '🚨 CRITICAL SECURITY ISSUE: Anonymous users can access hidden cars!'
      });
      
      if (!rlsWorking) {
        report.summary.critical_issues.push('RLS POLICY FAILURE: Hidden cars are accessible to public users');
      }
      
      rlsWorking ? report.summary.passedTests++ : report.summary.failedTests++;
    }
    
    // Test 7: Check admin access to hidden cars
    if (hiddenCars.length > 0) {
      console.log('Test 7: Verifying admin access to hidden cars...');
      const sampleHiddenCarId = hiddenCars[0].id;
      
      // Using service role client which should bypass RLS
      const { data: adminResult, error: adminError } = await supabase
        .from('cars')
        .select('*')
        .eq('id', sampleHiddenCarId)
        .eq('hidden', true)
        .maybeSingle();
      
      const adminAccessWorking = (adminResult && !adminError);
      
      report.testResults.push({
        name: 'Verify admin access to hidden cars',
        passed: adminAccessWorking,
        is_critical: !adminAccessWorking,
        details: adminAccessWorking 
          ? 'Admin can correctly access hidden cars' 
          : '🚨 CRITICAL ISSUE: Admin cannot access hidden cars!'
      });
      
      if (!adminAccessWorking) {
        report.summary.critical_issues.push('Admin access to hidden cars is not working');
      }
      
      adminAccessWorking ? report.summary.passedTests++ : report.summary.failedTests++;
    }

  } catch (error) {
    console.error('Error during database verification:', error);
    report.summary.errors.push(error.message);
    report.testResults.push({
      name: 'Database verification',
      passed: false,
      details: `Error: ${error.message}`,
      is_critical: true
    });
    report.summary.failedTests++;
    report.summary.critical_issues.push('Unexpected error during verification');
  }
  
  // Set final safety status
  if (report.summary.critical_issues.length > 0) {
    report.safety_status = 'FAILED';
  } else if (report.summary.warnings.length > 0) {
    report.safety_status = 'WARNING';
  } else {
    report.safety_status = 'PASSED';
  }

  // Save report to file - ensure it's written to the expected location
  const reportPath = 'db-verification-report.json';
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport file saved to: ${reportPath}`);
  } catch (writeError) {
    console.error(`Error writing report file: ${writeError.message}`);
    // Try to save to the 'reports' directory as a fallback
    try {
      if (!fs.existsSync('reports')) {
        fs.mkdirSync('reports', { recursive: true });
      }
      fs.writeFileSync('reports/db-verification-report.json', JSON.stringify(report, null, 2));
      console.log(`\nFallback: Report file saved to reports/db-verification-report.json`);
    } catch (fallbackError) {
      console.error(`Error writing fallback report file: ${fallbackError.message}`);
    }
  }
  
  // Print summary
  console.log('\n-------------------------------------------');
  console.log(`DATABASE SAFETY CHECK: ${report.safety_status}`);
  console.log('-------------------------------------------');
  console.log(`Total cars: ${report.summary.totalCars}`);
  console.log(`Hidden cars: ${report.summary.hiddenCars}`);
  console.log(`Tests passed: ${report.summary.passedTests}`);
  console.log(`Tests failed: ${report.summary.failedTests}`);
  
  if (report.summary.critical_issues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    report.summary.critical_issues.forEach(issue => console.log(`- ${issue}`));
  }
  
  if (report.summary.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    report.summary.warnings.forEach(warning => console.log(`- ${warning}`));
  }
  
  if (report.summary.errors.length > 0) {
    console.log('\nERRORS:');
    report.summary.errors.forEach(err => console.log(`- ${err}`));
  }
  
  // Exit with appropriate code - fail if any critical issues or errors
  const hasFailures = report.summary.critical_issues.length > 0 || report.summary.errors.length > 0;
  process.exit(hasFailures ? 1 : 0);
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 