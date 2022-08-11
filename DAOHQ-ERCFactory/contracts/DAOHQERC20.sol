// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAOHQERC20 is ERC20, ERC20Burnable, Ownable{
  bool public mintable;
  bool public burnable;

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 initSupply,
    uint256 fee,
    address supplyWallet,
    bool _mintable,
    bool _burnable
  ) public ERC20(_name, _symbol) {
    mintable = true;
    uint256 feeAmount = (initSupply * fee) / 10000;
    _mint(owner(), feeAmount);
    _mint(supplyWallet, initSupply);
    mintable = _mintable;
    burnable = _burnable;
  }
  
  function _mint(address to, uint256 amount) internal override(ERC20){
    require(mintable, "note mintable");
    super._mint(to, amount);
  }

  function _burn(address account, uint256 amount) internal override(ERC20){
    require(burnable, "not burnable");
    super._burn(account, amount);
  }

  function mint(address to, uint256 amount) public onlyOwner {
      _mint(to, amount);
  }

}