const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const express = require('express');
const axios = require('axios').default;
const app = express()
const port = 3005
const hostChainAbi = JSON.parse(fs.readFileSync("./contracts/HostChainIssuer.json")).abi;
const sideChainAbi = JSON.parse(fs.readFileSync("./contracts/SideChainManager.json")).abi;
const ITokenabi = JSON.parse(fs.readFileSync("./contracts/IToken.json")).abi;
const IssueAbi = JSON.parse(fs.readFileSync("./contracts/IssuanceManager.json")).abi;
const WETHabi = ""
const secret = ""

const chainInfo = {
    //Host chain Schema
    1: {
        hostChainIssuer: "",
        token: "",
        issueNode: "",
        hcContract: null,
        provider: new Web3(
            new HDWalletProvider(
                {
                    privateKeys: [secret],
                    providerOrUrl: new Web3.providers.WebsocketProvider("ws://127.0.0.1:7545")
                })
            )
    },
    //SideChain schema
    137: {
        sideChainManager: "",
        token: "",
        issueNode: "",
        bridge: "",
        WETH: "",
        scContract: null,
        isContract: null,
        tokContract: null,
        wethContract: null,
        provider: new Web3(
            new HDWalletProvider(
                {
                    privateKeys: [secret],
                    providerOrUrl: new Web3.providers.WebsocketProvider("ws://127.0.0.1:7545")
                })
            )
    }
}

chainInfo[1].hcContract = new chainInfo[1].provider
.eth.Contract(hostChainAbi, chainInfo[1].hostChainIssuer);

chainInfo.keys().forEach(chainId => {
    if(chainId != 1){
        chainInfo[chainId].scContract =
         new chainInfo[chainId].provider
         .eth.Contract(sideChainAbi, chainInfo[chainId].sideChainManager);

         chainInfo[chainId].tokContract = 
         new chainInfo[chainId].provider
         .eth.Contract(ITokenabi, chainInfo[chainId].token)

         chainInfo[chainId].isContract = 
         new chainInfo[chainId].provider
         .eth.Contract(ITokenabi, chainInfo[chainId].issueNode)

         chainInfo[chainId].wethContract = 
         new chainInfo[chainId].provider
         .eth.Contract(WETHabi, chainInfo[chainId].WETH)
    }
});

//Event Listener region

function subscribeListeners() {

    chainInfo[1].hcContract.events.Deposit({
        fromBlock: 'latest'
    }, function(error, event){ if(error){console.log(error);} })
    .on('connected',  function(subscriptionId){
        console.log(subscriptionId);
    })
    .on('data', function(event){
        const chainData = chainInfo[event.returnValues.chainId];
        chainData.wethContract.once("Transfer", {
            filter: {src: chainData.bridge, dst: chainData.scContract},
            fromBlock: 'latest'
        }, function(error, event){
             chainData.scContract
             .methods
             .completeBridge(chainData.token, chainData.issueNode)
             .send()
             .then(console.log("funds bridged"));
        });
    });

    chainInfo[1].hcContract.events.Withdraw()
    .on('connected',  function(subscriptionId){
        console.log(subscriptionId);
    })
    .on('data', function(event){
        const chainData = chainInfo[event.returnValues.chainId];

        chainData.scContract
        .methods
        .redeem(event.returnValues.amt, event.returnValues.toUser, chainData.token, chainData.issueNode)
        .send({from: result[0], gasLimit: 4000000})
        .then(console.log("Funds withdrawn and bridged"));
    });

    chainInfo.keys().forEach(chainId => {
        if(chainId != 1){
            const chainData = chainInfo[chainId];

            chainData.scContract.events.Issued()
            .on('connected',  function(subscriptionId){
                console.log(subscriptionId);
            })
            .on('data', function(event){
                chainInfo[1].hcContract
                .methods
                .notifyBridgeCompletion(event.returnValues.amtIssue, chainId, indexToken, IssuanceNode)
                .send()
                .then(console.log("complete Deposit"));
            })
        }
    })

}

// Start Listensing for events

//subscribeListeners()

//start server 

//app.listen(port)
//console.log('Server started at http://localhost:' + port);