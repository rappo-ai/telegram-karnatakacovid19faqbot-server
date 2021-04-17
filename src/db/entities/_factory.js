class Factory {
  constructor() {
    this.builders = {};
  }

  register(collection, builder) {
    this.builders[collection] = builder;
  }

  create(collection, data = {}) {
    let entity;
    try {
      entity = this.builders[collection]();
    } catch (err) {
      entity = {};
    }
    return Object.assign(entity, data);
  }
}
const factory = new Factory();

module.exports = factory;
