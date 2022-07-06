const DAOHqSwap = artifacts.require("DAOHqSwap");

module.exports = function (deployer) {
  deployer.deploy(DAOHqSwap, 250);
};