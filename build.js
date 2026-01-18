/**
 * Build script - Injects environment variables into config.js
 */
const fs = require('fs');
const path = require('path');

// Read template
const templatePath = path.join(__dirname, 'js', 'config.template.js');
const outputPath = path.join(__dirname, 'js', 'config.js');

let template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders with environment variables
const apiKey = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';

template = template.replace('%%GEMINI_API_KEY%%', apiKey);

// Write output
fs.writeFileSync(outputPath, template);

console.log('✅ Config generated successfully');
console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
