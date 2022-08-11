const Factory = artifacts.require("DAOHQERC20Factory");

module.exports = function (deployer) {
  deployer.deploy(Factory, 1000);
};