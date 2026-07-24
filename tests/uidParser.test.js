import {describe, expect, test} from 'vitest';

import {parsePs36UIDNode} from '../src/uidParser.js';
import {parseXml, simpleTableXml} from './utils.js';

/**
 * Tests for the 'uidParser.js' file.
 */
/** @module tests/uidParser */

/**
 * Build a (post-2020d) UID table row: value, name, keyword, type, part.
 *
 * @param {string} value The UID value.
 * @param {string} name The UID name.
 * @param {string} keyword The UID keyword.
 * @param {string} type The UID type (ex 'Transfer Syntax', 'SOP Class').
 * @param {string} [part] Optional defining part, defaults to 'PS3.5'.
 * @returns {string[]} The row cell values.
 */
function uidRow(value, name, keyword, type, part) {
  return [value, name, keyword, type, part ?? 'PS3.5'];
}

/**
 * Build a PS3.6 UID document (table A-1).
 *
 * @param {string[][]} rows The table_A-1 rows.
 * @returns {Document} The parsed document.
 */
function getPs36UidDoc(rows) {
  return parseXml(
    '<root>' + simpleTableXml('A-1', 'UID Values', rows) + '</root>');
}

describe('parsePs36UIDNode', () => {

  test('throws when the table node is missing', () => {
    const doc = parseXml('<root></root>');
    const call = function () {
      parsePs36UIDNode(doc);
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when the table caption does not match', () => {
    const doc = parseXml(
      '<root><table label="A-1"><caption>Wrong</caption>' +
      '<tbody><tr></tr></tbody></table></root>');
    const call = function () {
      parsePs36UIDNode(doc);
    };
    expect(call).toThrow(/The node caption is not the expected one/);
  });

  test('throws when a row has the wrong number of columns', () => {
    const doc = getPs36UidDoc([
      ['1.2.840.10008.1.2', 'Implicit VR Little Endian', 'Transfer Syntax']
    ]);
    const call = function () {
      parsePs36UIDNode(doc);
    };
    expect(call).toThrow(/Not the expected UID values size: 3/);
  });

  test('splits transfer syntax and SOP class UIDs into two results', () => {
    const doc = getPs36UidDoc([
      uidRow(
        '1.2.840.10008.1.2', 'Implicit VR Little Endian',
        'ImplicitVRLittleEndian', 'Transfer Syntax'),
      uidRow(
        '1.2.840.10008.5.1.4.1.1.7', 'Secondary Capture Image Storage',
        'SecondaryCaptureImageStorage', 'SOP Class', 'PS3.4'),
      // a 'SOP Class' UID that does not match the storage SOP class
      // regex: excluded from the SOP class result
      uidRow(
        '1.2.840.10008.1.1', 'Verification SOP Class',
        'VerificationSOPClass', 'SOP Class', 'PS3.4'),
      // neither a transfer syntax nor a SOP class: excluded from both
      uidRow(
        '1.2.840.10008.1.4.1.1', 'Some Frame Of Reference',
        'SomeFrameOfReference', 'Well-known frame of reference', 'PS3.4')
    ]);

    const result = parsePs36UIDNode(doc, 'part06.xml');

    expect(result).toHaveLength(2);

    const [uidsResult, sopsResult] = result;
    expect(uidsResult.name).toEqual('DICOM Transfer syntax UIDs');
    expect(uidsResult.origin).toEqual('part06.xml');
    expect(uidsResult.raw).toEqual([
      {
        value: '1.2.840.10008.1.2',
        name: 'Implicit VR Little Endian',
        keyword: 'ImplicitVRLittleEndian'
      }
    ]);
    expect(JSON.parse(uidsResult.data)).toEqual({
      '1.2.840.10008.1.2': 'ImplicitVRLittleEndian'
    });

    expect(sopsResult.name).toEqual('DICOM Standard SOP class');
    expect(sopsResult.origin).toEqual('part06.xml');
    expect(sopsResult.raw).toEqual([
      {
        value: '1.2.840.10008.5.1.4.1.1.7',
        name: 'Secondary Capture Image Storage',
        keyword: 'SecondaryCaptureImageStorage'
      }
    ]);
    expect(JSON.parse(sopsResult.data)).toEqual({
      '1.2.840.10008.5.1.4.1.1.7': 'SecondaryCaptureImageStorage'
    });
  });

  test(
    '"raw" keeps the original name text untouched (\'&amp;\' un-decoded, ' +
    'trailing ":" comment kept)',
    () => {
      const doc = getPs36UidDoc([
        uidRow(
          '1.2.840.10008.1.2.1',
          'Explicit VR Little Endian:Default Transfer Syntax',
          'ExplicitVRLittleEndian', 'Transfer Syntax'),
        // '&amp;amp;' in the XML source decodes to the literal text
        // '&amp;' once parsed, which is what adaptUidsForDwv() looks for
        uidRow(
          '1.2.840.10008.1.2.4.50',
          'JPEG Baseline &amp;amp; Extended:Process 1',
          'JPEGBaseline8Bit', 'Transfer Syntax')
      ]);

      const result = parsePs36UIDNode(doc);
      const [uidsResult] = result;

      // NOTE: adaptUidsForDwv()'s name clean-up ('&amp;' -> '&', dropping
      // a trailing ':' comment) has no effect observable through this
      // public API: `raw` is a clone taken before the clean-up runs, and
      // `data` (via simplifyUids()) never included `name` in the first
      // place, only `value` and `keyword`. So the clean-up only affects
      // an internal, otherwise-unused copy of the uid objects.
      expect(uidsResult.raw).toEqual([
        {
          value: '1.2.840.10008.1.2.1',
          name: 'Explicit VR Little Endian:Default Transfer Syntax',
          keyword: 'ExplicitVRLittleEndian'
        },
        {
          value: '1.2.840.10008.1.2.4.50',
          name: 'JPEG Baseline &amp; Extended:Process 1',
          keyword: 'JPEGBaseline8Bit'
        }
      ]);
      expect(JSON.parse(uidsResult.data)).toEqual({
        '1.2.840.10008.1.2.1': 'ExplicitVRLittleEndian',
        '1.2.840.10008.1.2.4.50': 'JPEGBaseline8Bit'
      });
    });

  test(
    'mixes up the keyword with the UID type for legacy 4-column rows ' +
    '(no "UID Keyword" column)',
    () => {
      // pre-2020d table_A-1 format: value, name, type, part (no keyword
      // column); uidPropertiesToObject() always reads the keyword from
      // column index 2, which is the type column in this older format.
      const doc = getPs36UidDoc([
        [
          '1.2.840.10008.1.2.2',
          'Explicit VR Big Endian (Retired)',
          'Transfer Syntax',
          'PS3.5'
        ]
      ]);

      const result = parsePs36UIDNode(doc);
      const [uidsResult] = result;

      expect(uidsResult.raw).toEqual([
        {
          value: '1.2.840.10008.1.2.2',
          name: 'Explicit VR Big Endian (Retired)',
          keyword: 'Transfer Syntax'
        }
      ]);
    });

});
