import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Clerk authentication...');
    
    const user = await currentUser();
    
    console.log('User object:', user);
    console.log('User type:', typeof user);
    console.log('User is null?', user === null);
    console.log('User is undefined?', user === undefined);
    
    if (!user) {
      console.log('❌ No user found');
      return NextResponse.json({ 
        error: 'Not authenticated',
        userExists: false,
        message: 'No current user found from Clerk'
      }, { status: 401 });
    }

    console.log('✅ User found:', user.id);
    
    // Try to access email addresses safely
    let emailInfo = {
      hasEmailAddresses: false,
      emailAddressesCount: 0,
      primaryEmail: null,
      allEmails: [],
      emailAddressesRaw: null
    };
    
    try {
      if (user.emailAddresses) {
        emailInfo.hasEmailAddresses = true;
        emailInfo.emailAddressesCount = user.emailAddresses.length;
        emailInfo.emailAddressesRaw = user.emailAddresses;
        
        if (user.emailAddresses.length > 0) {
          emailInfo.primaryEmail = user.emailAddresses[0].emailAddress;
          emailInfo.allEmails = user.emailAddresses.map(e => e.emailAddress);
        }
      }
    } catch (emailError) {
      console.error('Error accessing email addresses:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Clerk authentication working',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      emailInfo,
      rawUserKeys: Object.keys(user),
    });

  } catch (error) {
    console.error('❌ Error testing Clerk:', error);
    return NextResponse.json({ 
      error: 'Failed to test Clerk',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
} 