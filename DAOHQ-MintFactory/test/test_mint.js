const Web3 = require('web3');
var fs = require('fs');

const web3 = new Web3(new Web3.providers.HttpProvider("HTTP://127.0.0.1:9545"));

var erc20abi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-MintFactory/build/contracts/IERC20.json")).abi;
var mintAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-MintFactory/build/contracts/TokenMint.json")).abi;
var tokenAddr = "0xF0a1b0cBFd8917e6424EC56123c62A1c0218b370"
var mintAddr = "0x2163dE65D266b3f1d348Aac5e95A8D3e99446dA0"

var tokCon = new web3.eth.Contract(erc20abi, tokenAddr);
var mintCon = new web3.eth.Contract(mintAbi, mintAddr);

async function getAccount(i) {
    let accounts = await web3.eth.getAccounts()
    return accounts[i]
}

function toBN(bal){
    return web3.utils.toBN(web3.utils.toHex(bal.toLocaleString('fullwide', {useGrouping:false})))
}

async function approve(total){
    let account = await getAccount(0);
    await tokCon.methods.approve(mintAddr, web3.utils.toWei(String(total), 'ether')).send({from: account});
    console.log(await tokCon.methods.allowance(account, mintAddr).call())
}

async function mintTest(mintaccount, totalToMint) {
    let account = await getAccount(mintaccount);

    let convertTotal = web3.utils.toBN(web3.utils.toWei(String(totalToMint), 'ether'));

    web3.eth.getBalance(account).then((balance) =>{console.log("Initial Wallet Bal: " + web3.utils.fromWei(balance))});
    web3.eth.getBalance(mintAddr).then((balance) =>{console.log("Initial Contract Bal: " + web3.utils.fromWei(balance))});
    let bal0 = await tokCon.methods.balanceOf(account).call()
    console.log("Init Balance of token: " + bal0);
    console.log(`Minting ${totalToMint} tokens for ${totalToMint} MATIC`);

    await mintCon.methods.mint(convertTotal).send({from: account, value: convertTotal});

    web3.eth.getBalance(account).then((balance) =>{console.log("New Wallet Bal(MATIC): " + web3.utils.fromWei(balance))});
    web3.eth.getBalance(mintAddr).then((balance) =>{console.log("New Contract Bal(MATIC): " + web3.utils.fromWei(balance))});

    let bal = toBN(await tokCon.methods.balanceOf(account).call())
    console.log("New Balance of token: " + bal);
    console.log(totalToMint == bal/1e18);
}

async function withdrawProceed(){
    let owner = await getAccount(0);

    let initBal = await web3.eth.getBalance(owner);
    let initBalCon = await web3.eth.getBalance(mintAddr);
    let expectedWithdraw = parseInt(initBalCon) * 0.025;
    console.log(expectedWithdraw);
    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(initBal)} and Contract bal: ${web3.utils.fromWei(initBalCon)}`)

    await mintCon.methods.withdrawProceeds(owner).send({from: owner});

    let Bal = await web3.eth.getBalance(owner);
    let BalCon = await web3.eth.getBalance(mintAddr);

    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(Bal)} and Contract bal: ${web3.utils.fromWei(BalCon)}`)
    console.log(BalCon == expectedWithdraw)
}

async function withdrawFees(){
    let owner = await getAccount(1);

    let initBal = await web3.eth.getBalance(owner);
    let initBalCon = await web3.eth.getBalance(mintAddr);

    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(initBal)} and Contract bal: ${web3.utils.fromWei(initBalCon)}`)

    await mintCon.methods.withdrawFees(owner).send({from: owner});

    let Bal = await web3.eth.getBalance(owner);
    let BalCon = await web3.eth.getBalance(mintAddr);

    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(Bal)} and Contract bal: ${web3.utils.fromWei(BalCon)}`)
}

//approve(50).then(console.log("Tx done"));
//mintTest(3, 5).then(console.log("Tx done"));
//withdrawProceed().then(console.log("Tx done"));
//withdrawFees().then(console.log("Tx done"));



