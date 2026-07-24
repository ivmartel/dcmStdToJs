import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest';

import {parsePs35Node} from '../src/vrParser.js';
import {
  parseXml,
  table,
  section,
  simpleTableXml,
  bookXml as buildBookXml
} from './utils.js';

/**
 * Tests for the 'vrParser.js' file.
 */
/** @module tests/vrParser */

/**
 * Build a fake DICOM standard book XML fragment.
 *
 * @param {string} version The version string, ex '2019e'.
 * @returns {string} The book XML string.
 */
function bookXml(version) {
  return buildBookXml('PS3.5', 'DICOM PS3.5 ' + version + ' - Part 5');
}

/**
 * Build the table_6.2-1 'DICOM Value Representations' XML table.
 *
 * @param {string[][]} rows The table rows, each a [vrName, definition]
 *   pair.
 * @returns {string} The table XML string.
 */
function vrTableXml(rows) {
  return simpleTableXml('6.2-1', 'DICOM Value Representations', rows);
}

/**
 * Build a table_7.1-1 / table_7.1-2 '32-bit VL' XML table.
 *
 * @param {string} label The table label ('7.1-1' or '7.1-2').
 * @param {string} captionText The table caption.
 * @returns {string} The table XML string.
 */
function specialVrTableXml(label, captionText) {
  return table(label, captionText, []);
}

/**
 * Build the sect_6.1.2.2 character set VR XML section.
 *
 * @param {string} paraText The section paragraph text.
 * @returns {string} The section XML string.
 */
function charSetSectionXml(paraText) {
  return section('6.1.2.2', '<para>' + paraText + '</para>');
}

/**
 * Standard set of table_6.2-1 rows exercising each type extractor plus
 * one unrecognized definition (AT).
 */
const VR_ROWS = [
  ['AE', 'A string of characters with leading or trailing spaces ' +
    '(20 chars maximum) representing an Application Entity.'],
  ['OB', 'A string of bytes where the encoding of the contents is ' +
    'specified by the negotiated Transfer Syntax.'],
  ['US', 'Unsigned binary integer 16 bits long.'],
  ['SS', 'Signed binary integer 16 bits long.'],
  ['FL', 'Single precision binary floating point number represented ' +
    'in this Standard using the IEEE 754:1985 32-bit Floating Point ' +
    'Number format.'],
  ['OW', 'A stream of 16-bit words where the encoding of the contents ' +
    'is specified by the negotiated Transfer Syntax.'],
  ['OD', '64-bit IEEE 754:1985 floating point words used to contain ' +
    'data.'],
  ['AT', 'Ordered pair of 16-bit unsigned integers that is the value ' +
    'of a Data Element Tag.']
];

const CHAR_SET_PARA = 'For Data Elements with Value Representations of ' +
  'SH (Short String), LO (Long String), UC (Unlimited Characters), ' +
  'ST (Short Text), LT (Long Text), UT (Unlimited Text) or ' +
  'PN (Person Name)';

/**
 * Build a full PS3.5 document.
 *
 * @param {object} [opts] Options.
 * @param {string} [opts.version] The DICOM version, defaults to '2019e'.
 * @param {string[][]} [opts.vrRows] Table_6.2-1 rows; omit to leave the
 *   table out entirely.
 * @param {string} [opts.specialLabel] The 32-bit VL table label, defaults
 *   to '7.1-2'.
 * @param {string} [opts.specialCaption] The 32-bit VL table caption; omit
 *   to leave the table out entirely.
 * @param {string} [opts.charSetPara] The character set section paragraph
 *   text; omit to leave the section out entirely.
 * @returns {Document} The parsed document.
 */
function getPs35Doc(opts) {
  opts = opts ?? {};
  let xml = '<root>' + bookXml(opts.version ?? '2019e');
  if (typeof opts.vrRows !== 'undefined') {
    xml += vrTableXml(opts.vrRows);
  }
  if (typeof opts.specialCaption !== 'undefined') {
    xml += specialVrTableXml(opts.specialLabel ?? '7.1-2',
      opts.specialCaption);
  }
  if (typeof opts.charSetPara !== 'undefined') {
    xml += charSetSectionXml(opts.charSetPara);
  }
  xml += '</root>';
  return parseXml(xml);
}

