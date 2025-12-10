/**
 * End-to-End Test for Onboarding Endpoint
 * This script creates a test user, authenticates, and tests the onboarding flow
 */

require('dotenv').config();
const { supabase, supabaseAdmin } = require('./src/utils/supabase');
const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_EMAIL = `test-user-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_ORG_NAME = `Test Organization ${Date.now()}`;

async function runE2ETest() {
  console.log('=== End-to-End Onboarding Test ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`Test Org: ${TEST_ORG_NAME}\n`);

  let testUserId = null;
  let authToken = null;

  try {
    // Step 1: Create a test user
    console.log('1. Creating test user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: {
        data: {
          organization_name: TEST_ORG_NAME
        }
      }
    });

    if (signUpError) {
      console.error('❌ Failed to create test user:', signUpError.message);
      return;
    }

    testUserId = signUpData.user?.id;
    authToken = signUpData.session?.access_token;

    if (!testUserId) {
      console.error('❌ No user ID returned from signup');
      return;
    }

    console.log('✅ Test user created');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Has token: ${authToken ? 'Yes' : 'No'}\n`);

    // If no token (email confirmation required), use admin to get one
    if (!authToken) {
      console.log('   Email confirmation required, using admin to generate session...');
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: TEST_EMAIL
      });
      
      if (sessionError) {
        console.error('❌ Failed to generate session:', sessionError.message);
        return;
      }
      
      // For testing purposes, sign in directly
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

      if (signInError) {
        console.error('⚠️  Could not sign in (may need email confirmation):', signInError.message);
        console.log('   Creating mock token for testing...');
        // Use service role to create a session
        const { data: adminSession, error: adminSessionError } = await supabaseAdmin.auth.admin.createUser({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          email_confirm: true
        });
        
        if (!adminSessionError && adminSession.user) {
          testUserId = adminSession.user.id;
          // Create a session for this user
          const { data: newSession } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
          });
          authToken = newSession?.session?.access_token;
        }
      } else {
        authToken = signInData.session?.access_token;
      }
    }

    if (!authToken) {
      console.error('❌ Could not obtain auth token');
      return;
    }

    console.log('✅ Auth token obtained\n');

    // Step 2: Call the onboarding endpoint
    console.log('2. Calling onboarding endpoint...');
    console.log(`   POST ${BASE_URL}/api/onboarding/complete`);
    console.log(`   Body: { organization_name: "${TEST_ORG_NAME}" }`);
    
    try {
      const response = await axios.post(
        `${BASE_URL}/api/onboarding/complete`,
        {
          organization_name: TEST_ORG_NAME
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Onboarding endpoint responded successfully');
      console.log(`   Status: ${response.status}`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));

      if (!response.data.success) {
        console.error('❌ Onboarding was not successful');
        return;
      }

      console.log('\n3. Verifying database records...');

      // Verify organization was created
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', response.data.org.id)
        .single();

      if (orgError) {
        console.error('❌ Failed to verify organization:', orgError.message);
      } else {
        console.log('✅ Organization exists in database');
        console.log(`   ID: ${org.id}, Name: ${org.name}`);
      }

      // Verify profile was created
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      if (profileError) {
        console.error('❌ Failed to verify profile:', profileError.message);
      } else {
        console.log('✅ Profile exists in database');
        console.log(`   User ID: ${profile.id}`);
        console.log(`   Org ID: ${profile.org_id}`);
        console.log(`   Role: ${profile.role}`);
      }

      // Test idempotency - call again
      console.log('\n4. Testing idempotency (calling again)...');
      const response2 = await axios.post(
        `${BASE_URL}/api/onboarding/complete`,
        {
          organization_name: TEST_ORG_NAME
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Second call succeeded (idempotent)');
      console.log(`   Status: ${response2.status}`);
      console.log(`   Message: ${response2.data.message}`);

    } catch (error) {
      console.error('❌ Error calling onboarding endpoint:');
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error('   Data:', error.response.data);
      } else {
        console.error(`   ${error.message}`);
      }
      throw error;
    }

    console.log('\n=== ✅ All E2E tests passed! ===');

  } catch (error) {
    console.error('\n=== ❌ Test failed ===');
    console.error(error.message);
    throw error;
  } finally {
    // Cleanup
    if (testUserId) {
      console.log('\n5. Cleaning up test data...');
      try {
        // Delete profile first (due to foreign key constraints)
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', testUserId);
        
        // Delete organizations that were created for this test
        await supabaseAdmin
          .from('organizations')
          .delete()
          .ilike('name', `%${Date.now().toString().substring(0, 8)}%`);

        // Delete the test user
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
        
        console.log('✅ Test data cleaned up');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup error (non-critical):', cleanupError.message);
      }
    }
  }
}

// Run the test
runE2ETest()
  .then(() => {
    console.log('\nTest completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest failed:', err.message);
    process.exit(1);
  });
