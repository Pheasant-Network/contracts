# test data

## checkTransferTx.json

- 3
  - txhash : 0xdb67b178670687b919f0a70d497f953be2b4597b01d875eb6e1d1bf02a3cfbee
  - chain : goerli
  - tokenaddress : 0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93
  - method : ERC20 transfer()
  - to : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - amount : 10000000000000000000000
- 4
  - txhash : 0x7b384f9a9a9d5a1614a025f187354faf19018fbe2fc4faea8002b5f66453a700
  - chain : goerli
  - to : 0x6d29fc79eab50b1ab0c8550ec2952896abcf0472
  - amount : 1000000000001001
- 5
  - txhash : 0x2112350834f38ba4974e3b50c86202d83efe42c85c3ef60066e8ae9dca5e10d7
  - chain : goerli
  - tokenaddress : 0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93
  - method : ERC20 approve()
  - to : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - amount : 10000000000000000000000
- 6
  - txhash : 0xa18a5b03e37803f7498a789fdbdd18ee2303bccd1cef76250bd4ffa94fd7857a
  - chain : goerli
  - tokenaddress : 0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93
  - method : ERC20 transfer()
  - to : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - amount : 100000000000001001


## receipt
- 0
  - txhash : 0xdb67b178670687b919f0a70d497f953be2b4597b01d875eb6e1d1bf02a3cfbee
  - chain : goerli
  - tokenaddress : 0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93
  - method : ERC20 transfer()
  - to : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - amount : 10000000000000000000000
- 1
  - txhash : 0xcbf4c2e63b800032585145be98e2084fc8c5190a14b110f7caadaadaaad212b5
  - chain : goerli
  - tokenaddress : 0x1535F5EC4Dad68c5Aab692B61AB78375F36CdF93
  - method : ERC20 transfer() → fail
  - to : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - amount : 9994000*10e18