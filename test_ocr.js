// Quick test to check OCR extraction
const fs = require('fs');

console.log('🔍 Testing OCR with DIALVA invoice...');
console.log('📁 Checking if test image exists at /workspace/uploads/IMG_7334.jpeg');

if (fs.existsSync('/workspace/uploads/IMG_7334.jpeg')) {
  console.log('✅ Image file found');
  const stats = fs.statSync('/workspace/uploads/IMG_7334.jpeg');
  console.log(`📊 File size: ${stats.size} bytes`);
} else {
  console.log('❌ Image file NOT found at /workspace/uploads/IMG_7334.jpeg');
  console.log('📂 Checking /workspace/uploads directory...');
  if (fs.existsSync('/workspace/uploads')) {
    const files = fs.readdirSync('/workspace/uploads');
    console.log('Files in /workspace/uploads:', files);
  } else {
    console.log('❌ /workspace/uploads directory does not exist');
  }
}
