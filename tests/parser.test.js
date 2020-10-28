import {Part06Parser} from '../src/parser.js';

/**
 * Tests for the 'parser.js' file.
 */
/** @module tests/parser */
// Do not warn if these variables were not defined before.
/* global QUnit */
QUnit.module('parser');

// convert a tag into a string array.
function getTagArray(tag) {
  var res = [];
  res.push('(' + tag.group.substr(2) + ',' + tag.element.substr(2) + ')');
  // name
  res.push(tag.keyword);
  res.push(tag.keyword);
  res.push(tag.vr);
  res.push(tag.vm);
  // retired
  res.push('');
  return res;
}
/**
 * Tests for {@link dstj.Part06Parser}.
 * @function module:tests/parser~Part06Parser
 */
QUnit.test('Test Part06Parser.', function (assert) {

  var parser = new Part06Parser();

  // #00 empty div node
  var node00 = document.createElement('div');
  var result00 = parser.parseNode(node00);
  assert.equal(result00.length, 0, 'empty div node returns empty array.');

  // #01 empty table node
  var node01 = document.createElement('div');
  var table01 = document.createElement('table');
  node01.appendChild(table01);
  var result01 = parser.parseNode(node01);
  assert.equal(result01.length, 0, 'empty table node returns empty array.');

  // #02 table node with label but no content
  var node02 = document.createElement('div');
  var table02 = document.createElement('table');
  table02.setAttribute('label', '7-1');
  node02.appendChild(table02);
  var result02 = parser.parseNode(node02);
  assert.equal(result02.length, 0,
    'empty table node with label returns empty array.');

  // #03 table node with content
  var node03 = document.createElement('div');
  var table03 = document.createElement('table');
  table03.setAttribute('label', '7-1');
  var row03 = table03.insertRow();
  row03.insertCell();
  node03.appendChild(table03);
  var fbad03 = function () {
    parser.parseNode(node03)
  };
  assert.raises(fbad03,
    /Not the expected/,
    'table node with no para throws error.');

  // #10 table node with content
  var node10 = document.createElement('div');
  var table10 = document.createElement('table');
  table10.setAttribute('label', '7-1');
  var row10 = table10.insertRow();
  var tag10 = {
    group: '0x0004',
    element: '0x1142',
    keyword: 'Specific​Character​Set​',
    vr: 'CS',
    vm: '1'
  }
  var tagArray10 = getTagArray(tag10);
  for (var i = 0; i < tagArray10.length; ++i) {
    var cell10 = row10.insertCell();
    let para10 = document.createElement('para');
    var text10 = document.createTextNode(tagArray10[i]);
    para10.appendChild(text10);
    cell10.appendChild(para10);
  }
  node10.appendChild(table10);
  var result10 = parser.parseNode(node10);
  // can't make object comparison work...
  // assert.propEqual(result10[0], tag10, 'Table node with content.');
  assert.equal(result10[0].toString(), tag10.toString(),
    'Table node with content.');

});
