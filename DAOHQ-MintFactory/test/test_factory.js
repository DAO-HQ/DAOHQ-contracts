const Web3 = require('web3');
var fs = require('fs');

const web3 = new Web3(new Web3.providers.HttpProvider("HTTP://127.0.0.1:9545"));

var erc20abi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-MintFactory/build/contracts/IERC20.json")).abi;
var factoryAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-MintFactory/build/contracts/MintFactory.json")).abi;
var mintAbi = JSON.parse(fs.readFileSync("C:/Users/Ian/DAOHQ-contracts/DAOHQ-MintFactory/build/contracts/TokenMint.json")).abi;
var tokenAddr = "0x78535BB7f5712d6b8B386677be0e28683f5ed2f4"
var factoryAddr = "0x5DB8c3327dA34bbE09778a49bED077A4372B50c8"

var tokCon = new web3.eth.Contract(erc20abi, tokenAddr);
var factoryCon = new web3.eth.Contract(factoryAbi, factoryAddr);

async function getAccount(i) {
    let accounts = await web3.eth.getAccounts()
    return accounts[i]
}

function toBN(bal){
    return web3.utils.toBN(web3.utils.toHex(bal.toLocaleString('fullwide', {useGrouping:false})))
}

async function approve(total, i, addr){
    let account = await getAccount(i);
    await tokCon.methods.approve(addr, web3.utils.toWei(String(total), 'ether')).send({from: account});
    console.log(await tokCon.methods.allowance(account, addr).call())
}

async function deployMintandApprove(i, price){
    let account = await getAccount(i);
    console.log("creating factory from: " + account)
    let weiPrice = web3.utils.toWei(String(price), 'ether')
    console.log(weiPrice)
    let address = await factoryCon.methods.createNewMint(tokenAddr, account, weiPrice).send({from: account, gasLimit: 3053658})
    //console.log(address)
    let newAddress = await factoryCon.methods.getMintAddress(tokenAddr).call()
    console.log("Mint Deployed at: " + newAddress);

    // approves 50 tokens 
    await approve(50, i, newAddress)

    let mintCon = new web3.eth.Contract(mintAbi, newAddress);
    let owner = await mintCon.methods.owner().call()
    let mprice = await mintCon.methods.mintPrice().call()

    let ownerTest = owner == account ? "Pass" : "Fail" 
    let priceTest = mprice == weiPrice ? "Pass" : "Fail" 
    console.log("Owner Test Result: " + ownerTest)
    console.log("price test Result: " + priceTest)
}

async function mintTest(mintaccount, totalToMint, boostExpected) {
    let account = await getAccount(mintaccount);
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call()
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);
    let convertTotal = web3.utils.toBN(web3.utils.toWei(String(totalToMint), 'ether'));

    web3.eth.getBalance(account).then((balance) =>{console.log("Initial Wallet Bal: " + web3.utils.fromWei(balance))});
    web3.eth.getBalance(mintAddr).then((balance) =>{console.log("Initial Contract Bal: " + web3.utils.fromWei(balance))});
    let bal0 = await tokCon.methods.balanceOf(account).call()
    console.log("Init Balance of token: " + bal0);
    console.log(`Minting ${totalToMint} tokens for ${0.5 * totalToMint} MATIC`);

    await mintCon.methods.mint(convertTotal).send({from: account, value: 0.5 * convertTotal});

    web3.eth.getBalance(account).then((balance) =>{console.log("New Wallet Bal(MATIC): " + web3.utils.fromWei(balance))});
    web3.eth.getBalance(mintAddr).then((balance) =>{console.log("New Contract Bal(MATIC): " + web3.utils.fromWei(balance))});

    let bal = toBN(await tokCon.methods.balanceOf(account).call())
    console.log("New Balance of token: " + bal);
    let test = (totalToMint * boostExpected) == (bal - bal0)/1e18 ? "Pass" : "Fail" 
    console.log("Test Result: " + test);
}

async function withdrawProceed(account){
    let owner = await getAccount(account);
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call();
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);

    let initBal = await web3.eth.getBalance(owner);
    let initBalCon = await web3.eth.getBalance(mintAddr);
    let feesHold = await mintCon.methods.feesPending().call()
    let expectedWithdraw = parseInt(feesHold)
    console.log(expectedWithdraw);
    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(initBal)} and Contract bal: ${web3.utils.fromWei(initBalCon)}`)

    await mintCon.methods.withdrawProceeds(owner).send({from: owner});

    let Bal = await web3.eth.getBalance(owner);
    let BalCon = await web3.eth.getBalance(mintAddr);

    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(Bal)} and Contract bal: ${web3.utils.fromWei(BalCon)}`)
    let test =  BalCon == expectedWithdraw ? "Pass" : "Fail" 
    console.log("Test Result: " + test)
}

async function withdrawFees(factoryOwner){
    let owner = await getAccount(factoryOwner);
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call();
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);
    let initBal = await web3.eth.getBalance(owner);
    let initBalCon = await web3.eth.getBalance(mintAddr);

    let fees = await mintCon.methods.feesPending().call()
    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(initBal)} and Contract bal: ${web3.utils.fromWei(initBalCon)}`)

    await mintCon.methods.withdrawFees(owner).send({from: owner});

    let Bal = await web3.eth.getBalance(owner);
    let BalCon = await web3.eth.getBalance(mintAddr);

    console.log(`Initial Wallet Balance is ${web3.utils.fromWei(Bal)} and Contract bal: ${web3.utils.fromWei(BalCon)}`)
    let test = BalCon == initBalCon - parseInt(fees) ? "Pass" : "Fail" 
    console.log("Fee withdraw test result: " + test);
}

async function changeMintPrice(owner, newPrice){
    let account = await getAccount(owner);
    let weiPrice = web3.utils.toWei(String(newPrice), 'ether')
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call();
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);

    await mintCon.methods.updatePrice(weiPrice).send({from: account});
    let newConPrice = await mintCon.methods.mintPrice().call()

    let test = weiPrice == newConPrice ? "Pass" : "Fail"
    console.log("Price Change test result: " + test);
}

async function changefee(operator, newfee){
    let account = await getAccount(operator);
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call();
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);

    await mintCon.methods.updateFee(newfee).send({from: account});
    let newConPrice = await mintCon.methods.fee().call()

    let test =  newConPrice == newfee ? "Pass" : "Fail"
    console.log("Fee Change test result: " + test);
}

async function addBoost(owner, boostLevels, boostAmounts){
    let account = await getAccount(owner);
    let mintAddr = await factoryCon.methods.getMintAddress(tokenAddr).call();
    let mintCon = new web3.eth.Contract(mintAbi, mintAddr);
    await mintCon.methods.enableDisableBoost(boostLevels, boostAmounts)
    .send({from: account});
}

//account 4 owns tokens(ie owner of mint), account 0 owns factory(ie operator)
let tokenOwner = 4
let factoryOwnerOp = 0
let boostlevels = [toBN(2000000000000000000), toBN(4000000000000000000)];
let boostAmoutns = [10, 20];

//deployMintandApprove(tokenOwner, 0.5)

//addBoost(tokenOwner, boostlevels, boostAmoutns);

mintTest(6, 5, 1.1)

//withdrawProceed(tokenOwner)

//withdrawFees(factoryOwnerOp)

//changeMintPrice(tokenOwner, 1)

//changefee(factoryOwnerOp, 250)

