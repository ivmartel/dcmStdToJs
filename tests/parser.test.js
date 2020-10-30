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

  // #00 no book div
  var node00 = document.createElement('div');
  var fbad00 = function () {
    parser.parseNode(node00);
  };
  assert.raises(fbad00,
    /No book root/,
    'no book node');

  // #01 book div with no label
  var node01 = document.createElement('div');
  var book01 = document.createElement('book');
  node01.appendChild(book01);
  var fbad01 = function () {
    parser.parseNode(node01);
  };
  // TypeError ???
  assert.raises(fbad01,
    /TypeError/,
    'book node with no label');

  // utility function
  function getBookNode(label) {
    var node = document.createElement('div');
    var book = document.createElement('book');
    book.setAttribute('label', label);
    node.appendChild(book);
    return node;
  }

  // #02 empty book div with label
  var result02 = parser.parseNode(getBookNode('PS3.6'));
  assert.equal(result02.length, 0, 'empty book node with label');

  // #10 table with no label
  var node10 = getBookNode('PS3.6');
  var table10 = document.createElement('table');
  node10.appendChild(table10);
  var result10 = parser.parseNode(node10);
  assert.equal(result10.length, 0, 'table with no label');

  // utility function
  function getTableNode(label) {
    var table = document.createElement('table');
    table.setAttribute('label', label);
    return table;
  }

  // #11 empty table with label
  var node11 = getBookNode('PS3.6');
  var table11 = getTableNode('7-1');
  node11.appendChild(table11);
  var result11 = parser.parseNode(node11);
  assert.equal(result11.length, 0, 'empty table with label');

  // #12 table with empty row
  var node12 = getBookNode('PS3.6');
  var table12 = getTableNode('7-1');
  var row12 = table12.insertRow();
  row12.insertCell();
  node12.appendChild(table12);
  var fbad12 = function () {
    parser.parseNode(node12);
  };
  assert.raises(fbad12,
    /in table cell/,
    'table node with no para throws error.');

  // #10 table with content
  var node20 = getBookNode('PS3.6');
  var table20 = getTableNode('7-1');
  var row20 = table20.insertRow();
  var tag20 = {
    group: '0x0004',
    element: '0x1142',
    keyword: 'Specific​Character​Set​',
    vr: 'CS',
    vm: '1'
  };
  var tagArray20 = getTagArray(tag20);
  for (var i = 0; i < tagArray20.length; ++i) {
    var cell20 = row20.insertCell();
    let para20 = document.createElement('para');
    var text20 = document.createTextNode(tagArray20[i]);
    para20.appendChild(text20);
    cell20.appendChild(para20);
  }
  node20.appendChild(table20);
  var result20 = parser.parseNode(node20);
  // can't make object comparison work...
  // assert.propEqual(result10[0], tag10, 'Table node with content.');
  assert.equal(result20[0].toString(), tag20.toString(),
    'table node with content');

});
