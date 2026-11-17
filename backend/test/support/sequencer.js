// Runs the system test files in a fixed order (by name), so the OpenAPI contract check
// (zz-openapi-contract.system-spec.ts) always runs last, after every other file has recorded
// the responses it received.
const Sequencer = require('@jest/test-sequencer').default;

class NameOrderSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => a.path.localeCompare(b.path));
  }
}

module.exports = NameOrderSequencer;
