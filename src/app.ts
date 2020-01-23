if (process.env.NGINX_UNIT) {
  const { IncomingMessage, ServerResponse } = require('unit-http');
  require('http').ServerResponse = ServerResponse;
  require('http').IncomingMessage = IncomingMessage;
}

import fs from 'fs';
import fastify from 'fastify';
import fileType from 'file-type';

import getCachedImage from './lib/getCachedImage';
import getRemoteImage from './lib/getRemoteImage';
import isValidUrl from './utils/isValidUrl';

import { CACHE_DIR } from './config';

// Create the cache directory
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

// Set up the server
const server = (() => {
  if (!process.env.NGINX_UNIT) return fastify();

  return fastify({
    serverFactory: (handler, opts) =>
      require('unit-http').createServer((req: any, res: any) => {
        handler(req, res);
      }),
  });
})();

server.get('*', async ({ req }, res) => {
  const imageUrl = req.url.match(/\/(.*)/)[1];

  // Validate url
  if (!isValidUrl(imageUrl)) return res.status(400).send();

  // Get file from local cache or remote url
  let image = await getCachedImage(imageUrl);
  if (!image) image = await getRemoteImage(imageUrl);

  if (!image) return res.status(502).send();

  // Get mime type
  const { mime } = await fileType.fromBuffer(image);

  return res.type(mime).send(image);
});

const port = +process.env.PORT || 3000;

if (process.env.NGINX_UNIT) {
  server.ready().then(() => {
    console.log(`Server running`);
  });
} else {
  server.listen(port, (err, address) => {
    if (err) throw err;
    console.log(`Server listening on ${address}`);
  });
}
