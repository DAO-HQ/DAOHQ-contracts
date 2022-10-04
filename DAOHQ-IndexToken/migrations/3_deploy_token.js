const IndexToken = artifacts.require("IndexToken");
const HostChainIssuer = artifacts.require("HostChainIssuer");

module.exports = async function (deployer, network, accounts) {
    /*const tokens = ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5", "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
                    "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", "0x853d955aCEf822Db058eb8505911ED77F175b99e",
                    "0x111111111117dC0aa78b770fA6A738034120C302", "0x476c5E26a75bd202a9683ffD34359C0CC15be0fF","0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
                    "0xc00e94Cb662C3520282E6f5717214004A7f26888"]*/
    
    let pools;
    let shares;
    let external;
    if(network == "eth_dev"){
         pools = ["0xd3d2E2692501A5c9Ca623199D38826e513033a17", "0xE12af1218b4e9272e9628D7c7Dc6354D137D024e", "0xb011EEaab8bF0c6DE75510128dA95498E4b7e67F",
                        "0x454F11D58E27858926d7a4ECE8bfEA2c33E97B13", "0x11b1f53204d03E5529F09EB3091939e4Fd8c9CF3", /*"0xFD0A40Bc83C5faE4203DEc7e5929B446b07d1C76",
                        "0x26aAd2da94C59524ac0D93F6D6Cbf9071d7086f2", "0xCc3d1EceF1F9fD25599dbeA2755019DC09db3c54", "0x43AE24960e5534731Fc831386c07755A2dc33D47",
    "0xCFfDdeD873554F362Ac02f8Fb1f02E5ada10516f", "0x05767d9EF41dC40689678fFca0608878fb3dE906", "0xA70d458A4d9Bc0e6571565faee18a48dA5c0D593"*/]
         shares = [1000, 1000, 1000, 1000, 1000, /*1000/* 1000, 1000, 1000, 1000, 1000, 1000, 1000*/];
        const hcInst = await HostChainIssuer.deployed();
        //external = [web3.eth.abi.encodeParameters(['address', 'uint16'], [hcInst.address, 137])];
        external = []
     }else{
         pools = ["0xEEf611894CeaE652979C9D0DaE1dEb597790C6eE", "0x604229c960e5CACF2aaEAc8Be68Ac07BA9dF81c3"]
         shares = [1000, 1000]
         external = [];
    }

    await deployer.deploy(IndexToken,
         "TestIndex",
         "TIDX",
         accounts[0], 
         web3.utils.toBN("57080000000000000"),
         pools,
         external,
         shares);
};