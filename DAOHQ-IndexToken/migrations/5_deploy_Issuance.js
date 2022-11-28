const IndexToken = artifacts.require("IndexToken");
const FeeNode = artifacts.require("ManagementFeeNode");
const IssuanceManager = artifacts.require("IssuanceManager");
const HostChainIssuer = artifacts.require("HostChainIssuerV1");

module.exports = async function (deployer, network, accounts) {
    let WETH;
    if(network == "eth_dev" || network == "live_eth"){
        WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    }else if(network == "poly_dev"){
        WETH = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
    }

    await deployer.deploy(IssuanceManager, WETH, 0);
    const instance = await IssuanceManager.deployed();
    const indInst = await IndexToken.deployed();
    await indInst.addNode(instance.address);
    
    if(network != "eth_dev"){
        await instance
        .seedNewSet(indInst.address, 10000000, accounts[2], {from: accounts[2], value: web3.utils.toBN("570800000000000000")});
    }else{
        const hcInst = await HostChainIssuer.deployed();
        await hcInst.updateIssuer(instance.address);
    }
};