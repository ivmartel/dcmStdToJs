import {describe, expect, test} from 'vitest';

import {DicomXMLParser} from '../src/parser.js';
import {parsePs36TagsNode, parsePs37Node} from '../src/tagParser.js';
import {parsePs36UIDNode} from '../src/uidParser.js';
import {parsePs35Node} from '../src/vrParser.js';
import {parsePs33Node} from '../src/moduleParser.js';
import {
  parseXml, bookXml, table, section, td, tr, simpleTableXml
} from './utils.js';

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
 * Build a minimal valid PS3.6 tags document (tables 7-1, 8-1 and 6-1,
 * one row each).
 *
 * @returns {Document} The parsed document.
 */
function ps36TagsDoc() {
  return parseXml('<root>' +
    bookXml('PS3.6', 'DICOM PS3.6 2020a -') +
    simpleTableXml('7-1', 'Registry of DICOM File Meta Elements', [
      ['(0002,0001)',
        'File Meta Information Version',
        'FileMetaInformationVersion',
        'OB',
        '1']
    ]) +
    simpleTableXml(
      '8-1', 'Registry of DICOM Directory Structuring Elements', [
        ['(0004,1130)', 'File-set ID', 'FileSetID', 'CS', '1']
      ]) +
    simpleTableXml('6-1', 'Registry of DICOM Data Elements', [
      ['(0008,0016)', 'SOP Class UID', 'SOPClassUID', 'UI', '1']
    ]) +
    '</root>');
}

/**
 * Build a minimal valid PS3.7 tags document (tables E.1-1 and E.2-1,
 * one row in E.1-1).
 *
 * @returns {Document} The parsed document.
 */
function ps37TagsDoc() {
  const tag = {
    group: '0000',
    element: '0002',
    keyword: 'AffectedSOPClassUID',
    vr: 'UI',
    vm: '1'
  };
  const row = tr(getTagArray(tag).map(td));
  return parseXml('<root>' +
    bookXml('PS3.7', 'DICOM PS3.7 2020a -') +
    commandFieldsTablesXml([row]) +
    '</root>');
}

/**
 * Build a minimal valid PS3.6 UIDs document (table A-1).
 *
 * @returns {Document} The parsed document.
 */
function ps36UidsDoc() {
  return parseXml('<root>' +
    bookXml('PS3.6', 'DICOM PS3.6 2020a -') +
    simpleTableXml('A-1', 'UID Values', [
      ['1.2.840.10008.1.2',
        'Implicit VR Little Endian',
        'ImplicitVRLittleEndian',
        'Transfer Syntax',
        'PS3.5']
    ]) +
    '</root>');
}

/**
 * Build a minimal valid PS3.5 VRs document (table_6.2-1, table_7.1-2 and
 * sect_6.1.2.2).
 *
 * @returns {Document} The parsed document.
 */
function ps35Doc() {
  return parseXml('<root>' +
    bookXml('PS3.5', 'DICOM PS3.5 2020a - Part 5') +
    simpleTableXml('6.2-1', 'DICOM Value Representations', [
      ['AE', 'A string of characters with leading or trailing spaces ' +
        'representing an Application Entity.']
    ]) +
    table('7.1-2', 'Data Element with Explicit VR of OB', []) +
    section('6.1.2.2',
      '<para>For Data Elements with Value Representations of ' +
      'SH (Short String)</para>') +
    '</root>');
}

/**
 * Build a minimal valid PS3.3 IOD modules document (CT Image and MR
 * Image, one module and one attribute each).
 *
 * @returns {Document} The parsed document.
 */
