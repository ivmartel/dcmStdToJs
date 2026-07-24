import {describe, expect, test, vi} from 'vitest';

import {parsePs36TagsNode, parsePs37Node} from '../src/tagParser.js';
import {parseXml, simpleTableXml} from './utils.js';

/**
 * Tests for the 'tagParser.js' file.
 */
/** @module tests/tagParser */

/**
 * Build a tag table row as an array of table row (`(group,element)`,
 * name, keyword, VR, VM[, retired]) cells.
 *
 * @param {string} group The tag group.
 * @param {string} element The tag element.
 * @param {string} keyword The tag keyword.
 * @param {string} vr The tag VR.
 * @param {string} vm The tag VM.
 * @param {string} [retired] Optional retired column value; when provided
 *   the row has 6 columns instead of 5.
 * @returns {string[]} The row cell values.
 */
function tagRow(group, element, keyword, vr, vm, retired) {
  const cells = [
    '(' + group + ',' + element + ')', keyword, keyword, vr, vm
  ];
  if (typeof retired !== 'undefined') {
    cells.push(retired);
  }
  return cells;
}

/**
 * Build a PS3.6 tags document (tables 7-1, 8-1 and 6-1).
 *
 * @param {string[][]} [fileMetaRows] Rows for table 7-1.
 * @param {string[][]} [dirStructRows] Rows for table 8-1.
 * @param {string[][]} [dataElementRows] Rows for table 6-1.
 * @returns {Document} The parsed document.
 */
function getPs36Doc(fileMetaRows, dirStructRows, dataElementRows) {
  const xml = '<root>' +
    simpleTableXml(
      '7-1', 'Registry of DICOM File Meta Elements', fileMetaRows ?? []) +
    simpleTableXml(
      '8-1', 'Registry of DICOM Directory Structuring Elements',
      dirStructRows ?? []) +
    simpleTableXml(
      '6-1', 'Registry of DICOM Data Elements', dataElementRows ?? []) +
    '</root>';
  return parseXml(xml);
}

/**
 * Build a PS3.7 tags document (tables E.1-1 and E.2-1).
 *
 * @param {string[][]} [commandRows] Rows for table E.1-1.
 * @param {string[][]} [retiredCommandRows] Rows for table E.2-1.
 * @returns {Document} The parsed document.
 */
function getPs37Doc(commandRows, retiredCommandRows) {
  const xml = '<root>' +
    simpleTableXml('E.1-1', 'Command Fields', commandRows ?? []) +
    simpleTableXml(
      'E.2-1', 'Retired Command Fields', retiredCommandRows ?? []) +
    '</root>';
  return parseXml(xml);
}

