const Buffer = require('buffer');
const wh = require("@certusone/wormhole-sdk");
const Web3 = require("web3");
//Need one for each chain
const web3ETH = new Web3("127.0.0.1");
const web3Poly = new Web3("127.0.0.2");

var fs = require('fs');
//one for each chain
const hostChainIssuer = "";
const hostChainAbi = ""
const sideChainManager = "";
const sideChainAbi = "";
const hcContract = new web3ETH.eth.Contract(hostChainAbi, hostChainIssuer);
const scContract = new web3Poly.eth.Contract(sideChainAbi, sideChainManager);

const bridges = {
    //ETH
    2: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    5: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7"
}
async function monitorHostChainIssuance(){
    while(true){
        hcContract.events.Deposit()
        .on('data', async function(event){
            const emitterAddress = wh.getEmitterAddressEth(bridges[2]);
            //TODO: retry
            const signedVAA = await wh.getSignedVAA(
                wh.WORMHOLE_RPC_HOST,
                2,
                emitterAddress,
                event["returnedValues"][seq]  
            )
            await scContract.methods
            .completeBridge(Buffer.from(signedVAA.vaaBytes, "base64"))
            .send();
        });
    }
}

async function monitorSideChainIssuance(){
    //TODO:dynamic to sidechain ID
    while(true){
        scContract.events.Issued()
        .on('data', async function(event){
            await hcContract.methods
            .notifyBridgeCompletion(event.returnedValues.amtIssue, 5)
            .send();
        })
    }
}

async function monitorHostChainRedemption(){
    while(true){
        hcContract.events.Withdraw()
        .on('data', async function(event){
            await scContract.methods
            .redeem(event.returnedValues.amt, event.returnedValues.chainId, "")
            .send();
        });
    }
}

async function monitorSideChainRedemption(){
    //TODO:dynamic to sidechain ID
    while(true){
        scContract.events.Redemption()
        .on('data', async function(event){
            const emitterAddress = wh.getEmitterAddressEth(bridges[5]);
            //TODO:Retry logic
            const signedVAA = await wh.getSignedVAA(
                wh.WORMHOLE_RPC_HOST,
                5,
                emitterAddress,
                event.returnedValues.seq
            )
            await hcContract.methods
            .completeWithdrawl(Buffer.from(signedVAA.vaaBytes, 'base64'), event.returnedValues.to)
            .send();
        })
    }
}
