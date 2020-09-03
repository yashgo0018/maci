#!/bin/bash

set -e

cd "$(dirname "$0")"
cd ..
mkdir -p build

NODE_OPTIONS=--max-old-space-size=8192 node build/buildSnarks.js -i circom/prod/batchUpdateStateTreeVerifier.circom -j build/batchUstCircuit.r1cs -p build/batchUstPk.json -v build/batchUstVk.json -s build/BatchUpdateStateTreeVerifier.sol -vs BatchUpdateStateTreeVerifier -m build/batchUst.params -z build/batchUst.zkey

echo 'Copying BatchUpdateStateTreeVerifier.sol to contracts/sol.'
cp ./build/BatchUpdateStateTreeVerifier.sol ../contracts/sol/
