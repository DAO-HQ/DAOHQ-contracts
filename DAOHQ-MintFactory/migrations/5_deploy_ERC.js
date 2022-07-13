const TestToken1 = artifacts.require("TestToken");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(TestToken1, {from: accounts[4]});
};