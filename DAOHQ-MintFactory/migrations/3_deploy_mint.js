const TestToken = artifacts.require("TestToken");
const Mint = artifacts.require("TokenMint");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(Mint, accounts[0], accounts[1], web3.utils.toBN(web3.utils.toWei("1", 'ether')), TestToken.address, accounts[1]);
};