describe('parsePs36TagsNode', () => {

  test('throws when a required table is missing', () => {
    const xml = '<root>' +
      simpleTableXml(
        '7-1', 'Registry of DICOM File Meta Elements',
        [tagRow('0002', '0001', 'FileMetaInformationVersion', 'OB', '1')]) +
      '</root>';
    const doc = parseXml(xml);
    const call = function () {
      parsePs36TagsNode(doc);
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when a table caption does not match', () => {
    const doc = getPs36Doc(
      [tagRow('0002', '0001', 'FileMetaInformationVersion', 'OB', '1')],
      [tagRow('0004', '1130', 'FileSetID', 'CS', '1')],
      [tagRow('0008', '0016', 'SOPClassUID', 'UI', '1')]);
    // break the 6-1 table caption
    doc.querySelector('table[label=\'6-1\'] caption').textContent = 'Wrong';
    const call = function () {
      parsePs36TagsNode(doc);
    };
    expect(call).toThrow(/The node caption is not the expected one/);
  });

  test('throws when a row has the wrong number of columns', () => {
    const doc = getPs36Doc(
      [tagRow('0002', '0001', 'FileMetaInformationVersion', 'OB', '1')],
      [tagRow('0004', '1130', 'FileSetID', 'CS', '1')],
      [['(0008,0016)', 'n', 'SOPClassUID', 'UI']]);
    const call = function () {
      parsePs36TagsNode(doc);
    };
    expect(call).toThrow(/Not the expected tag properties size: 4/);
  });

  test(
    'parses tags across the three tables, normalizing repeating groups ' +
    'and adding generic group length entries',
    () => {
      const doc = getPs36Doc(
        [tagRow(
          '0002', '0001', 'FileMetaInformationVersion', 'OB', '1', '')],
        [tagRow('0004', '1130', 'FileSetID', 'CS', '1')],
        [
          tagRow('0008', '0016', 'SOPClassUID', 'UI', '1'),
          tagRow('60xx', '3000', 'OverlayData', 'OB or OW', '1')
        ]);

      const result = parsePs36TagsNode(doc, 'part06.xml');

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('DICOM Tags');
      expect(result[0].origin).toEqual('part06.xml');
      // `raw` keeps the original, un-normalized XML cell text ('60xx' /
      // 'OB or OW'); only `data` (below) applies the group/element 'x'
      // replacement and VR normalization.
      expect(result[0].raw).toEqual([
        {
          group: '0002',
          element: '0001',
          keyword: 'FileMetaInformationVersion',
          vr: 'OB',
          vm: '1'
        },
        {
          group: '0004',
          element: '1130',
          keyword: 'FileSetID',
          vr: 'CS',
          vm: '1'
        },
        {
          group: '0008',
          element: '0016',
          keyword: 'SOPClassUID',
          vr: 'UI',
          vm: '1'
        },
        {
          group: '60xx',
          element: '3000',
          keyword: 'OverlayData',
          vr: 'OB or OW',
          vm: '1'
        }
      ]);

      const data = JSON.parse(result[0].data);
      expect(data).toEqual({
        '0002': {
          '0001': ['OB', '1', 'FileMetaInformationVersion']
        },
        '0004': {
          1130: ['CS', '1', 'FileSetID'],
          '0000': ['UL', '1', 'GenericGroupLength']
        },
        '0008': {
          '0016': ['UI', '1', 'SOPClassUID'],
          '0000': ['UL', '1', 'GenericGroupLength']
        },
        6000: {
          3000: ['ox', '1', 'OverlayData'],
          '0000': ['UL', '1', 'GenericGroupLength']
        }
      });
    });

});

describe('parsePs37Node', () => {

  test('throws when a required table is missing', () => {
    const xml = '<root>' +
      simpleTableXml('E.1-1', 'Command Fields',
        [tagRow('0000', '0002', 'AffectedSOPClassUID', 'UI', '1')]) +
      '</root>';
    const doc = parseXml(xml);
    const call = function () {
      parsePs37Node(doc);
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when the tables have no rows', () => {
    const doc = getPs37Doc([], []);
    const call = function () {
      parsePs37Node(doc);
    };
    expect(call).toThrow(/Empty tags./);
  });

  test(
    'combines both tables into a single result, group 0000 gets no ' +
    'generic group length entry',
    () => {
      const doc = getPs37Doc(
        [tagRow('0000', '0002', 'AffectedSOPClassUID', 'UI', '1')],
        [tagRow('0000', '0010', 'CommandRecognitionCode', 'SH', '1')]);

      const result = parsePs37Node(doc, 'part07.xml');

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('DICOM tags group 0000');
      expect(result[0].origin).toEqual('part07.xml');
      expect(result[0].raw).toEqual([
        {
          group: '0000',
          element: '0002',
          keyword: 'AffectedSOPClassUID',
          vr: 'UI',
          vm: '1'
        },
        {
          group: '0000',
          element: '0010',
          keyword: 'CommandRecognitionCode',
          vr: 'SH',
          vm: '1'
        }
      ]);

      const data = JSON.parse(result[0].data);
      expect(data).toEqual({
        '0000': {
          '0002': ['UI', '1', 'AffectedSOPClassUID'],
          '0010': ['SH', '1', 'CommandRecognitionCode']
        }
      });
    });

  test('normalizes known composite VRs and warns on unknown ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = getPs37Doc([
      tagRow('0000', '0001', 'NoteVr', 'See Note 3', '1'),
      tagRow('0000', '0002', 'UsOrOwVr', 'US or OW', '1'),
      tagRow('0000', '0003', 'UsOrSsVr', 'US or SS', '1'),
      tagRow('0000', '0004', 'UsOrSsOrOwVr', 'US or SS or OW', '1'),
      tagRow('0000', '0005', 'UnknownVr', 'CS or SS', '1')
    ], []);

    const result = parsePs37Node(doc);
    const data = JSON.parse(result[0].data);

    expect(data['0000']['0001']).toEqual(['NONE', '1', 'NoteVr']);
    expect(data['0000']['0002']).toEqual(['xx', '1', 'UsOrOwVr']);
    expect(data['0000']['0003']).toEqual(['xs', '1', 'UsOrSsVr']);
    expect(data['0000']['0004']).toEqual(['xs', '1', 'UsOrSsOrOwVr']);
    // unknown composite VRs are left untouched, but a warning is emitted
    expect(data['0000']['0005']).toEqual(['CS or SS', '1', 'UnknownVr']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown VR: \'CS or SS\''));

    warn.mockRestore();
  });

});
