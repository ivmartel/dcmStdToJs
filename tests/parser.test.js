import {DicomXMLParser} from '../src/parser.js';

/**
 * Tests for the 'parser.js' file.
 */
/** @module tests/parser */
// Do not warn if these variables were not defined before.
/* global QUnit */
QUnit.module('parser');

// convert a tag into a string array.
function getTagArray(tag) {
  const res = [];
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
 * Tests for {@link DicomXMLParser}.
 * @function module:tests/parser~DicomXMLParser
 */
QUnit.test('Test DicomXMLParser.', function (assert) {

  const parser = new DicomXMLParser();

  // #00 no book node
  const node00 = document.createElement('div');
  const fbad00 = function () {
    parser.parseNode(node00);
  };
  assert.raises(fbad00,
    /No book node/,
    'no book node');

  // #01 no book label
  const node01 = document.createElement('div');
  const book01 = document.createElement('book');
  node01.appendChild(book01);
  const fbad01 = function () {
    parser.parseNode(node01);
  };
  assert.raises(fbad01,
    /No book label/,
    'no book label');

  // utility function
  function getBookNode(label) {
    const node = document.createElement('div');
    const book = document.createElement('book');
    book.setAttribute('label', label);
    node.appendChild(book);
    return node;
  }
  function getValidBookNode() {
    return getBookNode('PS3.7');
  }

  // #02 unknown book label
  const node02 = getBookNode('PS3.66');
  const fbad02 = function () {
    parser.parseNode(node02);
  };
  assert.raises(fbad02,
    /Unknown book label/,
    'unknown book label');

  // #10 no table node
  const node10 = getValidBookNode();
  const fbad10 = function () {
    parser.parseNode(node10);
  };
  assert.raises(fbad10,
    /No table node/,
    'no table node');

  // #11 table with bad label
  const node11 = getValidBookNode();
  const table11 = document.createElement('table');
  table11.setAttribute('label', '7-77');
  node11.appendChild(table11);
  const fbad11 = function () {
    parser.parseNode(node11);
  };
  assert.raises(fbad11,
    /No table node/,
    'bad table node');

  // #12 table with no caption
  const node12 = getValidBookNode();
  const table12 = document.createElement('table');
  table12.setAttribute('label', 'E.1-1');
  node12.appendChild(table12);
  const fbad12 = function () {
    parser.parseNode(node12);
  };
  assert.raises(fbad12,
    /Empty node caption/,
    'no table node caption');

  // utility function
  function getTableNode(label, captionText) {
    const table = document.createElement('table');
    table.setAttribute('label', label);
    const caption = document.createElement('caption');
    const text = document.createTextNode(captionText);
    caption.appendChild(text);
    table.appendChild(caption);
    return table;
  }
  function appendValidTableNodes(node) {
    const validTable0 = getTableNode(
      'E.1-1', 'Command Fields');
    node.appendChild(validTable0);
    node.appendChild(getTableNode(
      'E.2-1', 'Retired Command Fields'));
    return validTable0;
  }

  // #13 table with bad caption
  const node13 = getValidBookNode();
  const table13 = getTableNode('E.1-1', 'ahahah');
  node13.appendChild(table13);
  const fbad13 = function () {
    parser.parseNode(node13);
  };
  assert.raises(fbad13,
    /The node caption is not the expected one/,
    'bad table node caption');

  // #14 table with no content
  const node14 = getValidBookNode();
  appendValidTableNodes(node14);
  const fbad14 = function () {
    parser.parseNode(node14);
  };
  assert.raises(fbad14,
    /Empty tags/,
    'empty tags');

  // #20 table with content
  const node20 = getValidBookNode();
  const table20 = appendValidTableNodes(node20);
  const row20 = table20.insertRow();
  const tag20 = {
    group: '0x0004',
    element: '0x1142',
    keyword: 'Specific​Character​Set​',
    vr: 'CS',
    vm: '1'
  };
  const tagArray20 = getTagArray(tag20);
  for (let i = 0; i < tagArray20.length; ++i) {
    const cell20 = row20.insertCell();
    const para20 = document.createElement('para');
    const text20 = document.createTextNode(tagArray20[i]);
    para20.appendChild(text20);
    cell20.appendChild(para20);
  }
  node20.appendChild(table20);
  const result20 = parser.parseNode(node20);
  // can't make object comparison work...
  // assert.propEqual(result10[0], tag10, 'Table node with content.');
  assert.equal(result20.raw[0].toString(), tag20.toString(),
    'table node with content');

});
