import { NextRequest, NextResponse } from 'next/server';
import { uploadRateLimit } from '@/lib/rate-limit';

// Example of upload endpoint with rate limiting
export const POST = uploadRateLimit(async (request: NextRequest) => {
  try {
    // Your existing upload logic here
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Process the upload...
    // const result = await uploadCarImage(file);

    return NextResponse.json({ 
      success: true,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
});