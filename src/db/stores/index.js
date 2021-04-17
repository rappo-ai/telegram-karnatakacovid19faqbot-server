const database = require('./firestore');
const sessionstore = require('./session');

const getDatabase = () => database;
const getSessionStore = () => sessionstore;

module.exports = {
  getDatabase,
  getSessionStore,
};
