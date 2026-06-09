const fs = require('fs');
const jsonData = JSON.parse(fs.readFileSync('./messages.json'));


module.exports = jsonData;