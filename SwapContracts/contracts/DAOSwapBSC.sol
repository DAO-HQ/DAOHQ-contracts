// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract DaoHqRouter{
    uint256 private constant _TRANSFER_FROM_CALL_SELECTOR_32 = 0x23b872dd00000000000000000000000000000000000000000000000000000000;
    uint256 private constant _WETH_DEPOSIT_CALL_SELECTOR_32 = 0xd0e30db000000000000000000000000000000000000000000000000000000000;
    uint256 private constant _WETH_WITHDRAW_CALL_SELECTOR_32 = 0x2e1a7d4d00000000000000000000000000000000000000000000000000000000;
    uint256 private constant _ERC20_TRANSFER_CALL_SELECTOR_32 = 0xa9059cbb00000000000000000000000000000000000000000000000000000000;
    uint256 private constant _ADDRESS_MASK =   0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff;
    uint256 private constant _REVERSE_MASK =   0x8000000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant _WETH_MASK =      0x4000000000000000000000000000000000000000000000000000000000000000;
    uint256 private constant _NUMERATOR_MASK = 0x0000000000000000ffffffff0000000000000000000000000000000000000000;
    /// @dev WETH address is network-specific and needs to be changed before deployment.
    /// It can not be moved to immutable as immutables are not supported in assembly
    uint256 private constant _WETH = 0x000000000000000000000000bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    uint256 private constant _UNISWAP_PAIR_RESERVES_CALL_SELECTOR_32 = 0x0902f1ac00000000000000000000000000000000000000000000000000000000;
    uint256 private constant _UNISWAP_PAIR_SWAP_CALL_SELECTOR_32 = 0x022c0d9f00000000000000000000000000000000000000000000000000000000;
    uint256 private constant _DENOMINATOR = 1000000000;
    uint256 private constant _NUMERATOR_OFFSET = 160;

    /// @notice Performs swap using Uniswap/sushi LPs. Wraps and unwraps ETH if required.
    /// Sending non-zero `msg.value` for anything but ETH swaps is prohibited
    /// @param srcToken Source token
    /// @param amount Amount of source tokens to swap
    /// @param minReturn Minimal allowed returnAmount to make transaction commit
    /// @param pools Pools chain used for swaps. Pools src and dst tokens should match to make swap happen 
    function hqswap(
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        // solhint-disable-next-line no-unused-vars
        bytes32[] calldata pools
    ) internal returns(uint256 returnAmount) {
        assembly {  // solhint-disable-line no-inline-assembly
            function reRevert() {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }

            function revertWithReason(m, len) {
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(0x20, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(0x40, m)
                revert(0, len)
            }

            function swap(emptyPtr, swapAmount, pair, reversed, numerator, dst) -> ret {
                mstore(emptyPtr, _UNISWAP_PAIR_RESERVES_CALL_SELECTOR_32)
                if iszero(staticcall(gas(), pair, emptyPtr, 0x4, emptyPtr, 0x40)) {
                    reRevert()
                }
                if iszero(eq(returndatasize(), 0x60)) {
                    revertWithReason(0x0000001472657365727665732063616c6c206661696c65640000000000000000, 0x59)  // "reserves call failed"
                }

                let reserve0 := mload(emptyPtr)
                let reserve1 := mload(add(emptyPtr, 0x20))
                if reversed {
                    let tmp := reserve0
                    reserve0 := reserve1
                    reserve1 := tmp
                }
                ret := mul(swapAmount, numerator)
                ret := div(mul(ret, reserve1), add(ret, mul(reserve0, _DENOMINATOR)))

                mstore(emptyPtr, _UNISWAP_PAIR_SWAP_CALL_SELECTOR_32)
                switch reversed
                case 0 {
                    mstore(add(emptyPtr, 0x04), 0)
                    mstore(add(emptyPtr, 0x24), ret)
                }
                default {
                    mstore(add(emptyPtr, 0x04), ret)
                    mstore(add(emptyPtr, 0x24), 0)
                }
                mstore(add(emptyPtr, 0x44), dst)
                mstore(add(emptyPtr, 0x64), 0x80)
                mstore(add(emptyPtr, 0x84), 0)
                if iszero(call(gas(), pair, 0, emptyPtr, 0xa4, 0, 0)) {
                    reRevert()
                }
            }

            let emptyPtr := mload(0x40)
            mstore(0x40, add(emptyPtr, 0xc0))

            let poolsOffset := add(calldataload(0x64), 0x4)
            let poolsEndOffset := calldataload(poolsOffset)
            poolsOffset := add(poolsOffset, 0x20)
            poolsEndOffset := add(poolsOffset, mul(0x20, poolsEndOffset))
            let rawPair := calldataload(poolsOffset)
            switch srcToken
            case 0 {
                if iszero(lt(amount, callvalue())) {
                    revertWithReason(0x00000011696e76616c6964206d73672e76616c75650000000000000000000000, 0x55)  // "invalid msg.value"
                }

                mstore(emptyPtr, _WETH_DEPOSIT_CALL_SELECTOR_32)
                if iszero(call(gas(), _WETH, amount, emptyPtr, 0x4, 0, 0)) {
                    reRevert()
                }

                mstore(emptyPtr, _ERC20_TRANSFER_CALL_SELECTOR_32)
                mstore(add(emptyPtr, 0x4), and(rawPair, _ADDRESS_MASK))
                mstore(add(emptyPtr, 0x24), amount)
                if iszero(call(gas(), _WETH, 0, emptyPtr, 0x44, 0, 0)) {
                    reRevert()
                }
            }
            default {
                if callvalue() {
                    revertWithReason(0x00000011696e76616c6964206d73672e76616c75650000000000000000000000, 0x55)  // "invalid msg.value"
                }
                //fix caller transfer total
                mstore(emptyPtr, _TRANSFER_FROM_CALL_SELECTOR_32)
                mstore(add(emptyPtr, 0x4), caller())
                mstore(add(emptyPtr, 0x24), and(rawPair, _ADDRESS_MASK))
                mstore(add(emptyPtr, 0x44), amount)
                if iszero(call(gas(), srcToken, 0, emptyPtr, 0x64, 0, 0)) {
                    reRevert()
                }
            }

            returnAmount := amount

            for {let i := add(poolsOffset, 0x20)} lt(i, poolsEndOffset) {i := add(i, 0x20)} {
                let nextRawPair := calldataload(i)

                returnAmount := swap(
                    emptyPtr,
                    returnAmount,
                    and(rawPair, _ADDRESS_MASK),
                    and(rawPair, _REVERSE_MASK),
                    shr(_NUMERATOR_OFFSET, and(rawPair, _NUMERATOR_MASK)),
                    and(nextRawPair, _ADDRESS_MASK)
                )

                rawPair := nextRawPair
            }

            switch and(rawPair, _WETH_MASK)
            case 0 {
                returnAmount := swap(
                    emptyPtr,
                    returnAmount,
                    and(rawPair, _ADDRESS_MASK),
                    and(rawPair, _REVERSE_MASK),
                    shr(_NUMERATOR_OFFSET, and(rawPair, _NUMERATOR_MASK)),
                    caller()
                )
            }
            default {
                returnAmount := swap(
                    emptyPtr,
                    returnAmount,
                    and(rawPair, _ADDRESS_MASK),
                    and(rawPair, _REVERSE_MASK),
                    shr(_NUMERATOR_OFFSET, and(rawPair, _NUMERATOR_MASK)),
                    address()
                )

                mstore(emptyPtr, _WETH_WITHDRAW_CALL_SELECTOR_32)
                mstore(add(emptyPtr, 0x04), returnAmount)
                if iszero(call(gas(), _WETH, 0, emptyPtr, 0x24, 0, 0)) {
                    reRevert()
                }

            }

            if lt(returnAmount, minReturn) {
                revertWithReason(0x000000164d696e2072657475726e206e6f742072656163686564000000000000, 0x5a)  // "Min return not reached"
            }
        }
    }
}

