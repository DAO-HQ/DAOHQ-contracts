# DAOHQ Multi-Chain Index Token

The DAOHQ Index Token protocol allows for ERC20 Tokens that can track an index of any number of underlying ERC20 components.
The Index Token Protocol includes infrastructure to support Index Tokens with underlying components on sidechains and L2s other than mainnet.

## Deployments:

[```IndexToken.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/IndexToken.sol)
* Ethereum Mainnet (Main Token): 0x08b9D2A2E57C8e36b830eCe54916B2eF4eddF33E
* Polygon PoS (Sidechain Component Token): 0x703af847700fb4ec3087189901d3541752c4bbb0

[```IssuanceManagerNode.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/nodes/IssuanceManagerNode.sol)
* Ethereum Mainnet(Main Token Issuer): 0xdE86f4Dc0A3D46deC105F81E8B0b85217f8A0F97
* Polygon PoS (Sidechain Component Issuer): 0xDEc6605739A024E296adA0bc8666487cAbD5382e

[```HostChainIssuer.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/multi-chain/HostChainIssuer.sol)
* Ethereum Mainnet: 0xDEc6605739A024E296adA0bc8666487cAbD5382e

[```SideChainManager.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/multi-chain/SideChainManager.sol)
* Polygon PoS: 0x5ad5ccbe01705df6fffdfff11102738f06a1d29d

[```ManagementFeeNode.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/nodes/managmentFeeNode.sol)
* Ethereum Mainnet: 0x3D01FDb58488745df0CDaC58BFE8918045f35297

## Functionality

### Index Token Contract: [```IndexToken.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/IndexToken.sol)

Wrapper functionality over a standard ERC20 contract. Allows for Node/Manager access control, transparent component data storage(LPs and share), and fee structure.

### Issuance Manager Contract: [```IssuanceManagerNode.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/nodes/IssuanceManagerNode.sol)

Includes functionality, once added as a Node to Index Contract, to issue, redeem, and rebalance Index Tokens. Receives payment in native currency and purchases components in line with current weightings, mints respective share to purchaser. Vice versa for Redemption, sells components and returns native currency, buring Index Tokens. Single Issuance Contract can manage multiple Index Tokens as approved.

### Host Chain Bridge Manager: [```HostChainIssuer.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/multi-chain/HostChainIssuer.sol)

When an index token holds components on other chains, those funds are sent through this contract from the Issuance Manager. Using a selected bridge, funds are sent to respective side chain. This contract keeps accounting of pending WETH in the meantime, which will be accounted for in Index Valuation as a holding until bridge is complete. Upon bridge completion Host Chain Manager is notified of amount of side chain holdings and mints an ERC1155 NFT with chain id to the Index Token to represent sidechain holdings. (Ex. Index token holds 200 ERC1155[id = 137] means Index Token holds 200 Polygon Index tokens). Buring of a ERC1155(via redemption) triggers a sale and reverse bridge back to ETH of the sidechain asset.

### Side Chain Manager Contract: [```SideChainManager.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/multi-chain/SideChainManager.sol)

Receives funds from ETH bridge and purchases sidechain Index Tokens on behald of mainnet Index Token. Holds the side chain ERC20 Index Tokens in contract and notifies mainnet Host chain Issuer of balance. Balance of ERC20 Index in this contract == Balance of ERC1155 held by Index Token at all times. For redemption, sells Index holdings and bridges proceeds back to mainnet.

### Management Fee Node: [```ManagementFeeNode.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-IndexToken/contracts/nodes/managmentFeeNode.sol)

Tracks, accrues, and realizes management fees for any number of Index Tokens. Pays APR based fees at any time to managers in Index Token via inflation of Index Token(ie minting). 

