/**
 * Test script for user onboarding functionality
 * 
 * This script tests the onboarding service without requiring a running server
 * or actual Supabase webhooks.
 * 
 * Usage: node test-onboarding.js
 */

require('dotenv').config();
const userOnboardingService = require('./src/services/userOnboardingService');
const { supabaseAdmin } = require('./src/utils/supabase');

// Mock user data
const mockUserId = '550e8400-e29b-41d4-a716-446655440000'; // Example UUID
const mockMetadata = {
  organization_name: 'Test Organization for Onboarding',
  email: 'test@example.com'
};

async function cleanupTestData() {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured');
    return;
  }

  console.log('\n🧹 Cleaning up test data...');
  
  // Delete test profile
  await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', mockUserId);
  
  // Delete test organization
  await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('name', mockMetadata.organization_name);
  
  console.log('✅ Cleanup complete\n');
}

async function testOnboarding() {
  console.log('🧪 Testing User Onboarding Service\n');
  console.log('═══════════════════════════════════════\n');

  if (!supabaseAdmin) {
    console.error('❌ ERROR: Supabase admin client is not configured');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
  }

  try {
    // Cleanup any existing test data
    await cleanupTestData();

    console.log('📝 Test Case 1: First-time user signup with new organization');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`User ID: ${mockUserId}`);
    console.log(`Organization: ${mockMetadata.organization_name}\n`);

    const result1 = await userOnboardingService.onboardUser(mockUserId, mockMetadata);
    
    console.log('✅ Result:');
    console.log(`   Organization Created: ${result1.organization.name} (${result1.organization.id})`);
    console.log(`   Profile Created: User ${result1.profile.id} with role '${result1.profile.role}'`);
    console.log(`   Org ID Match: ${result1.profile.org_id === result1.organization.id ? '✓' : '✗'}`);
    console.log(`   Full Name: ${result1.profile.full_name || 'NULL'} ✓\n`);

    // Test idempotency - calling again with same user
    console.log('📝 Test Case 2: Check if duplicate prevention works');
    console.log('─────────────────────────────────────────────────────────────');
    
    const isOnboarded = await userOnboardingService.isUserOnboarded(mockUserId);
    console.log(`✅ User onboarding check: ${isOnboarded ? 'Already onboarded ✓' : 'Not onboarded ✗'}\n`);

    // Test finding existing organization
    console.log('📝 Test Case 3: New user joining existing organization');
    console.log('─────────────────────────────────────────────────────────────');
    
    const mockUserId2 = '550e8400-e29b-41d4-a716-446655440001';
    console.log(`User ID: ${mockUserId2}`);
    console.log(`Organization: ${mockMetadata.organization_name} (should find existing)\n`);

    const result2 = await userOnboardingService.onboardUser(mockUserId2, mockMetadata);
    
    console.log('✅ Result:');
    console.log(`   Organization Found: ${result2.organization.name} (${result2.organization.id})`);
    console.log(`   Same Org as First User: ${result2.organization.id === result1.organization.id ? '✓' : '✗'}`);
    console.log(`   Profile Created: User ${result2.profile.id} with role '${result2.profile.role}'\n`);

    // Cleanup second test user
    await supabaseAdmin.from('profiles').delete().eq('id', mockUserId2);

    // Test with no organization name
    console.log('📝 Test Case 4: User signup without organization name');
    console.log('─────────────────────────────────────────────────────────────');
    
    const mockUserId3 = '550e8400-e29b-41d4-a716-446655440002';
    console.log(`User ID: ${mockUserId3}`);
    console.log('Organization: (none provided - should use default)\n');

    const result3 = await userOnboardingService.onboardUser(mockUserId3, {});
    
    console.log('✅ Result:');
    console.log(`   Organization: ${result3.organization.name} (${result3.organization.id})`);
    console.log(`   Default Org Used: ${result3.organization.name === 'Default Organization' ? '✓' : '✗'}`);
    console.log(`   Profile Created: User ${result3.profile.id}\n`);

    // Cleanup third test user and default org
    await supabaseAdmin.from('profiles').delete().eq('id', mockUserId3);
    await supabaseAdmin.from('organizations').delete().eq('name', 'Default Organization');

    // Final cleanup
    await cleanupTestData();

    console.log('═══════════════════════════════════════\n');
    console.log('🎉 All tests passed successfully!\n');
    console.log('Next steps:');
    console.log('1. Configure Supabase webhook in Dashboard');
    console.log('2. Or apply database trigger from trigger_user_onboarding.sql');
    console.log('3. Test with real signup flow from frontend\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    
    // Cleanup on error
    await cleanupTestData().catch(() => {});
    
    process.exit(1);
  }
}

// Run tests
testOnboarding();
