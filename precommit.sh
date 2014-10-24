#!/bin/bash

FILES=$(git diff --cached --name-status | egrep .js\$ | awk '$1 != "R" && $1 != "D" { print $2 }')

if [[  $FILES ]] ; then
  ./node_modules/.bin/jshint $FILES && ./node_modules/.bin/jscs $FILES
else true
fi