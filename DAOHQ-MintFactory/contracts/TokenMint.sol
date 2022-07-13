// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenMint {
  IERC20 mintToken;

  address public owner;
  address public operator;
  address public tokenSource;
  uint256 public mintPrice;
  uint256 public fee = 400;
  uint256 public feesPending = 0;
  bool public boostEnabled = false;
  bool public paused;
  uint256[] public boostLevels;
  mapping(uint256 => uint256) public boostAmounts;

  event Mint(address user, uint256 amountMinted, uint256 mintPrice);

  constructor(address _owner,
              address _operator,
              uint256 _mintPrice,
              address _token,
              address _tokenSource)
  {
    owner = _owner;
    operator = _operator;
    mintPrice = _mintPrice;
    mintToken = IERC20(_token);
    tokenSource = _tokenSource;
  }

  modifier isOwner(){
    require(msg.sender == owner, "Function Restricted to Owner");
    _;
  }

  modifier isOperator(){
    require(msg.sender == operator, "Function Restricted to Operator");
    _;
  }

  modifier isPaused(){
    require(!paused, "Mint is Paused");
    _;
  }

  function mint(uint256 amount) external isPaused payable{
    require((amount * mintPrice) / 1e18 == msg.value, "Incorrect Value");
    require(mintToken.allowance(owner, address(this)) >= amount, "Mint capped or hasnt been approved");
    feesPending += (msg.value * fee)/10000;
    if(boostEnabled && msg.value >= boostLevels[0]){
      for(uint i = 1; i < boostLevels.length ; i++){
        if(boostLevels[i] > msg.value){
          amount = (amount * boostAmounts[i - 1]) / 100;
          break;
        }else if(i == boostLevels.length - 1){
          amount = (amount * boostAmounts[i]) / 100;
        }
      }
    }
    mintToken.transferFrom(tokenSource, msg.sender, amount);
    emit Mint(msg.sender, amount, mintPrice);
  }

  function withdrawProceeds(address to) external isOwner {
    require(address(this).balance - feesPending > 0, "No proceeds pending");
    uint amountToTransfer = address(this).balance - feesPending;

    (bool sent, ) = payable(to).call{value: amountToTransfer}("");
    require(sent, "Failed to Transfer");
  }

  function withdrawFees(address to) external isOperator {
    require(feesPending > 0, "No fees pending");
    (bool sent, ) = payable(to).call{value: feesPending}("");
    require(sent, "Failed to Transfer");

    feesPending = 0;
  }
  
  function enableDisableBoost(uint256[] memory _boostLevels, uint256[] memory _boostAmounts) external isOwner{
    require(_boostAmounts.length == _boostLevels.length, "Must include values for all boost levels");
    if(boostEnabled){
      boostEnabled = false;
    }else if(_boostLevels.length > 0){
      boostEnabled = true;
      boostLevels = _boostLevels;
      for(uint i = 0; i < _boostLevels.length; i++){
        boostAmounts[i] = _boostAmounts[i] + 100;
      }
    }else{
      require(boostLevels.length > 0, "Must pass levels and amounts to enable");
      boostEnabled = true;
    }
  }

  function updatePrice(uint256 newPrice) external isOwner {
    mintPrice = newPrice;
  }

  function updateFee(uint newFee) external isOperator{
    fee = newFee;
  }

  function updatePause(bool _isPaused) external isOwner {
    paused = _isPaused;
  }

  function updateTokenSource(address source) external isOwner {
    tokenSource = source;
  }

  receive() external payable {}

  fallback() external payable{}

}
