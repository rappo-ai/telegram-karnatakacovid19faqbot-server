const axios = require('axios').default;

async function callRasaApi(endpoint, method = "get", body = {}) {
  return axios.request({
    url: endpoint,
    method,
    baseURL: 'http://rasa:5005/',
    data: body,
  });
}

module.exports = {
  callRasaApi,
};
