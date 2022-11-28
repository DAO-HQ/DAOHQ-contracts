const SideChainManager = artifacts.require("SideChainManager");
const IndexToken = artifacts.require("IndexToken");
const IssuanceManager = artifacts.require("IssuanceManager");

module.exports = async function (deployer, network, accounts) {
    if(network == "poly_dev"){
        const inIn = await IndexToken.deployed();
        const isIn = await IssuanceManager.deployed();
        console.log(inIn.address);
        console.log(isIn.address);
        await deployer.deploy(SideChainManager,
             "0x2A5c2568b10A0E826BfA892Cf21BA7218310180b",
             "0xadbF1854e5883eB8aa7BAf50705338739e558E5b",
             "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270");
    }
}
//MUST ADD TO HOSTCHAIN DIRECTORY