# DAOHQ OTC Market 

The DAOHQ OTC Market contracts facilitate escrow-like OTC trades p2p between DAOHQ users across the DAO ecosystem

## Deployments

[```DAOHQotc.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-OTC/contracts/DAOHQotc.sol)
* Ethereum Mainnet: 0xd357181b3b3323Db7307a51e41F3e23589E442c0
* Polygon PoS: 0x8C85024bcD73B07C5F6fa0534964Bc67633F308C
* Avalanche C-Chain: 0xA5830E42d4250918826f8E954A3b849B952Ca165
* Binance Smart Chain: 0xA5830E42d4250918826f8E954A3b849B952Ca165

## Functionality

### OTC Contract: [```DAOHQotc.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-OTC/contracts/DAOHQotc.sol)

The Otc contract accepts buy and sell orders for any give ERC20 token. A buy order locks users native tokens and completes transaction when another user fills with the required amount of the given ERC20 token.