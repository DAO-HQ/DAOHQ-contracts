const MintFactory = artifacts.require("MintFactory");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(MintFactory);
};