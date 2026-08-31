require('dotenv').config();

async function testLogins() {
  const accounts = [
    { email: 'admin@medilink.ai', pass: 'admin123' },
    { email: 'nurse@h01.medilink.ai', pass: 'nurse123' },
    { email: 'supervisor@h01.medilink.ai', pass: 'super123' },
    { email: 'supervisor@h02.medilink.ai', pass: 'super123' },
    { email: 'pharmacist@h02.medilink.ai', pass: 'pharm123' }
  ];
  for (let acc of accounts) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.pass })
      });
      const data = await res.json();
      console.log(`[LOGIN TEST] ${acc.email} -> Status ${res.status}: ${data.token ? 'SUCCESS (Role: ' + data.user.role + ')' : 'FAILED (' + data.error + ')'}`);
    } catch (e) {
      console.error(`[LOGIN TEST] ${acc.email} ERROR:`, e.message);
    }
  }
}
testLogins();
