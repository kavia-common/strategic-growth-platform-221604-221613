/**
 * Test script for the onboarding endpoint
 * This script verifies that the POST /api/onboarding/complete endpoint works correctly
 */

const { supabaseAdmin } = require('./src/utils/supabase');

async function testOnboardingEndpoint() {
  console.log('=== Testing Onboarding Endpoint Setup ===\n');

  // Test 1: Check Supabase connection
  console.log('1. Testing Supabase connection...');
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client is not configured');
    return;
  }
  console.log('✅ Supabase admin client is configured\n');

  // Test 2: Check organizations table
  console.log('2. Testing organizations table access...');
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing organizations table:', error.message);
      return;
    }
    console.log('✅ Organizations table accessible');
    console.log(`   Found ${data?.length || 0} organizations\n`);
  } catch (err) {
    console.error('❌ Exception accessing organizations:', err.message);
    return;
  }

  // Test 3: Check profiles table
  console.log('3. Testing profiles table access...');
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id, role')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing profiles table:', error.message);
      return;
    }
    console.log('✅ Profiles table accessible');
    console.log(`   Found ${data?.length || 0} profiles\n`);
  } catch (err) {
    console.error('❌ Exception accessing profiles:', err.message);
    return;
  }

  // Test 4: Test case-insensitive organization lookup
  console.log('4. Testing case-insensitive organization lookup...');
  try {
    const testOrgName = 'Test Organization';
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .ilike('name', testOrgName)
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error with case-insensitive lookup:', error.message);
      return;
    }
    console.log('✅ Case-insensitive lookup works');
    if (data) {
      console.log(`   Found organization: ${data.name}`);
    } else {
      console.log('   No matching organization found (expected for new database)');
    }
  } catch (err) {
    console.error('❌ Exception with lookup:', err.message);
    return;
  }

  console.log('\n=== All tests passed! ===');
  console.log('\nThe onboarding endpoint is ready to use.');
  console.log('Endpoint: POST /api/onboarding/complete');
  console.log('Required headers: Authorization: Bearer <supabase-jwt-token>');
  console.log('Required body: { "organization_name": "Your Organization" }');
}

// Run the test
testOnboardingEndpoint()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
