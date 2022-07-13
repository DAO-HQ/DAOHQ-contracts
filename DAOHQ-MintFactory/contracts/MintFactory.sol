// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "./TokenMint.sol";

contract DaoHQMintFactory {
  address public factoryOwner;
  mapping(address => address) private mintAddresses;

  constructor() {
    factoryOwner = msg.sender;
  }

  function createNewMint(address token, address tokenSource, uint256 mintPrice) external returns(address){
    require(mintAddresses[token] == address(0), "cannot create another mint for this token");
    TokenMint mintContract = new TokenMint(msg.sender, factoryOwner, mintPrice, token, tokenSource);

    mintAddresses[token] = address(mintContract);
    return address(mintContract);
  }

  function getMintAddress(address tokenAddr) external view returns(address){
    return mintAddresses[tokenAddr];
  }

  function transferFactory(address newOwner) external {
    require(msg.sender == factoryOwner, "Not Authorized");
    factoryOwner = newOwner;
  }
}
