# Contract Flattening for Etherscan Code Verification

Etherscan requires "flattened" solidity files (without imports) for code upload
and verification. Doing that manually is possible, but quite some work. But
there are tools that can help, for example truffle-flattener!

Install:

    npm install -g truffle-flattener

Then run on contracts, e.g.

    truffle-flattener contracts/QCOToken.sol > verification/QCOToken_flat.sol