function ps33Doc() {
  return parseXml('<root>' +
    bookXml('PS3.3', 'DICOM PS3.3 2020a -') +
    table('A.3-1', 'CT Image IOD Modules', [
      tr([td('Patient'), td('<xref linkend="sect_C.7.1.1"/>'), td('M')])
    ]) +
    section('C.7.1.1', table('C.7-1', 'Patient Module Attributes', [
      tr([td('Some Attribute'),
        td('(0018,0010)'),
        td('1'),
        td('Desc.')])
    ])) +
    table('A.4-1', 'MR Image IOD Modules', [
      tr([td('MR Specific Module'),
        td('<xref linkend="sect_C.8.1.1"/>'),
        td('M')])
    ]) +
    section('C.8.1.1',
      table('C.8-1', 'MR Specific Module Module Attributes', [
        tr([td('MR Attribute'),
          td('(0018,0020)'),
          td('1'),
          td('MR desc.')])
      ])) +
    '</root>');
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

describe('DicomXMLParser.parseTags', () => {

  test('throws when not given exactly 2 parts', () => {
    const parser = new DicomXMLParser();
    const doc = ps36TagsDoc();
    expect(function () {
      parser.parseTags([doc], 'origin');
    }).toThrow(/Not the expected parts for tags parse/);
    expect(function () {
      parser.parseTags([doc, doc, doc], 'origin');
    }).toThrow(/Not the expected parts for tags parse/);
  });

  test('throws when the parts are not PS3.6 and PS3.7', () => {
    const parser = new DicomXMLParser();
    const other = parseXml(
      '<root>' + bookXml('PS3.3', 'DICOM PS3.3 2020a -') + '</root>');
    expect(function () {
      parser.parseTags([ps36TagsDoc(), other], 'origin');
    }).toThrow(/Wrong labels for tags parse: 1/);
  });

  test('merges the PS3.6 and PS3.7 tags parts', () => {
    const parser = new DicomXMLParser();
    const doc36 = ps36TagsDoc();
    const doc37 = ps37TagsDoc();
    const direct36 = parsePs36TagsNode(doc36, 'origin')[0];
    const direct37 = parsePs37Node(doc37, 'origin')[0];

    const result = parser.parseTags([doc36, doc37], 'origin');

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual(direct36.name);
    expect(result[0].origin).toEqual('origin');
    expect(result[0].raw).toEqual([...direct37.raw, ...direct36.raw]);
    expect(JSON.parse(result[0].data)).toEqual({
      ...JSON.parse(direct37.data),
      ...JSON.parse(direct36.data)
    });
  });

  test('merges the parts regardless of their order', () => {
    const parser = new DicomXMLParser();
    const doc36 = ps36TagsDoc();
    const doc37 = ps37TagsDoc();

    const inOrder = parser.parseTags([doc36, doc37], 'origin');
    const swapped = parser.parseTags([doc37, doc36], 'origin');

    expect(swapped).toEqual(inOrder);
  });

});

describe('DicomXMLParser.parseUids', () => {

  test('throws when the part is not PS3.6', () => {
    const parser = new DicomXMLParser();
    const doc = ps35Doc();
    expect(function () {
      parser.parseUids([doc], 'origin');
    }).toThrow(/Wrong label for UID parse: PS3.5/);
  });

  test('delegates to the PS3.6 UID parser', () => {
    const parser = new DicomXMLParser();
    const doc = ps36UidsDoc();
    const expected = parsePs36UIDNode(doc, 'origin');
    const result = parser.parseUids([doc], 'origin');
    expect(result).toEqual(expected);
  });

});

describe('DicomXMLParser.parseVrs', () => {

  test('throws when the part is not PS3.5', () => {
    const parser = new DicomXMLParser();
    const doc = ps36TagsDoc();
    expect(function () {
      parser.parseVrs([doc], 'origin');
    }).toThrow(/Wrong label for VR parse: PS3.6/);
  });

  test('delegates to the PS3.5 VR parser', () => {
    const parser = new DicomXMLParser();
    const doc = ps35Doc();
    const expected = parsePs35Node(doc, 'origin');
    const result = parser.parseVrs([doc], 'origin');
    expect(result).toEqual(expected);
  });

});

describe('DicomXMLParser.parseModules', () => {

  test('throws when the part is not PS3.3', () => {
    const parser = new DicomXMLParser();
    const doc = ps37TagsDoc();
    expect(function () {
      parser.parseModules([doc], 'origin');
    }).toThrow(/Wrong label for module parse: PS3.7/);
  });

  test('delegates to the PS3.3 module parser', () => {
    const parser = new DicomXMLParser();
    const doc = ps33Doc();
    const expected = parsePs33Node(doc, 'CT Image', 'origin');
    const result = parser.parseModules([doc], 'origin');
    expect(result).toEqual(expected);
  });

});
