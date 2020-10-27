import {Part06Parser} from '../src/parser.js';

/**
 * Tests for the 'parser.js' file.
 */
/** @module tests/parser */
// Do not warn if these variables were not defined before.
/* global QUnit */
QUnit.module('parser');

/**
 * Tests for {@link dstj.Part06Parser}.
 * @function module:tests/parser~Part06Parser
 */
QUnit.test('Test Part06Parser.', function (assert) {

  var node = document.createElement('table');

  var parser = new Part06Parser();
  var result = parser.parseNode(node);
  assert.equal(result.length, 0, 'empty node returns empty array.');

});
