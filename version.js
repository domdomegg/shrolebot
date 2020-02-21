const promisify = require('util').promisify
const exec = promisify(require('child_process').exec)
module.exports.VERSION = () =>
  exec('git rev-parse --short HEAD')
    .then(({ stdout: hash }) =>
  `${(new Date()).toISOString().replace(/-/g, '').replace(/\..*/, '').replace(/:/g, '').replace('T', '.')}.${hash.trim()}`)
