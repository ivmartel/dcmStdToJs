import {describe, expect, test} from 'vitest';

import {DicomXMLParser} from '../src/parser.js';
import {parseXml, bookXml, table, td, tr} from './utils.js';

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
 * Build a valid DICOM standard book XML fragment (PS3.7, 2020a).
 *
 * @returns {string} The book XML string.
 */
function validBookXml() {
  return bookXml('PS3.7', 'DICOM PS3.7 2020a -');
}

/**
 * Build the E.1-1 'Command Fields' and E.2-1 'Retired Command Fields'
 * tables, with the given rows in the E.1-1 table.
 *
 * @param {string[]} [rows] The E.1-1 table row XML strings.
 * @returns {string} The tables XML string.
 */
function commandFieldsTablesXml(rows) {
  return table('E.1-1', 'Command Fields', rows) +
    table('E.2-1', 'Retired Command Fields', []);
}

/**
 * Tests for {@link DicomXMLParser}.
 *
 * @function module:tests/parser~DicomXMLParser
 */
describe('DicomXMLParser', () => {

  test('throw when no book node', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root></root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/No book node/);
  });

  test('throw when no book label', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root><book></book></root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/No book label/);
  });

  test('throw when no book subtitle', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root><book label="PS3.66"></book></root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/No book subtitle/);
  });

  test('throw when no dicom prefix', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' +
      bookXml('PS3.66', 'DICOMx PS3.66 2020a -') + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/Missing DICOM standard version prefix./);
  });

  test('throw when no dicom version', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' +
      bookXml('PS3.66', 'DICOM PS3.66 test') + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/Missing DICOM standard version./);
  });

  test('throw when unknown book label', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' +
      bookXml('PS3.66', 'DICOM PS3.66 2020a -') + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/Unknown book label/);
  });

  test('throw when no table node', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' + validBookXml() + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/No table node/);
  });

  test('throw when bad table node', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' + validBookXml() +
      table('7-77', undefined, []) + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/No table node/);
  });

  test('throw when no table node caption', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' + validBookXml() +
      table('E.1-1', undefined, []) + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/Empty node caption/);
  });

  test('throw when bad table node caption', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' + validBookXml() +
      table('E.1-1', 'ahahah', []) + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/The node caption is not the expected one/);
  });

  test('throw when empty tags', () => {
    const parser = new DicomXMLParser();
    const doc = parseXml('<root>' + validBookXml() +
      commandFieldsTablesXml([]) + '</root>');
    const parseNode = function () {
      parser.parseNode(doc);
    };
    expect(parseNode).toThrow(/Empty tags/);
  });

  test('correct parse', () => {
    const parser = new DicomXMLParser();
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
    const row = tr(tagArray.map(td));

    const doc = parseXml('<root>' + validBookXml() +
      commandFieldsTablesXml([row]) + '</root>');

    const result = parser.parseNode(doc)[0];
    expect(result.raw[0]).toEqual(tag);
  });

});
