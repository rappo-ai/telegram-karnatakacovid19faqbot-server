/* eslint-disable global-require, no-param-reassign, no-case-declarations */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { Entity } = require('./entities/_base');
const entityFactory = require('./entities/_factory');

function loadEntities(entitiesDir) {
  const entities = {};
  const files = fs.readdirSync(entitiesDir);

  files.forEach(file => {
    const filename = path.basename(file, path.extname(file));
    if (filename.startsWith('_')) {
      return;
    }
    const name = filename;
    assert(entities[name] === undefined);

    const entity = require(path.resolve(__dirname, entitiesDir, file));
    assert(entity.Class !== undefined);

    entityFactory.register(name, () => new entity.Class());

    entities[name] = entity;
  });

  return entities;
}

function init(options) {
  if (!options) {
    options = {};
  }
  if (!options.dbengine) {
    options.dbengine = 'firestore';
  }
  const db = {};
  switch (options.dbengine) {
    case 'firestore':
      const { FirestoreDBEngine } = require('./engines/firestore');
      db.engine = new FirestoreDBEngine(entityFactory);
      break;
    default:
      throw new Error(`Engine ${options.dbengine} not implemented`);
  }

  db.entities = loadEntities(path.resolve(__dirname, './entities'));

  db.create = async function _create(collection, data = {}) {
    const entity = entityFactory.create(collection, data);
    return db.engine.create(collection, entity);
  };

  db.get = async function _get(collection, query) {
    return db.engine.get(collection, query);
  };

  db.update = async function _update(collection, query, data) {
    return db.engine.update(collection, query, data);
  };

  db.query = async function _query(collection, query) {
    return db.engine.query(collection, query);
  };

  db.delete = async function _delete(collection, query) {
    return db.engine.delete(collection, query);
  };

  Entity.db = db;

  return db;
}

const db = init();

module.exports = db;