describe('parsePs35Node', () => {

  // VR_ROWS includes an unrecognized VR (AT), which logs a warning; mock
  // it in every test so it never spills into the test output.
  let log;

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
  });

  test('throws when the VR table node is missing', () => {
    const doc = getPs35Doc({
      specialCaption: 'Data Element with Explicit VR of OB',
      charSetPara: CHAR_SET_PARA
    });
    const call = function () {
      parsePs35Node(doc);
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when the VR table caption does not match', () => {
    const doc = parseXml('<root>' + bookXml('2019e') +
      '<table label="6.2-1"><caption>Wrong</caption>' +
      '<tbody><tr></tr></tbody></table></root>');
    const call = function () {
      parsePs35Node(doc);
    };
    expect(call).toThrow(/The node caption is not the expected one/);
  });

  test('throws when the 32-bit VL VR table node is missing', () => {
    const doc = getPs35Doc({
      vrRows: VR_ROWS,
      charSetPara: CHAR_SET_PARA
    });
    const call = function () {
      parsePs35Node(doc);
    };
    expect(call).toThrow(/No Vr caption node./);
  });

  test(
    'throws when the 32-bit VL VR table caption does not include the ' +
    'expected text',
    () => {
      const doc = getPs35Doc({
        vrRows: VR_ROWS,
        specialCaption: 'Something else entirely',
        charSetPara: CHAR_SET_PARA
      });
      const call = function () {
        parsePs35Node(doc);
      };
      expect(call).toThrow(
        /The node caption does not include the expected one/);
    });

  test('throws when the character set VR section is missing', () => {
    const doc = getPs35Doc({
      vrRows: VR_ROWS,
      specialCaption: 'Data Element with Explicit VR of OB'
    });
    const call = function () {
      parsePs35Node(doc);
    };
    expect(call).toThrow(/No char Vr node./);
  });

  test(
    'parses VRs, 32-bit VL VRs (>= 2019e) and character set VRs',
    () => {
      const doc = getPs35Doc({
        version: '2019e',
        vrRows: VR_ROWS,
        specialCaption:
          'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN',
        charSetPara: CHAR_SET_PARA
      });

      const result = parsePs35Node(doc, 'part05.xml');

      expect(result).toHaveLength(3);
      const [vrsResult, vrVl32Result, charSetVrResult] = result;

      expect(vrsResult.name).toEqual('DICOM VRs');
      expect(vrsResult.origin).toEqual('part05.xml');
      const expectedVrs = {
        AE: 'string',
        OB: 'Uint8',
        US: 'Uint16',
        SS: 'Int16',
        FL: 'Float32',
        OW: 'Uint16',
        OD: 'Uint64',
        AT: null
      };
      expect(vrsResult.raw).toEqual(expectedVrs);
      expect(JSON.parse(vrsResult.data)).toEqual(expectedVrs);
      // unknown VR type (AT) logs instead of throwing
      expect(log).toHaveBeenCalledWith('Unknown VR type for AT');

      expect(vrVl32Result.name).toEqual('DICOM 32-bit VL VRs');
      expect(vrVl32Result.origin).toEqual('part05.xml');
      // >= 2019e: all VR names *not* in the special (32-bit VL) list
      expect(vrVl32Result.raw).toEqual(['AE', 'US', 'SS', 'FL', 'AT']);
      expect(JSON.parse(vrVl32Result.data)).toEqual(
        ['AE', 'US', 'SS', 'FL', 'AT']);

      expect(charSetVrResult.name).toEqual('DICOM Character Set VRs');
      expect(charSetVrResult.origin).toEqual('part05.xml');
      expect(charSetVrResult.raw).toEqual(
        ['SH', 'LO', 'UC', 'ST', 'LT', 'UT', 'PN']);
      expect(JSON.parse(charSetVrResult.data)).toEqual(
        ['SH', 'LO', 'UC', 'ST', 'LT', 'UT', 'PN']);
    });

  test(
    'uses the 32-bit VL VRs directly (not filtered) before 2019e',
    () => {
      const doc = getPs35Doc({
        version: '2019a',
        vrRows: VR_ROWS,
        specialLabel: '7.1-1',
        specialCaption:
          'Data Element with Explicit VR of OB, OW, OF, OD, SQ, UT or UN',
        charSetPara: CHAR_SET_PARA
      });

      const result = parsePs35Node(doc, 'part05.xml');
      const [, vrVl32Result] = result;

      // before 2019e: the special table's VR list is used as-is
      expect(vrVl32Result.raw).toEqual(
        ['OB', 'OW', 'OF', 'OD', 'SQ', 'UT', 'UN']);
    });

});
