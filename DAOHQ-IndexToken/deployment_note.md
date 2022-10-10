# Deployment Steps and Guidelines

## Basic Index Deployment(any chain)

1. Deploy `IndexToken.sol`
    - name: string, name of token 
    - symbol: string, symbol of token 
    - feeWallet: address, address of transfer fee feeWallet 
    - startPrice: number, Price in wei(native) of first(seed) purchase for 1 ether token
    - components: List of addresses, WETH/ERC20 token pools of IndexComponents
    - externalComponents: List of hash(address, chainId) of external tokens
    - shares: List of numbers, proportion of share. relative to index of components-externalComponents
2. Deploy `IssuanceManagerNode.sol`
    - WETH: address, address of wNative on given deploy chain
3. Deploy `ManagermentFeeNode.sol`
    - manager: address, manager of fees and token
    - fee: number, fee APR with a 10000 denominator
4. Add Nodes to IndexToken via manager account
    - `IndexToken.methods.addNode(IssuanceAddress).send({from: manager})`
    - `IndexToken.methods.addNode(ManagerFeeNode).send({from: manager})`
5. Seed IndexToken. Must occur before IssuanceAddress
    - `IssuanceManager.methods.seedNewSet(indexToken, 0, wallet).send({value: someValue})`

## MultiChain Deployment

1. For each side chain deployment(chainId != 1) deploy `SidedChainManager.sol`
    - bridge: address, address of Hyphen Bridge on this chain
    - wPool: address, LP of WETH/wNative(ie WETH/WMATIC)
    - WETH: address, address of wNative(ie WMATIC)
2. Deploy `HostChainIssuer.sol` on host chain
    - uri: string, uri to ERC1155 details
    - manager: address, manager acct(used in backend service)
    - WETH: address, WETH address
    - bridge: address, Hyphen bridge address
    - approvedIssuer: address, IssuanceManagerNode address\
    2.1 For each side chain deployment\
    - `HostChainIssuer.methods.addSideChain(chainId, scAddress).send({from:manager})`
3. Add external components to IndexToken. For each chainId
    - `IndexToken.addEditExternalPosition(hash(HostChainIssuer, chainId), share).send()`
4. Start Backend service. Addresses required
    - Host IndexToken
    - Host IssuanceManager
    - HostChainIssuer\ 
    For each Side Chain\ 
    - Side token
    - Side IssuanceAddress
    - SidedChainManager

NOTE: All SideChainManager + HostChainIssuer deployment addresses must be Whitelisted with Hyphen/Biconomy
## Backend requirements 

- Backend Service Must
    - Listen for the following Host Chain events
        - Deposit - wait for WETH to bridge, call complete Bridge for given SidedChainManager
        - Withdraw - Call SideChainManager and initiate redemption
    - Listen for the following SideChain events
        - Issued - Get amount of SC index tokens issued and call HostChainIssuer to issue on host
        - redemption - Log rededmption 
    - Provide API endpoint for external index valuation
        1. get set value of given chainId
        2. sign data with Host manager address
        3. provide result to caller for use in Issuance and valuation