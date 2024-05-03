const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(
  '/',
  createProxyMiddleware({
    target: 'https://lua-api.factorio.com/latest/',
    changeOrigin: true,
    logger: console,
  }),
);

app.listen(3001);