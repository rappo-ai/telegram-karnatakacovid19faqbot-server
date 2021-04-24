const { now } = require('lodash/date');
const { nanoid } = require('nanoid');

class Entity {
  constructor(collection) {
    this.collection = collection;
    this.id = nanoid();
    this.createdTs = now();
    this.lastModifiedTs = this.createdTs;
  }
}

module.exports = {
  Entity,
};
