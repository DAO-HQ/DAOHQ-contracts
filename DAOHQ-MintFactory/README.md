# DAOHQ ICO/Mint Factory

The DAOHQ mint factory allows users to set up and deployment token ICO contracts for their new pre-sale tokens. DAOHQ can collect a fee on all mint proceeds from all deployed mint contracts.

## Deployments

[```MintFactory.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-MintFactory/contracts/MintFactory.sol)
* Polygon PoS: 0x64190FfAe0547eF9e2D8BB23B0FBA2d60cF2962f

[```TokenMint.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-MintFactory/contracts/MintFactory.sol)
Unlimited deployements, below is TFT tokens Mint Contract
* Polygon PoS: 0x12Bdb13837Cfd04A42172394A4FD70F75684e57a

## Functionality

### Mint Factory Contract: [```MintFactory.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-MintFactory/contracts/MintFactory.sol)

The mint factory allows users to set up a token mint with price, supply cap, boost incentive purchase levels, and more. Upon transaction a fresh TokenMint contract is deployed with the user as the owner/manager and DAOHQ as a fee collector.

### Token Mint Contract: [```TokenMint.sol```](https://github.com/DAO-HQ/DAOHQ-contracts/blob/main/DAOHQ-MintFactory/contracts/MintFactory.sol)

Token ICO/Mint deployed by each use of Mint Factory. Allows users to pay a certain amount of Native Token and receive respective ICO Tokens with potential boost incentives for different puchase levels. The token owner can change price, supply, boosts, and pause at any time. DAOHQ can withdraw fees at any time. 