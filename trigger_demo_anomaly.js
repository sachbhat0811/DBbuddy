const http = require('http');

console.log("🚀 Initiating Demo Anomaly Spike...");

http.get('http://localhost:5000/api/aws/trigger-demo-anomaly', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("✅ SUCCESS:", JSON.parse(data).message);
        console.log("👀 Keep your eyes on the Vitals Analytics dashboard. The next 5-second poll will trigger the Dual-Stage Pipeline!");
    });
}).on('error', (err) => {
    console.error("❌ ERROR: Could not reach the backend. Make sure your Node.js server is running on port 5000.");
});
