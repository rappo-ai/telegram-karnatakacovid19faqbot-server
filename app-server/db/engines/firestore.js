/* eslint-disable no-param-reassign */

const { DBEngine } = require('./_base');
const firestore = require('../stores/firestore');
const { pojoClone, cloneFromPojo } = require('../../utils/pojo');

class FirestoreDBEngine extends DBEngine {
  constructor(entityFactory) {
    super();
    this.firestore = firestore;
    this.converter = {
      toFirestore(entity) {
        return pojoClone(entity);
      },
      fromFirestore(snapshot) {
        const data = snapshot.data();
        const entity = entityFactory.create(data.collection);
        cloneFromPojo(entity, data);
        return entity;
      },
    };
  }

  async create(collection, entity) {
    return this.firestore
      .collection(collection)
      .withConverter(this.converter)
      .doc(entity.id)
      .create(entity)
      .then(() => entity);
  }

  async get(collection, query) {
    if (!query) {
      // get(collection) => return the whole collection
      return this.firestore
        .collection(collection)
        .withConverter(this.converter)
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data()));
    }
    if (typeof query === 'string') {
      // get(collection, id) => get entity in collection by id
      const id = query;
      return this.firestore
        .collection(collection)
        .withConverter(this.converter)
        .doc(id)
        .get()
        .then(snapshot => snapshot.data());
    }
    // get(collection, query) => get first entity in collection by query or query[]
    return this.query(collection, query).then(results => {
      if (results.length === 0) {
        return null;
      }
      return results[0];
    });
  }

  async update(collection, query, data) {
    let entity;
    // update(entity, data) overload
    if (typeof collection === 'object') {
      entity = collection;
      ({ collection } = entity);

      data = query;
      query = entity.id;
    }

    // update(collection, id, data) overload
    if (typeof query === 'string') {
      const id = query;
      return this.firestore
        .collection(collection)
        .withConverter(this.converter)
        .doc(id)
        .update(data)
        .then(() => entity && Object.assign(entity, data));
    }

    // update(collection, query, data) overload
    // update(collection, query[], data) overload
    return this.querySnapshot(collection, query).then(querySnapshot => {
      const results = [];
      querySnapshot.forEach(doc => {
        results.push(doc.ref.update(data));
      });
      return results;
    });
  }

  async delete(collection, query) {
    if (typeof query === 'string') {
      const id = query;
      return this.firestore
        .collection(collection)
        .withConverter(this.converter)
        .doc(id)
        .delete();
    }
    return this.querySnapshot(collection, query).then(querySnapshot => {
      const results = [];
      querySnapshot.forEach(doc => {
        results.push(doc.ref.delete());
      });
      return results;
    });
  }

  async query(collection, query) {
    return this.querySnapshot(collection, query).then(querySnapshot => {
      const results = [];
      querySnapshot.forEach(doc => {
        results.push(doc.data());
      });
      return results;
    });
  }

  async querySnapshot(collection, query) {
    if (Array.isArray(query)) {
      let firestoreQuery = this.firestore
        .collection(collection)
        .withConverter(this.converter);

      const queries = query;
      queries.forEach(_query => {
        if (!_query.condition) {
          _query.condition = '==';
        }
        firestoreQuery = firestoreQuery.where(
          _query.property,
          _query.condition,
          _query.value,
        );
      });

      return firestoreQuery.get();
    }

    if (!query) {
      return this.firestore
        .collection(collection)
        .withConverter(this.converter)
        .get();
    }

    if (!query.condition) {
      query.condition = '==';
    }
    return this.firestore
      .collection(collection)
      .withConverter(this.converter)
      .where(query.property, query.condition, query.value)
      .get();
  }
}

module.exports = {
  FirestoreDBEngine,
};
