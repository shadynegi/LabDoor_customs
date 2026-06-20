import dotenv from 'dotenv';

dotenv.config();

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function testPayPalConnection() {
  console.log('🧪 Testing PayPal Sandbox Connection...\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking Environment Variables...');
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  
  console.log(`   PayPal Mode: ${mode}`);
  console.log(`   PayPal API: ${PAYPAL_API}`);
  console.log(`   Client ID: ${clientId ? `${clientId.substring(0, 10)}...` : '❌ NOT SET'}`);
  console.log(`   Secret: ${secret ? `${secret.substring(0, 10)}...` : '❌ NOT SET'}`);
  
  if (!clientId || !secret) {
    console.log('\n❌ ERROR: PayPal credentials are not configured!');
    console.log('\n📚 Setup Instructions:');
    console.log('   1. Go to https://developer.paypal.com/');
    console.log('   2. Log in or create an account');
    console.log('   3. Click "Dashboard" → "My Apps & Credentials"');
    console.log('   4. Under "Sandbox", click "Create App"');
    console.log('   5. Give your app a name (e.g., "Lab Door Customs")');
    console.log('   6. Copy the "Client ID" and "Secret"');
    console.log('   7. Add them to backend/.env:');
    console.log('      PAYPAL_CLIENT_ID=your_client_id_here');
    console.log('      PAYPAL_SECRET=your_secret_here');
    console.log('      PAYPAL_MODE=sandbox');
    console.log('\n   8. Restart your backend server');
    process.exit(1);
  }
  
  console.log('✅ Environment variables are set.\n');
  
  // Step 2: Test authentication
  console.log('📋 Step 2: Testing Authentication...');
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  
  try {
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Authentication Failed! (Status: ${response.status})`);
      console.log(`   Error: ${errorText}`);
      console.log('\n💡 Common Issues:');
      console.log('   1. Invalid Client ID or Secret');
      console.log('   2. Credentials from wrong environment (sandbox vs live)');
      console.log('   3. App not approved in PayPal dashboard');
      console.log('\n🔧 Solutions:');
      console.log('   1. Double-check your credentials in PayPal dashboard');
      console.log('   2. Make sure you\'re using SANDBOX credentials');
      console.log('   3. Try creating a new app in PayPal dashboard');
      process.exit(1);
    }
    
    const data = await response.json();
    const accessToken = data.access_token;
    
    console.log('✅ Authentication Successful!');
    console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
    console.log(`   Token Type: ${data.token_type}`);
    console.log(`   Expires In: ${data.expires_in} seconds\n`);
    
    // Step 3: Test creating an order
    console.log('📋 Step 3: Testing Order Creation...');
    const testOrder = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '100.00',
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: '85.00'
            },
            shipping: {
              currency_code: 'USD',
              value: '0.00'
            },
            tax_total: {
              currency_code: 'USD',
              value: '15.00'
            }
          }
        },
        items: [{
          name: 'Test Product',
          unit_amount: {
            currency_code: 'USD',
            value: '85.00'
          },
          quantity: '1',
          category: 'PHYSICAL_GOODS'
        }]
      }],
      application_context: {
        return_url: 'http://localhost:5173/payment/success',
        cancel_url: 'http://localhost:5173/payment/cancel',
        brand_name: 'Lab Door Customs',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING'
      }
    };
    
    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrder)
    });
    
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.log(`❌ Order Creation Failed! (Status: ${orderResponse.status})`);
      console.log(`   Error Details:`, JSON.stringify(errorData, null, 2));
      console.log('\n💡 Common Issues:');
      console.log('   1. Invalid order structure');
      console.log('   2. Amount calculation errors');
      console.log('   3. Missing required fields');
      process.exit(1);
    }
    
    const orderData = await orderResponse.json();
    console.log('✅ Test Order Created Successfully!');
    console.log(`   Order ID: ${orderData.id}`);
    console.log(`   Status: ${orderData.status}`);
    
    const approvalLink = orderData.links.find(link => link.rel === 'approve');
    if (approvalLink) {
      console.log(`   Approval URL: ${approvalLink.href.substring(0, 50)}...`);
    }
    console.log('');
    
    // Step 4: Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED! PayPal integration is working!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ Your PayPal sandbox is properly configured');
    console.log('✅ Authentication is working');
    console.log('✅ Order creation is working');
    console.log('\n💡 Next Steps:');
    console.log('   1. Make sure your backend server is running (npm run dev)');
    console.log('   2. Test the checkout flow in your application');
    console.log('   3. Use PayPal sandbox test accounts to complete payments');
    console.log('\n📚 PayPal Sandbox Test Accounts:');
    console.log('   - You can create test buyer accounts at:');
    console.log('     https://developer.paypal.com/dashboard/accounts');
    console.log('   - Use these to test the full payment flow');
    console.log('');
    
  } catch (error) {
    console.log('❌ Unexpected Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify PayPal API is accessible');
    console.log('   3. Check for firewall/proxy issues');
    process.exit(1);
  }
}

testPayPalConnection();

