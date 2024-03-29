const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: '/information.log', level: 'info', dirname: process.cwd() }),
    new winston.transports.File({ filename: '/information.log', level: 'error', dirname: process.cwd() })
  ]
});

module.exports = logger;