pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./IToken.sol";

contract IndexToken is ERC20, ERC1155Holder, IToken{

    address feeWallet;
    //TODO: add update function?
    uint256 private constant transferFeed = 30;
    uint256 public immutable basePrice;
    uint256 private cumulativeShare = 0;
    address[] private components;
    externalPosition[] private externalComponents;
    //external address = hash(externalcontract, id)
    mapping(address => uint256) private share;
    mapping(address => bool) public managers;
    mapping(address => bool) public nodes;

    constructor(string memory _name, string memory _symbol, address _feeWallet,
                uint256 startPrice,
                address[] memory _components,
                bytes[] memory _externalComponents,
                uint256[] memory _shares
                ) 
                ERC20(_name, _symbol)
                {
                    components = _components;
                    for (uint i = 0; i < _shares.length; i++ ){
                        if(i < _components.length){
                            share[_components[i]] = _shares[i];
                        }else{
                            externalPosition memory ext;
                            (ext.externalContract, ext.id) = abi.decode(_externalComponents[_components.length - i], (address, uint16));
                            externalComponents.push(ext);
                            share[address(uint160(uint256(keccak256(_externalComponents[_components.length - i]))))] = _shares[i];
                        }
                        cumulativeShare += _shares[i];
                    }
                    managers[msg.sender] = true;
                    feeWallet = _feeWallet;
                    basePrice = startPrice;
                }

    modifier onlyNode(){
        require(nodes[msg.sender], "restricted node function");
        _;
    } 

    modifier onlyManager(){
        require(managers[msg.sender], "restricted manager function");
        _;
    }

    function burn(address _account, uint256 _amount) override external onlyNode{
        _burn(_account, _amount);
    }

    function mint(address _account, uint256 _quantity) override external onlyNode {
        _mint(_account, _quantity);
    }

    function approveComponent(address _token, address _spender, uint256 _amount) override external onlyNode {
        IERC20(_token).approve(_spender, _amount);
    }   

    function editComponent(address _component, uint256 _newShare) override external onlyManager{
        (uint256 i, bool exists) = _indexOf(components, _component);
        if(!exists){
            _addComponent(_component, _newShare);
        }else{
            require(_newShare > 0);
            _updateCumulativeShare(_newShare, _component);
            share[_component] = _newShare;
        }
    }

    function _updateCumulativeShare(uint256 newShare, address component)private {
        uint256 oldShare = share[component];
        if(newShare >= oldShare){
            cumulativeShare += newShare - oldShare;
        }else{
            cumulativeShare -= oldShare - newShare;
        }
    }

    function _addComponent(address _component, uint256 shares) private {
        components.push(_component);
        share[_component] = shares;
        cumulativeShare += shares;
    }

    function _removeComponent(address _component) private {
        cumulativeShare -= share[_component];
        share[_component] = 0;
    }

    function replaceComponent(address _componentAdd, address _componentRm, uint256 newShare) external onlyManager{
        (uint256 i, bool exists) = _indexOf(components, _componentRm);
        require(exists, "component does not exist");
        components[i] = _componentAdd;
        _updateCumulativeShare(newShare, _componentRm);
        share[_componentAdd] = newShare;
        share[_componentRm] = 0;
    }

    function addNode(address _node) external onlyManager{
        nodes[_node] = true;
    }

    function removeNode(address _node) external onlyManager{
        nodes[_node] = false;
    }

    function getComponents() override external view returns(address[] memory){
        return components;
    }

    function getExternalComponents() override external view returns(externalPosition[] memory){
        return externalComponents;
    }

    function getShare(address _component) override external view returns(uint){
        return share[_component]; 
    }

    function getCumulativeShare() override external view returns(uint256){
        return cumulativeShare;
    }

    function _transferFeeAmount(uint256 amount) private pure returns(uint256){
        return (amount * transferFeed)/10000;
    }

    function transfer(address to, uint256 amount)
     public virtual override(ERC20,IERC20) returns (bool) {
        address owner = _msgSender();
        uint256 feeAmount = _transferFeeAmount(amount);
        //TODO: create custom internal ERC _transfer to save gas
        _transfer(owner, feeWallet, feeAmount);
        _transfer(owner, to, amount-feeAmount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
     public virtual override(ERC20, IERC20) returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        uint256 feeAmount = _transferFeeAmount(amount);
        //TODO: same as transfer
        _transfer(from, feeWallet, feeAmount);
        _transfer(from, to, amount - feeAmount);
        return true;
    }

    function _indexOf(address[] memory A, address a) internal pure returns (uint256, bool) {
        uint256 length = A.length;
        for (uint256 i = 0; i < length; i++) {
            if (A[i] == a) {
                return (i, true);
            }
        }
        //return Out of bounds index if not existing
        return (length, false);
    }
}