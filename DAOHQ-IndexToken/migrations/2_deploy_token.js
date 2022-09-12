const IndexToken = artifacts.require("IndexToken");

module.exports = function (deployer, accounts) {
    const tokens = ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "0x1A4b46696b2bB4794Eb3D4c26f1c55F9170fa4C5", "0x4d224452801ACEd8B2F0aebE155379bb5D594381",
                    "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", "0x0F5D2fB29fb7d3CFeE444a200298f468908cC942", "0x853d955aCEf822Db058eb8505911ED77F175b99e",
                    "0x111111111117dC0aa78b770fA6A738034120C302", "0x476c5E26a75bd202a9683ffD34359C0CC15be0fF","0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
                    "0xc00e94Cb662C3520282E6f5717214004A7f26888"]
    const shares = [1000, 1000, 1000,
                    1000, 1000, 1000,
                    1000, 1000, 1000, 1000];
    deployer.deploy("TestIndex", "TIDX", accounts[0], 1e15, tokens, shares);
};