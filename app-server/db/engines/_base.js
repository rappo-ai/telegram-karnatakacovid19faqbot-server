/* eslint-disable no-unused-vars */
class DBEngine {
  async create(collection, entity) {
    throw new Error('Override not implemented');
  }

  async get(collection, query) {
    throw new Error('Override not implemented');
  }

  async update(collection, query, data) {
    throw new Error('Override not implemented');
  }

  async delete(collection, query) {
    throw new Error('Override not implemented');
  }

  async query(collection, query) {
    throw new Error('Override not implemented');
  }
}

module.exports = {
  DBEngine,
};
