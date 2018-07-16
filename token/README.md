# Qravity QCO Token - Source Code

#desired versions:
Truffle v4.1.3
Solidity v0.4.19 (solc-js)  #is a dependency of truffle 4.1.3

#Run Tests:

    sudo npm install -g truffle@4.1.3
    sudo npm install -g ganache-cli
    npm install .
    truffle install zeppelin

start ganache-cli with

    ./scripts/start_ganache.sh

run tests with

    truffle test
