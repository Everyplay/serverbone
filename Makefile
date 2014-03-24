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

ACCEPTANCE_TESTS = $(shell find test_acceptance -name '*_spec.js')
test-acceptance: start-server check-server
	@TIMEOUT=8000 $(BIN)/mocha \
		$(MOCHA-OPTS) \
		$(ACCEPTANCE_TESTS) || true
	@$(MAKE) stop-server
.PHONY: test-acceptance

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

# run/stop test server
PID_FILE = temp/serverbone_acceptance_test.pid

start-server:
	@mkdir -p temp
	@DEBUG=* node test_acceptance/todos/app.js > temp/log 2>&1 & echo $$! > $(PID_FILE)

stop-server:
	@kill -9 `cat $(PID_FILE)`
	@rm $(PID_FILE)

check-server:
	@node bin/check-server.js || $(MAKE) view-server-log

view-server-log:
	@cat temp/log
