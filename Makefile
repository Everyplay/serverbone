ENV = test
REPORTER = spec
BIN = node_modules/.bin
SRC_FILES = $(shell find .  -type f \( -name "*.js" ! \
	-path "*node_modules*" ! -path "*lcov-report*" \))

# Use grep to run only tests with keywords:
# make test-server GREP=events
ifeq ($(GREP), )
	GREP_CMND =
else
 	GREP_CMND = --grep $(GREP)
endif

MOCHA-OPTS = --reporter $(REPORTER) \
		--require chai \
		--ui bdd \
		--recursive \
		--colors

test: jshint jscs
	@NODE_ENV=$(ENV) $(BIN)/mocha \
		$(MOCHA-OPTS) \
		$(GREP_CMND)
.PHONY: test

#debug by node-inspector + http://127.0.0.1:8080/debug?port=5858
test-d:
	@NODE_ENV=test $(BIN)/mocha \
		$(MOCHA-OPTS) \
		--debug-brk \
		$(GREP_CMND)
.PHONY: test-d

# Integration tests
INTEGRATION_TESTS = $(shell find test_integration -name '*_spec.js')
test-int:
	@NODE_ENV=test $(BIN)/mocha \
		$(MOCHA-OPTS) \
		$(INTEGRATION_TESTS)
	@$(MAKE) test ENV=test-integration
.PHONY: test-int

jshint:
	@$(BIN)/jshint $(SRC_FILES)
.PHONY: jshint

jscs:
	@$(BIN)/jscs .
.PHONY: jscs

## Coverage:

test-coverage:
	@NODE_ENV=test $(BIN)/istanbul cover $(BIN)/_mocha -- $(MOCHA-OPTS)
.PHONY: test-coverage

check-coverage: test-coverage
	@$(BIN)/istanbul check-coverage --function 80 --branch 80 --statement 80 --lines 92
.PHONY: check-coverage

coveralls:
	cat ./coverage/lcov.info | COVERALLS_SERVICE_NAME="travis-ci" ./node_modules/coveralls/bin/coveralls.js

## expects that gh-pages branch is checked out at ../serverbone_gh-pages
docs:
	$(BIN)/docker -o ../serverbone_gh-pages -i lib -c manni
	cp ../serverbone_gh-pages/index.js.html ../serverbone_gh-pages/index.html
