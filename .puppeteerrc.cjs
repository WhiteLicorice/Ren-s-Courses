/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: require("path").join(__dirname, "artifacts", "puppeteer"),
};
