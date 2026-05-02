// Angular dev-server proxy — routes /youtrack-proxy/* to your YouTrack instance.
// Set YOUTRACK_URL before starting the dev server:
//   YOUTRACK_URL=http://127.0.0.1:8080 ng serve
// Or edit the fallback value below directly.

const YOUTRACK_URL = process.env['YOUTRACK_URL'] || 'http://localhost:8080';

module.exports = [
  {
    context: ['/youtrack-proxy'],
    target: YOUTRACK_URL,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/youtrack-proxy': '' },
    logLevel: 'warn',
  },
];
