async function testUpload() {
  const url = 'https://gore-prev-shark-alice.trycloudflare.com/api/upload';
  console.log('Sending test upload to:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        source: 'ESP32-CAM-CLOUDFLARE-SUPERVISOR',
        notes: 'Testing permanent Cloudflare tunnel supervisor connection'
      })
    });
    const data = await res.json();
    console.log('Response status:', res.status, data);
  } catch (err) {
    console.error('Upload error:', err);
  }
}

testUpload();
