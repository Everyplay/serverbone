#!/bin/bash

FILES=$(git diff --cached --name-status | egrep .js\$ | awk '$1 != "R" && $1 != "D" { print $2 }')

if [[  $FILES ]] ; then
  ./node_modules/.bin/eslint $FILES
else true
fi