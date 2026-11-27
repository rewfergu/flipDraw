const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first Cloud Function:
// https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = onRequest((request, response) => {
//   response.send('Hello from Firebase!');
// });
