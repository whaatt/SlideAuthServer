/*
 * File: API.js
 * Type: Helper Functions
 * Contains API helpers.
 */

// For sanity.
'use strict';

// Response helper module.
module.exports = {};

// Fun little helper factory for responses.
module.exports.response = (status, body, isDS) => {
  if (!isDS) // Do not add if returning to Deepstream.
    body.success = (status === 200);
  const response = {
    statusCode: status,
    body: JSON.stringify(body),
    headers: {
      // This should fix CORS issues?
      'Access-Control-Allow-Origin': '*'
    }
  };

  // Important.
  return response;
};

// Some common errors with predefined responses.
let response = module.exports.response;
module.exports.errors = {
  database: response(503, { message: 'Database error.' }),
  duplicate: response(403, { message: 'Duplicate error.' }),
  validation: response(401, { message: 'Validation error.' }),
  credentials: response(401, { message: 'Credentials error.' })
};