contract DAOHqSwapBSC is Ownable, ReentrancyGuard, DaoHqRouter {
    using SafeERC20 for IERC20;

    uint256 public fees;

    event BNBTransfer(address indexed from, address indexed to, uint256 value);
    event ERC20Swap(address indexed inToken, uint256 amount);

    constructor(uint256 _fees) {
        fees = _fees;
    }

    function setFees(uint256 _fees) external onlyOwner {
        fees = _fees;
    }

    function transfer(uint amount, address to) internal {
        uint256 amountToTransfer = (amount * (10000 - fees)) / 10000;

        (bool sent, ) = payable(to).call{value: amountToTransfer}("");
        require(sent, "Failed to Transfer");

        emit BNBTransfer(address(this), to, amountToTransfer);
    }

    function swapExactNativeForTokens(address src, uint256 amountIn, uint256 amountOutMin, bytes32[] calldata path) external payable 
    returns (uint256 amount) {
        
        uint256 afterDeductingFees = (msg.value * (10000 - fees)) / 10000;

        amount = hqswap(IERC20(src),
                        afterDeductingFees, amountOutMin, path);
    }

    function swapExactTokensForNative(address src, uint256 amountIn, uint256 amountOutMin, bytes32[] calldata path) 
    external nonReentrant returns (uint amountOut) {

        uint256 initialBalance = address(this).balance;
        amountOut = hqswap(IERC20(src),
                            amountIn,
                            amountOutMin,
                            path);

        require(initialBalance + amountOut == address(this).balance, "BNB was not returned correctly");

        transfer(amountOut, msg.sender);
    }
  
    function swapExactTokensForTokens(address src, uint256 amountIn, uint256 amountOutMin,
    bytes32[] calldata path)
    external nonReentrant returns(uint amountTransferOut){

        uint amountAfterFee = (amountIn * (10000 - fees)) / 10000;
        IERC20(src).safeTransferFrom(msg.sender, address(this), amountIn - amountAfterFee);

        amountTransferOut = hqswap(IERC20(src),
                                  amountAfterFee,
                                  amountOutMin,
                                  path);
        
        emit ERC20Swap(src, amountIn);
    }

    /**
     * @dev Withdraw Fees
     */
    function withdrawFees(uint256 weiAmount, address to) external onlyOwner {
        require(address(this).balance >= weiAmount, "insufficient BNB balance");
        (bool sent, ) = payable(to).call{value: weiAmount}("");
        require(sent, "Failed to withdraw");
    }

    function withdrawERCFees(address token, address to) external onlyOwner{
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @dev to recieve BNB from DaoHqRouter when swaping
     */
    receive() external payable {}

    fallback() external payable{}
}

