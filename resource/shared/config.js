module.exports = {
  http: {
    host: '0.0.0.0',
    port: 3030,
  },
  jwt: {
    secret: 'change-me',
    expiresIn: '12h',
  },
  sqlite: {
    file: './data/cad.sqlite',
  },
  qbox: {
    host: '127.0.0.1',
    user: 'root',
    password: 'changeme',
    database: 'qbox',
    exportResource: 'qbx_core',
    exportName: 'GetPlayerCoordsByCitizenId',
    exportSourceName: 'GetPlayerSourceByCitizenId',
  },
  radio: {
    activityBufferSize: 100,
  },
  mumble: {
    enabled: false,
    url: '',
  },
};
