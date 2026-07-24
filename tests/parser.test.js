import {describe, expect, test} from 'vitest';

import {DicomXMLParser} from '../src/parser.js';

/**
 * Tests for the 'parser.js' file.
 */
/** @module tests/parser */

/**
 * Convert a tag into a string array.
 *
 * @param {object} tag The input dicom tag.
 * @param {string} [keywordText] Optional raw text to use for the name and
 *   keyword cells instead of `tag.keyword` (for ex to include characters
 *   that are expected to be cleaned during parsing).
 * @returns {Array} An array with the tag properties.
 */
function getTagArray(tag, keywordText) {
  const res = [];
  res.push('(' + tag.group + ',' + tag.element + ')');
  const name = typeof keywordText === 'undefined' ? tag.keyword : keywordText;
  // name
  res.push(name);
  res.push(name);
  res.push(tag.vr);
  res.push(tag.vm);
  // retired
  res.push('');
  return res;
}

/**
 * Get a fake dicom book DOM node.
 *
 * @param {string} label The dicom part label.
 * @returns {Node} A DOM node.
 */
function getBookNode(label) {
  const node = document.createElement('div');
  const book = document.createElement('book');
  const subtitle = document.createElement('subtitle');
  subtitle.appendChild(
    document.createTextNode('DICOM ' + label + ' 2020a -'));
  book.setAttribute('label', label);
  book.appendChild(subtitle);
  node.appendChild(book);
  return node;
}

/**
 * Get a valid dicom book node.
 *
 * @returns {Node} A DOM node.
 */
function getValidBookNode() {
  return getBookNode('PS3.7');
}

/**
 * Get a fake table node.
 *
 * @param {string} label The table label.
 * @param {string} captionText The table caption text.
 * @returns {Node} A DOM node.
 */
function getTableNode(label, captionText) {
  const table = document.createElement('table');
  table.setAttribute('label', label);
  const caption = document.createElement('caption');
  const text = document.createTextNode(captionText);
  caption.appendChild(text);
  table.appendChild(caption);
  return table;
}

/**
 * Append a valid dicom table to an input node.
 *
 * @param {Node} node The node to append to.
 * @returns {Node} The first table node appended to the input.
 */
function appendValidTableNodes(node) {
  const validTable0 = getTableNode(
    'E.1-1', 'Command Fields');
  node.appendChild(validTable0);
  node.appendChild(getTableNode(
    'E.2-1', 'Retired Command Fields'));
  return validTable0;
}

/**
 * Tests for {@link DicomXMLParser}.
 *
 * @function module:tests/parser~DicomXMLParser
 */
describe('#DicomXMLParser', () => {

  test('throw when no book node', () => {
    const parser = new DicomXMLParser();
    const node = document.createElement('div');
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/No book node/);
  });

  test('throw when no book label', () => {
    const parser = new DicomXMLParser();
    const node = document.createElement('div');
    const book = document.createElement('book');
    node.appendChild(book);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/No book label/);
  });

  test('throw when no book subtitle', () => {
    const parser = new DicomXMLParser();
    const node = document.createElement('div');
    const book = document.createElement('book');
    book.setAttribute('label', 'PS3.66');
    node.appendChild(book);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/No book subtitle/);
  });

  test('throw when no dicom prefix', () => {
    const parser = new DicomXMLParser();
    const node = document.createElement('div');
    const book = document.createElement('book');
    const sub = document.createElement('subtitle');
    const label = 'PS3.66';
    book.setAttribute('label', label);
    sub.appendChild(
      document.createTextNode('DICOMx ' + label + ' 2020a -'));
    book.appendChild(sub);
    node.appendChild(book);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/Missing DICOM standard version prefix./);
  });

  test('throw when no dicom version', () => {
    const parser = new DicomXMLParser();
    const node = document.createElement('div');
    const book = document.createElement('book');
    const sub = document.createElement('subtitle');
    const label = 'PS3.66';
    book.setAttribute('label', label);
    sub.appendChild(
      document.createTextNode('DICOM ' + label + ' test'));
    book.appendChild(sub);
    node.appendChild(book);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/Missing DICOM standard version./);
  });

  test('throw when unknown book label', () => {
    const parser = new DicomXMLParser();
    const node = getBookNode('PS3.66');
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/Unknown book label/);
  });

  test('throw when no table node', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/No table node/);
  });

  test('throw when bad table node', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    const table = document.createElement('table');
    table.setAttribute('label', '7-77');
    node.appendChild(table);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/No table node/);
  });

  test('throw when no table node caption', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    const table = document.createElement('table');
    table.setAttribute('label', 'E.1-1');
    node.appendChild(table);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/Empty node caption/);
  });

  test('throw when bad table node caption', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    const table = getTableNode('E.1-1', 'ahahah');
    node.appendChild(table);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/The node caption is not the expected one/);
  });

  test('throw when empty tags', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    appendValidTableNodes(node);
    const parseNode = function () {
      parser.parseNode(node);
    };
    expect(parseNode).toThrow(/Empty tags/);
  });

  test('correct parse', () => {
    const parser = new DicomXMLParser();
    const node = getValidBookNode();
    const table = appendValidTableNodes(node);
    const row = table.insertRow();
    const tag = {
      group: '0004',
      element: '1142',
      keyword: 'SpecificCharacterSet',
      vr: 'CS',
      vm: '1'
    };
    // the source cell text includes zero-width spaces to check that they
    // get cleaned out of the parsed keyword (see `tag.keyword` above)
    const tagArray = getTagArray(tag, 'Specific​Character​Set​');
    for (let i = 0; i < tagArray.length; ++i) {
      const cell = row.insertCell();
      const para = document.createElement('para');
      const text = document.createTextNode(tagArray[i]);
      para.appendChild(text);
      cell.appendChild(para);
    }
    node.appendChild(table);
    const result = parser.parseNode(node)[0];
    expect(result.raw[0]).toEqual(tag);
  });

});
