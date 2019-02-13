// Obtain package version.
const {version} = require('./package.json');
global.PACKAGE_VERSION = process.env.npm_package_version || version;

module.exports = require('./src/grapevine');