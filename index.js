const TelegramUtil = require('./telegram-util');
const express = require('express');
const app = express();
const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('./logger');

const options = {
  key: fs.readFileSync('Your OpenSSL'),
  cert: fs.readFileSync('Your OpenSSL')
};

let telegramUtil = null;

app.use((request, response, next) => {
  if (request.protocol == 'http') {
    return response.redirect(`https://${request.hostname}${request.url}`);
  }

  next();
});

try {
  http.createServer(app).listen(5000);
  https.createServer(options, app).listen(5001, null, () => {
    logger.log('info', 'API server start ------------------------------------');

    if (telegramUtil === null) {
      telegramUtil = new TelegramUtil();
    }
  });
} catch (error) {
  logger.log('error', error);
}

app.get('/', (request, response) => {
  response.send();
});